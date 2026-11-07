"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [debugMsg, setDebugMsg] = useState("Initializing...");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"reports" | "people" | "verifications" | "audit" | "users" | "settings" | "places" | "chatmedia">("reports");

  const [reports, setReports] = useState<any[]>([]);
  const [peopleReports, setPeopleReports] = useState<any[]>([]);
  const [pendingPlaces, setPendingPlaces] = useState<any[]>([]);
  const [pendingAreas, setPendingAreas] = useState<any[]>([]);
  const [chatMedia, setChatMedia] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [feePercent, setFeePercent] = useState(2.0);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          setDebugMsg("No session found.");
          setLoading(false);
          return;
        }
        setUser(session.user);
        const { data: profile, error } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).single();
        if (error || !profile) {
          setDebugMsg(`Error: ${error?.message || "Profile not found"}`);
          setLoading(false);
          return;
        }
        if (profile.is_admin) {
          setIsAdmin(true);
          await fetchAdminData();
        } else {
          setDebugMsg(`Logged in as ${session.user.email}, but is_admin is false.`);
          setLoading(false);
        }
      } catch (err: any) {
        setDebugMsg(`Unexpected Error: ${err.message}`);
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  const fetchAdminData = async () => {
    try {
      const { data: pr } = await supabase.from("user_reports").select("id,reporter_id,target_id,context,created_at,status").eq("status", "open").order("created_at", { ascending: true }).limit(100);
      setPeopleReports((pr as any[]) || []);
      const { data: repData } = await supabase.from("reports").select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (repData) setReports(repData);

      const { data: placeData } = await supabase.from("places").select("*").eq("status", "claimed").order("created_at", { ascending: false });
      if (placeData) setPendingPlaces(placeData);

      const { data: logData } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (logData) setAuditLogs(logData);

      const { data: areaData } = await supabase.from("nigerian_places").select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (areaData) setPendingAreas(areaData);

      const { data: mediaData } = await supabase.from("messages").select("*").eq("room_id", "aba-market").not("media_url", "is", null).order("created_at", { ascending: false }).limit(50);
      if (mediaData) setChatMedia(mediaData);

      const { data: userData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (userData) setUsers(userData);

      const { data: settingsData } = await supabase.from("platform_settings").select("fee_percent").eq("id", 1).single();
      if (settingsData) setFeePercent(settingsData.fee_percent);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (action: string, targetId: string, details: any) => {
    if (!user) return;
    await supabase.from("admin_audit_log").insert([{ admin_id: user.id, action, target_id: targetId, details }]);
  };

  const handleVerifyPlace = async (placeId: string, placeName: string) => {
    const { error } = await supabase.from("places").update({ status: "verified" }).eq("id", placeId);
    if (!error) {
      await logAction("VERIFY_PLACE", placeId, { name: placeName });
      alert(`${placeName} is now Verified!`);
      fetchAdminData();
    }
  };

  const handleFreezePlace = async (placeId: string, placeName: string) => {
    if (!window.confirm("Freeze this location?")) return;
    const { error } = await supabase.from("places").update({ status: "frozen" }).eq("id", placeId);
    if (!error) {
      await logAction("FREEZE_PLACE", placeId, { name: placeName });
      fetchAdminData();
    }
  };

  const handleResolveReport = async (reportId: string) => {
    const { error } = await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId);
    if (!error) {
      await logAction("RESOLVE_REPORT", reportId, {});
      fetchAdminData();
    }
  };

  const handleBanUser = async (userId: string, email: string, currentBanStatus: boolean) => {
    const newBanStatus = !currentBanStatus;
    if (!window.confirm(`${newBanStatus ? "BAN" : "UNBAN"} this user?`)) return;
    const { error } = await supabase.from("profiles").update({ is_banned: newBanStatus }).eq("id", userId);
    if (error) alert("Error: " + error.message);
    else {
      await logAction(newBanStatus ? "BAN_USER" : "UNBAN_USER", userId, { email });
      fetchAdminData();
    }
  };

  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("platform_settings").update({ fee_percent: feePercent, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) alert("Error updating fee: " + error.message);
    else {
      await logAction("UPDATE_FEE", "1", { newFee: feePercent });
      alert("Fee updated.");
    }
  };

    const handleUpdateTier = async (userId: string, currentTier: number, newTier: number) => {
    if (!window.confirm(`Change this seller's tier from ${currentTier} to ${newTier}?`)) return;
    const { error } = await supabase.from("profiles").update({ seller_tier: newTier }).eq("id", userId);
    if (error) {
      alert("Error updating tier: " + error.message);
    } else {
      await logAction("UPDATE_TIER", userId, { newTier });
      alert("Tier updated! The seller's price limits have been changed instantly.");
      fetchAdminData();
    }
  };

  const handleApproveArea = async (areaId: string) => {
    const { error } = await supabase.from("nigerian_places").update({ status: "approved" }).eq("id", areaId);
    if (error) {
      alert("Approve failed: " + error.message);
    } else {
      await logAction("APPROVE_AREA", areaId, {});
      fetchAdminData();
    }
  };

  const handleRejectArea = async (areaId: string) => {
    if (!window.confirm("Reject this area?")) return;
    const { error } = await supabase.from("nigerian_places").delete().eq("id", areaId);
    if (error) {
      alert("Reject failed: " + error.message);
    } else {
      await logAction("REJECT_AREA", areaId, {});
      fetchAdminData();
    }
  };

  const handleDeleteMedia = async (messageId: string) => {
    if (!window.confirm("Delete this media and its message?")) return;
    const res = await fetch("/api/admin/chat/delete-media", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ((await supabase.auth.getSession()).data.session?.access_token || "") },
          body: JSON.stringify({ messageId }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert("Delete failed: " + (json.error || "unknown"));
    } else {
      await logAction("DELETE_CHAT_MEDIA", messageId, {});
      fetchAdminData();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F2F6F3] text-[#2E4A36] font-bold text-xl">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F6F3] p-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
        <p className="text-red-500 font-bold mb-4 bg-red-100 p-3 rounded-lg max-w-lg">Debug: {debugMsg}</p>
        <Link href="/" className="bg-[#2E4A36] text-white px-6 py-3 rounded-xl font-bold">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F6F3] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-[#DCE5DE]">
          <div>
            <h1 className="text-2xl font-bold text-[#2E4A36]">AmaNaija Admin</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-lg">Log Out</button>
            <Link href="/" className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">Exit</Link>
          </div>
        </header>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: "reports", label: `Reports (${reports.length})` },
            { id: "people", label: `People reports (${peopleReports.length})` },
            { id: "places", label: `Pending Areas (${pendingAreas.length})` },
            { id: "verifications", label: `Verify Shops (${pendingPlaces.length})` },
            { id: "chatmedia", label: `Chat Media (${chatMedia.length})` },
            { id: "users", label: "Users" },
            { id: "settings", label: "Settings" },
            { id: "audit", label: "Audit Logs" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap ${activeTab === tab.id ? "bg-[#2E4A36] text-white shadow-md" : "bg-white text-gray-600 border border-gray-200"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#DCE5DE] min-h-[400px]">

          {activeTab === "reports" && (
            <div className="space-y-4">
              {reports.length === 0 ? <p className="text-gray-500 italic">No pending reports.</p> :
                reports.map(report => (
                  <div key={report.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-sm font-bold text-red-600">From: {report.reporter_name || "Guest"}</p>
                    <p className="text-sm mt-1"><strong>Offender:</strong> {report.reported_name}</p>
                    <p className="text-sm mt-1"><strong>Message:</strong> &quot;{report.message_body}&quot;</p>
                    <p className="text-sm mt-1"><strong>Reason:</strong> {report.reason}</p>
                    <button onClick={() => handleResolveReport(report.id)} className="mt-3 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold">Dismiss</button>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "people" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Review each report within 24 hours. Oldest first.</p>
              {peopleReports.length === 0 ? <p className="text-gray-500 italic">No open people reports.</p> :
                peopleReports.map((r) => (
                  <div key={r.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-sm"><strong>Reported:</strong> {String(r.target_id).slice(0, 8)}</p>
                    <p className="text-sm"><strong>By:</strong> {String(r.reporter_id).slice(0, 8)}</p>
                    <p className="text-sm"><strong>Where:</strong> {r.context || "person card"}</p>
                    <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</p>
                    {/^listing:/.test(r.context || "") && (() => {
                      const slug = String(r.context).split(/\s/)[0].slice(8);
                      return (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a href={`/p/${slug}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold">Open listing</a>
                          <button onClick={async () => { const { error } = await supabase.rpc("admin_remove_listing", { p_slug: slug }); alert(error ? error.message : "Listing removed"); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Remove listing</button>
                          <button onClick={async () => { const { error } = await supabase.rpc("admin_restore_listing", { p_slug: slug }); alert(error ? error.message : "Listing restored"); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">Restore listing</button>
                        </div>
                      );
                    })()}
                    <button
                      onClick={async () => {
                        await supabase.from("user_reports").update({ status: "reviewed", reviewed_at: new Date().toISOString() }).eq("id", r.id);
                        setPeopleReports((list) => list.filter((x) => x.id !== r.id));
                      }}
                      className="mt-3 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                    >Mark reviewed</button>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "places" && (
            <div className="space-y-4">
              {pendingAreas.length === 0 ? <p className="text-gray-500 italic">No pending areas.</p> :
                pendingAreas.map(area => (
                  <div key={area.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-[#2E4A36] text-lg">{area.name}</h3>
                      <p className="text-sm text-gray-600">{area.state} Ã‚Â· {area.type}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveArea(area.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold">Approve</button>
                      <button onClick={() => handleRejectArea(area.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Reject</button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "verifications" && (
            <div className="space-y-4">
              {pendingPlaces.length === 0 ? <p className="text-gray-500 italic">No pending shops.</p> :
                pendingPlaces.map(place => (
                  <div key={place.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex gap-4 items-center">
                    {place.live_photo_url ? (
                      <img src={place.live_photo_url} alt="" className="w-24 h-24 object-cover rounded-lg border" />
                    ) : (
                      <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">No Photo</div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-[#2E4A36] text-lg">{place.name}</h3>
                      <p className="text-sm text-gray-600">{place.category}</p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleVerifyPlace(place.id, place.name)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold">Verify</button>
                        <button onClick={() => handleFreezePlace(place.id, place.name)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Freeze</button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "chatmedia" && (
            <div className="space-y-4">
              {chatMedia.length === 0 ? <p className="text-gray-500 italic">No media in the Aba lounge.</p> :
                chatMedia.map(m => (
                  <div key={m.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex gap-3 items-center">
                    {m.media_type === "photo" ? (
                      <img src={m.media_url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500">Video</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#2E4A36] text-sm truncate">by {m.user_name}</p>
                      <p className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleDeleteMedia(m.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shrink-0">Delete</button>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              {users.map(u => (
                <div key={u.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-[#2E4A36]">{u.email}</p>
                    <p className="text-xs text-gray-500">{u.is_admin ? "Admin" : "User"} {u.is_banned ? "Ã‚Â· BANNED" : ""}</p>
                  </div>
                  <button
                    onClick={() => handleBanUser(u.id, u.email, u.is_banned)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold ${u.is_banned ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {u.is_banned ? "Unban" : "Ban"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-[#2E4A36] mb-4">Platform Settings</h3>
              <form onSubmit={handleUpdateFee} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Platform Fee (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={feePercent}
                    onChange={(e) => setFeePercent(parseFloat(e.target.value))}
                    className="w-full bg-[#F8FAF9] border border-[#DCE5DE] px-4 py-3 rounded-xl"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">Applies to new orders only.</p>
                </div>
                <button type="submit" className="bg-[#2E4A36] text-white font-bold py-3 px-6 rounded-xl">Update Fee</button>
              </form>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-2">
              {auditLogs.length === 0 ? <p className="text-gray-500 italic">No actions logged.</p> :
                auditLogs.map(log => (
                  <div key={log.id} className="text-xs p-2 border-b border-gray-100 flex justify-between">
                    <span><strong>{log.action}</strong> on {log.target_id.slice(0, 8)}...</span>
                    <span className="text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}