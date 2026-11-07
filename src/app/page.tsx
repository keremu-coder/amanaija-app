"use client";

import { IconAsk, IconMarket, IconPin, IconShop, IconTrack } from "@/components/Icons";
import { AlertsButton, SoundToggle } from "@/components/SoundFx";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import StreetView from "@/components/StreetView";
import ShopLinkBox from "@/components/ShopLinkBox";
import HomeRentToggle from "@/components/HomeRentToggle";
import ShopContactBox from "@/components/ShopContactBox";
import ShopNeedsInbox from "@/components/ShopNeedsInbox";
import BookingBox from "@/components/BookingBox";
import ShopBookingsInbox from "@/components/ShopBookingsInbox";
import AbaRoom from "@/components/AbaRoom";
import LoungeScene from "@/components/LoungeScene";
import { supabase } from "@/lib/supabase";

const AmaMap = dynamic(() => import("@/components/AmaMap"), { ssr: false, loading: () => <div className="absolute inset-0 flex items-center justify-center bg-[#F4F1EA] text-sm font-bold text-[#165C3A]">Loading your map…</div> });

const ORDER_COLS = "id,buyer_id,shop_id,status,total_amount_kobo,created_at,guest_name,guest_phone,guest_phone_verified,short_code,encrypted_address,address_iv,address_auth_tag,fee_percent_at_time,fee_amount_kobo,packing_video_url,booking_time";

export default function Home() {
  const [viewState, setViewState] = useState({ longitude: 8.0, latitude: 9.1, zoom: 5.5 });
  const [userLocation, setUserLocation] = useState<{lng: number, lat: number} | null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState("Loading...");
  
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [showClaimForm, setShowClaimForm] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [shopPhoto, setShopPhoto] = useState<File | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  
  const [claimingExistingPlace, setClaimingExistingPlace] = useState<any>(null);
  const [selectedPlaza, setSelectedPlaza] = useState<any>(null);
  const [plazaShops, setPlazaShops] = useState<any[]>([]);

  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [isViewingMenu, setIsViewingMenu] = useState(false);

  const [cart, setCart] = useState<{ item: any, quantity: number }[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [orderError, setOrderError] = useState('');

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestBookingTime, setGuestBookingTime] = useState("");
  const [showOtpPrompt, setShowOtpPrompt] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const [isViewingOrders, setIsViewingOrders] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);

  const [isOwnerMode, setIsOwnerMode] = useState(false);
  const [ownerTab, setOwnerTab] = useState<"today" | "orders" | "items" | "setup">("today");
  const [sheetMin, setSheetMin] = useState(true);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemIsService, setNewItemIsService] = useState(false);
  const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);

  const [isInRoom, setIsInRoom] = useState(false);
  const [viewMode, setViewModeRaw] = useState<"lounge" | "map">("lounge");
  const setViewMode = (m: "lounge" | "map") => {
    setViewModeRaw(m);
    try { sessionStorage.setItem("amanaija_view", m); } catch {}
  };
  // Refreshing the page keeps you on the map instead of throwing you back Home.
  useEffect(() => {
    try { if (sessionStorage.getItem("amanaija_view") === "map") setViewModeRaw("map"); } catch {}
  }, []);
  const [showRealMap, setShowRealMap] = useState(true);
  const placesLoaded = useRef(false);

  const [isTracking, setIsTracking] = useState(false);
  const [trackCode, setTrackCode] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<any>(null);
  const [trackError, setTrackError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    fetchPlaces();
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchPlaces = async () => {
    // Show last known places instantly, then refresh from the server.
    try {
      const cached = localStorage.getItem("amanaija_places_v1");
      if (cached && !placesLoaded.current) setPlaces(JSON.parse(cached));
    } catch {}
    const { data, error } = await supabase.from('places').select('*');
    if (!error && data) {
      placesLoaded.current = true;
      setPlaces(data);
      setDbStatus(`Connected (${data.length} places)`);
      try { const j = JSON.stringify(data); if (j.length < 1500000) localStorage.setItem("amanaija_places_v1", j); } catch {}
    }
  };

  const handleSelectPlace = async (place: any) => {
    setSheetMin(false);
    if (place.category === 'Plaza') {
      setSelectedPlaza(place);
      setSelectedPlace(null);
      const { data, error } = await supabase.from('places').select('*').eq('parent_id', place.id);
      if (!error && data) setPlazaShops(data);
      return;
    }

    setSelectedPlaza(null);
    setSelectedPlace(place);
    setIsViewingMenu(false);
    setIsOwnerMode(false);
    setCart([]); 
    setShowOtpPrompt(false);
    setOtpCode("");
    setOrderError("");
    
    if (user && place.claimed_by === user.id) {
      setIsOwnerMode(true);
      const { data: ordersData } = await supabase.from('orders').select(ORDER_COLS).eq('shop_id', place.id).order('created_at', { ascending: false });
      setIncomingOrders(ordersData || []);
    }
    
    const { data, error } = await supabase.from('items').select('*').eq('shop_id', place.id);
    if (!error && data) setShopItems(data);
    else setShopItems([]);
  };

  const handleClaimExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingExistingPlace || !shopPhoto || !user) return;

    setIsClaiming(true);
    try {
      const currentPos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });
      
      const R = 6371e3;
      const phi1 = claimingExistingPlace.lat * Math.PI/180;
      const phi2 = currentPos.coords.latitude * Math.PI/180;
      const dPhi = (currentPos.coords.latitude - claimingExistingPlace.lat) * Math.PI/180;
      const dLambda = (currentPos.coords.longitude - claimingExistingPlace.lng) * Math.PI/180;
      const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
      const distance = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));

      if (distance > 100) throw new Error(`You are ${Math.round(distance)}m away. You must be at the location.`);

      const fileExt = shopPhoto.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('shop-photos').upload(fileName, shopPhoto);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('shop-photos').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('places').update({
        claimed_by: user.id,
        status: 'claimed',
        live_photo_url: publicUrl,
        upload_lat: currentPos.coords.latitude,
        upload_lng: currentPos.coords.longitude
      }).eq('id', claimingExistingPlace.id);

      if (dbError) throw dbError;

      alert("Success! You have claimed this location.");
      setClaimingExistingPlace(null);
      setShopPhoto(null);
      fetchPlaces();

    } catch (err: any) {
      alert("Claim failed: " + err.message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaceName || !userLocation || !user) {
        alert("Missing details or not logged in.");
        return;
    }
    if (!shopPhoto) {
        alert("You must take a live photo to claim this place.");
        return;
    }

    setIsClaiming(true);

    try {
      const R = 6371e3;
      let collisionMessage = "";

      places.forEach(p => {
        const phi1 = userLocation.lat * Math.PI/180;
        const phi2 = p.lat * Math.PI/180;
        const dPhi = (p.lat - userLocation.lat) * Math.PI/180;
        const dLambda = (p.lng - userLocation.lng) * Math.PI/180;
        const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
        const dist = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));

        if (dist < 50 && !collisionMessage) {
          collisionMessage = `There is already a "${p.name}" (${p.category}) within 50 meters. If this is yours, tap the existing pin and click "Claim This Location".`;
        }
      });

      if (collisionMessage) {
        throw new Error(collisionMessage);
      }

      const currentPos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      const phi1_gps = userLocation.lat * Math.PI/180;
      const phi2_gps = currentPos.coords.latitude * Math.PI/180;
      const dPhi_gps = (currentPos.coords.latitude - userLocation.lat) * Math.PI/180;
      const dLambda_gps = (currentPos.coords.longitude - userLocation.lng) * Math.PI/180;
      const a_gps = Math.sin(dPhi_gps/2) * Math.sin(dPhi_gps/2) + Math.cos(phi1_gps) * Math.cos(phi2_gps) * Math.sin(dLambda_gps/2) * Math.sin(dLambda_gps/2);
      const distance = R * (2 * Math.atan2(Math.sqrt(a_gps), Math.sqrt(1-a_gps)));

      if (distance > 100) throw new Error(`You are ${Math.round(distance)} meters away. You must be at the location.`);

      const aiRes = await fetch('/api/ai-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaceName })
      });
      const aiData = await aiRes.json();
      const autoCategory = aiData.category || 'Shop';

      const fileExt = shopPhoto.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('shop-photos').upload(fileName, shopPhoto);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('shop-photos').getPublicUrl(fileName);

      const { error: dbError } = await supabase.rpc('claim_new_place', {
        p_name: newPlaceName,
        p_category: autoCategory,
        p_lat: userLocation.lat,
        p_lng: userLocation.lng,
        p_upload_lat: currentPos.coords.latitude,
        p_upload_lng: currentPos.coords.longitude,
        p_photo_url: publicUrl
      });

      if (dbError) throw dbError;

      alert(`Success! Smart Classifier categorized it as a ${autoCategory}. You can fix this later in your dashboard.`);
      setNewPlaceName(""); 
      setShopPhoto(null);
      setShowClaimForm(false); 
      fetchPlaces(); 

    } catch (error: any) {
      alert("Claim Blocked: " + error.message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleUpdateCategory = async (newCategory: string) => {
    if (!selectedPlace) return;
    const { error } = await supabase.from('places').update({ category: newCategory }).eq('id', selectedPlace.id);
    if (!error) {
      setSelectedPlace({ ...selectedPlace, category: newCategory });
      fetchPlaces();
    }
  };

  const fetchMyOrders = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('orders').select(`${ORDER_COLS}, places ( name )`).eq('buyer_id', user.id).order('created_at', { ascending: false });
    if (!error && data) setMyOrders(data);
  };

  const handleViewMyOrders = () => { fetchMyOrders(); setIsViewingOrders(true); };

  const refreshIncomingOrders = async () => {
    if (!selectedPlace) return;
    const { data, error } = await supabase.from('orders').select(ORDER_COLS).eq('shop_id', selectedPlace.id).order('created_at', { ascending: false });
    if (!error && data) setIncomingOrders(data);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) alert("Error updating order: " + error.message);
    else refreshIncomingOrders();
  };

  const handleUploadPackingVideo = async (orderId: string, file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Video is too large. Max 20MB.");
      return;
    }
    setUploadingVideoId(orderId);
    try {
      const fileExt = file.name.split('.').pop() || "mp4";
      const fileName = `packing-${orderId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('packing-videos').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('packing-videos').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('orders').update({ packing_video_url: publicUrl }).eq('id', orderId);
      if (dbError) throw dbError;

      alert("Packing video uploaded securely. You can now mark it Out for Delivery.");
      refreshIncomingOrders();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingVideoId(null);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !selectedPlace) return;
    const priceKobo = Math.round(parseFloat(newItemPrice) * 100);
    const { error } = await supabase.from('items').insert([{ 
      shop_id: selectedPlace.id, 
      name: newItemName, 
      price_kobo: priceKobo,
      is_service: newItemIsService
    }]);
    if (error) alert("Error: " + error.message);
    else {
      alert("Item added!");
      setNewItemName("");
      setNewItemPrice("");
      setNewItemIsService(false);
      handleSelectPlace(selectedPlace);
    }
  };

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { item, quantity: 1 }];
    });
  };

  const calculateTotal = () => cart.reduce((total, cartItem) => total + (cartItem.item.price_kobo * cartItem.quantity), 0);
  const cartHasService = cart.some(c => c.item.is_service);

  const handleInitiateCheckout = async () => {
    if (cart.length === 0 || !selectedPlace) return;
    setOrderError("");

    if (!user) {
      if (!guestName || !guestPhone) {
        setOrderError("Please fill in your name and phone number.");
        const el = document.getElementById('guest-address-field');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (cartHasService && !guestBookingTime) {
        setOrderError("Please select a time for your appointment.");
        return;
      }
      if (!cartHasService && !guestAddress) {
        setOrderError("Please fill in your delivery address.");
        return;
      }

      setIsSendingOtp(true);
      try {
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: guestPhone }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to send SMS");
        
        setShowOtpPrompt(true);
      } catch (err: any) {
        setOrderError(err.message);
      } finally {
        setIsSendingOtp(false);
      }
    } else {
      if (!guestPhone.trim()) {
        setOrderError("Please enter your phone number.");
        return;
      }
      if (cartHasService && !guestBookingTime) {
        setOrderError("Please select a time for your appointment.");
        return;
      }
      if (!cartHasService && !guestAddress.trim()) {
        setOrderError("Please enter your delivery address.");
        return;
      }
      setOrderError("");
      executeCheckout(true);
    }
  };

  const executeCheckout = async (isVerified: boolean) => {
    setIsCheckingOut(true);
    setOrderError("");

    try {
      if (!user && !isVerified) {
        if (otpCode.length !== 6) {
          throw new Error("Please enter the 6-digit code.");
        }
        
        const verifyRes = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: guestPhone, code: otpCode }),
        });
        
        if (!verifyRes.ok) {
          const verifyJson = await verifyRes.json();
          throw new Error(verifyJson.error || "Invalid or expired OTP code.");
        }
      }

      let encAddress = null;
      let iv = null;
      let authTag = null;

      if (guestAddress) {
        const encRes = await fetch('/api/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'encrypt', address: guestAddress })
        });
        const encData = await encRes.json();
        if (encData.error) throw new Error(encData.error);
        encAddress = encData.encrypted;
        iv = encData.iv;
        authTag = encData.authTag;
      }

      const itemsPayload = cart.map(c => ({ item_id: c.item.id, quantity: c.quantity }));

      const { data: result, error: orderError } = await supabase.rpc('create_order', {
        p_shop_id: selectedPlace.id,
        p_items: itemsPayload,
        p_guest_name: guestName || null,
        p_guest_phone: guestPhone || null,
        p_buyer_id: user?.id || null,
        p_phone_verified: isVerified || !!user,
        p_encrypted_address: encAddress,
        p_address_iv: iv,
        p_address_auth_tag: authTag,
        p_booking_time: guestBookingTime || null
      });

      if (orderError) {
        throw new Error(orderError.message);
      }

      const email = user?.email || `${guestPhone.replace(/[^0-9]/g, '')}@amanaija-guest.com`;
      const initRes = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          amount: calculateTotal(),
          orderId: result.order_id
        })
      });
      const initData = await initRes.json();

      if (initData.authorization_url) {
        localStorage.setItem(`order_${result.order_id}`, result.short_code);
        if (result.tracking_token) localStorage.setItem(`track_${result.short_code}`, result.tracking_token);
        window.location.href = initData.authorization_url;
      } else {
        throw new Error(initData.error || "Payment initialization failed");
      }
    } catch (err: any) {
      setOrderError("Error: " + err.message);
      setIsCheckingOut(false);
    }
  };

  const handleRevealAddress = async (order: any) => {
    if (!order.encrypted_address) {
      alert("No address provided for this order.");
      return;
    }
    
    try {
      const res = await fetch('/api/address', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + ((await supabase.auth.getSession()).data.session?.access_token || '')
            },
            body: JSON.stringify({ action: 'decrypt', orderId: order.id })
          });
      const data = await res.json();
      
      if (data.error) alert("Failed to decrypt address.");
      else alert(`Delivery/Home Address:\n\n${data.decrypted}\n\nNote: This action has been logged.`);
    } catch (err) {
      alert("Decryption error.");
    }
  };

  // Open a map panel (Nearby / Need something) from the bottom bar; opens the real map first if needed.
  const openPanel = (k: string) => {
    const fire = () => window.dispatchEvent(new CustomEvent("amanaija:open", { detail: k }));
    if (showRealMap) { fire(); return; }
    setShowRealMap(true);
    setTimeout(fire, 700);
  };

  const handleTrackOrder = async () => {
    if (!trackCode) return;
    setTrackError("");
    
    let token: string | null = null;
    try { token = localStorage.getItem(`track_${trackCode}`); } catch {}
    const { data, error } = await supabase.rpc('get_order_by_code', {
      p_short_code: trackCode,
      p_token: token
    });

    if (error || !data) {
      setTrackError(error && /Too many/i.test(error.message) ? "Too many tries. Please wait a few minutes." : "Order not found. Please check the 4-digit code.");
      setTrackedOrder(null);
    } else {
      setTrackedOrder(data);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage("Processing...");
    
    let authError = null;
    
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      authError = error;
      if (error) setAuthMessage("Error: " + error.message);
      else setAuthMessage("Account created!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      authError = error;
      if (error) setAuthMessage("Error: " + error.message);
    }

    // Track IP on successful login/signup to enforce bans
    if (!authError) {
      try {
        const ipRes = await fetch('/api/auth/track-ip', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ email }) 
        });
        if (!ipRes.ok) {
          const ipData = await ipRes.json();
          await supabase.auth.signOut();
          setAuthMessage(ipData.error || "Your network has been banned.");
          return;
        }
      } catch (err) {
        console.error("IP tracking failed", err);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsViewingOrders(false);
  };

  return (
    <main className="relative w-full h-dvh overflow-hidden bg-[#F2F6F3]">
      
      {isInRoom ? (
        <AbaRoom onExit={() => setIsInRoom(false)} />
      ) : viewMode === "lounge" ? (
        <LoungeScene
          onEnterRoom={() => setIsInRoom(true)}
          onOpenMap={() => setViewMode("map")}
          onOpenShopOwner={() => { setViewMode("map"); }}
          onSelectLocation={(lat: number, lng: number) => {
            setViewState({ longitude: lng, latitude: lat, zoom: 16 });
            setUserLocation({ lng, lat });
            setShowRealMap(true);
            setViewMode("map");
          }}
          userName={user?.email?.split("@")[0] || ""}
          placeCount={places.length}
        />
      ) : (
        <>
          {showRealMap ? (
            <>
              <AmaMap viewState={viewState} setViewState={setViewState} userLocation={userLocation} setUserLocation={setUserLocation} places={places} onSelectPlace={handleSelectPlace} userName={user?.email?.split("@")[0] || ""} />
              <button onClick={() => setViewMode("lounge")} className="absolute left-3 top-3 z-20 h-11 rounded-full bg-white px-4 text-sm font-bold text-[#17131F] shadow">Home</button>
            </>
          ) : (
            <StreetView places={places} center={{ lat: viewState.latitude, lng: viewState.longitude }} userName={user?.email?.split("@")[0] || ""} onSelectPlace={handleSelectPlace} onBack={() => setViewMode("lounge")} onOpenRealMap={() => setShowRealMap(true)} />
          )}

          <div className={sheetMin ? "ama-dock absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[92%] max-w-md z-10 p-2 max-h-[80dvh] overflow-y-auto overflow-x-hidden [&>*:not(.sheet-keep)]:hidden" : "ama-dock absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[92%] max-w-md z-10 p-5 max-h-[80dvh] overflow-y-auto overflow-x-hidden"}>
            <div className="sheet-keep -mt-2 mb-2">
              <button type="button" onClick={() => setSheetMin(!sheetMin)} aria-label={sheetMin ? "Open menu" : "Minimize menu"} className="mx-auto mb-2 flex w-full items-center justify-center py-1">
                <span className="h-1.5 w-12 rounded-full bg-[#DCE5DE]" />
              </button>
              {!sheetMin && !isTracking && (
                <button type="button" onClick={() => setSheetMin(true)} className="mb-2 flex h-11 items-center gap-1 rounded-full bg-[#F2F6F3] px-4 text-sm font-bold text-[#2E4A36] active:scale-95">&larr; Back to map</button>
              )}
              {sheetMin && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => openPanel("list")} className="ama-tab hot"><span className="ic"><IconPin /></span>Nearby</button>
                  <button type="button" onClick={() => openPanel("ask")} className="ama-tab"><span className="ic"><IconAsk /></span>Need it</button>
                  <a href="/market" className="ama-tab"><span className="ic"><IconMarket /></span>Market</a>
                  <button type="button" onClick={() => { setIsTracking(true); setSheetMin(false); }} className="ama-tab"><span className="ic"><IconTrack /></span>Track</button>
                  <button type="button" onClick={() => setSheetMin(false)} className="ama-tab"><span className="ic"><IconShop /></span>{user ? "My shop" : "Shop"}</button>
                </div>
              )}
            </div>
            
            {isTracking ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-2xl font-bold text-[#2E4A36]">Track Order</h1>
                  <button onClick={() => { setIsTracking(false); setTrackedOrder(null); setTrackCode(""); }} className="text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">X</button>
                </div>
                
                {!trackedOrder ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 text-center">Enter your 4-digit order code to see the live status.</p>
                    <input 
                      type="text" 
                      placeholder="e.g. 4921" 
                      value={trackCode} 
                      onChange={(e) => setTrackCode(e.target.value)} 
                      className="w-full bg-[#F8FAF9] border border-[#DCE5DE] px-4 py-4 rounded-xl text-center text-3xl font-bold tracking-[0.5em]" 
                      maxLength={4}
                    />
                    {trackError && <p className="text-xs text-center text-red-500 font-bold">{trackError}</p>}
                    <button onClick={handleTrackOrder} className="w-full bg-[#2E4A36] text-white font-bold py-4 rounded-xl text-lg shadow-md">
                      Check Status
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#F8FAF9] p-6 rounded-xl border border-[#DCE5DE] text-center">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Order Status</p>
                    <div className="text-3xl mb-4">BOX</div>
                    <h2 className="text-xl font-bold text-[#2E4A36] mb-4">{trackedOrder.shop_name}</h2>
                    
                    <div className="bg-amber-100 text-amber-800 font-bold px-4 py-2 rounded-lg inline-block mb-4">
                      {trackedOrder.status}
                    </div>

                    {trackedOrder.booking_time && (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-blue-800 uppercase mb-1">Appointment Time</p>
                        <p className="text-sm font-bold text-blue-900">{new Date(trackedOrder.booking_time).toLocaleString()}</p>
                      </div>
                    )}

                    {trackedOrder.total_amount_kobo != null && (
                      <p className="text-sm text-gray-600 mt-4">Total: {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(trackedOrder.total_amount_kobo / 100)}</p>
                    )}
                    {trackedOrder.guest_name && <p className="text-xs text-gray-500 mt-1">For: {trackedOrder.guest_name}</p>}
                    {trackedOrder.total_amount_kobo == null && <p className="text-xs text-gray-500 mt-3">Open this page on the phone you ordered with, or log in, to see the full details.</p>}

                    {trackedOrder.booking_time && trackedOrder.status === 'Out for Delivery' && (
                      <div className="mt-6 space-y-3">
                        <p className="text-sm text-gray-700 font-medium">Has the service been completed to your satisfaction?</p>
                        <button 
                          onClick={async () => {
                            let token: string | null = null;
                            try { token = localStorage.getItem(`track_${trackCode}`); } catch {}
                            const { error: apErr } = await supabase.rpc('approve_booking', { p_order_id: trackedOrder.id, p_token: token });
                            if (apErr) { alert("Could not approve. Please try again from the phone you booked with."); return; }
                            setTrackedOrder({ ...trackedOrder, status: 'Completed' });
                            alert("Service approved. Thank you!");
                          }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-md"
                        >
                          Approve & Release Payment
                        </button>
                      </div>
                    )}

                    {!trackedOrder.booking_time && trackedOrder.status === 'Out for Delivery' && trackedOrder.delivery_code && (
                      <div className="mt-4 bg-green-50 border-2 border-green-500 rounded-xl p-4">
                        <p className="text-xs font-bold text-green-800 uppercase tracking-widest mb-1">Delivery Code</p>
                        <p className="text-4xl font-black text-green-900 tracking-[0.2em]">{trackedOrder.delivery_code}</p>
                        <p className="text-xs text-green-700 mt-2">Give this code to the rider to collect your package.</p>
                      </div>
                    )}

                    {trackedOrder.booking_time && trackedOrder.status !== 'Completed' && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <button onClick={() => alert("Emergency Alert Sent to Admin and Police.")} className="w-full bg-red-600 text-white font-bold py-2 rounded-lg text-xs">
                          🚨 PANIC / SAFETY ALERT
                        </button>
                      </div>
                    )}
                    
                    <button onClick={() => { setTrackedOrder(null); setTrackCode(""); }} className="mt-6 text-sm text-[#2E4A36] font-bold hover:underline block w-full">
                      Track another order
                    </button>
                  </div>
                )}
              </div>
            ) : isViewingOrders ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-2xl font-bold text-[#2E4A36]">My Orders</h1>
                  <button onClick={() => setIsViewingOrders(false)} className="text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">X</button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {myOrders.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No orders yet.</p> : 
                    myOrders.map(order => (
                      <div key={order.id} className="bg-[#F8FAF9] p-4 rounded-xl border border-[#DCE5DE]">
                        <p className="font-bold text-[#2E4A36]">{order.places.name}</p>
                        <p className="text-sm text-gray-600 mb-1">Total: {(order.total_amount_kobo / 100).toLocaleString()} Naira</p>
                        <p className="text-xs font-bold text-gray-500 mb-2">Code: #{order.short_code}</p>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-md">{order.status}</span>
                      </div>
                  ))}
                </div>
                <button onClick={fetchMyOrders} className="mt-4 w-full bg-white border border-[#DCE5DE] text-[#2E4A36] font-medium py-2 rounded-lg text-sm">Refresh Status</button>
              </div>
            ) : selectedPlaza ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2E4A36]">{selectedPlaza.name}</h1>
                    <p className="text-xs font-bold text-green-700 mt-1">{plazaShops.length} Shops inside</p>
                  </div>
                  <button onClick={() => setSelectedPlaza(null)} className="text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">X</button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                  {plazaShops.length === 0 ? <p className="text-sm text-gray-500 italic">No shops registered inside this plaza yet.</p> : 
                    plazaShops.map(shop => (
                      <div 
                        key={shop.id} 
                        onClick={() => handleSelectPlace(shop)}
                        className="bg-[#F8FAF9] p-4 rounded-xl border border-[#DCE5DE] flex justify-between items-center cursor-pointer hover:bg-[#E8EFEA] transition-colors"
                      >
                        <div>
                          <p className="font-bold text-[#2E4A36]">{shop.name}</p>
                          <p className="text-xs text-gray-500">{shop.category} - {shop.status}</p>
                        </div>
                        <span className="text-[#2E4A36]">{">"}</span>
                      </div>
                  ))}
                </div>
                <p className="text-xs text-center text-gray-400">Tap a shop above to view their menu and order.</p>
              </div>
            ) : selectedPlace && isViewingMenu ? (
              <div className="flex max-h-[calc(80dvh-5.5rem)] flex-col">
                <div className="flex shrink-0 justify-between items-start mb-2">
                  <div>
                    <h1 className="text-xl font-bold text-[#2E4A36] capitalize">{selectedPlace.name.toLowerCase()}</h1>
                    <p className="text-xs font-bold text-green-700 mt-0.5">{cart.length} items in cart</p>
                  </div>
                  <button onClick={() => setIsViewingMenu(false)} className="text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">X</button>
                </div>

                {showOtpPrompt ? (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-4">
                    <p className="text-sm font-bold text-amber-800 mb-2">Verify your phone number</p>
                    <p className="text-xs text-amber-700 mb-3">We sent a 6-digit code to {guestPhone}.</p>
                    <input 
                      type="text" 
                      placeholder="Enter 6-digit code" 
                      value={otpCode} 
                      onChange={(e) => setOtpCode(e.target.value)} 
                      className="w-full bg-white border border-amber-300 px-3 py-2 rounded-lg text-center text-lg font-bold tracking-widest mb-3" 
                      maxLength={6}
                    />
                    {orderError && <p className="text-xs text-red-600 mb-2 font-bold text-center">{orderError}</p>}
                    <button 
                      onClick={() => executeCheckout(false)} 
                      disabled={isCheckingOut || otpCode.length !== 6}
                      className="w-full bg-[#2E4A36] text-white font-medium py-2 rounded-lg disabled:opacity-50"
                    >
                      {isCheckingOut ? "Verifying..." : "Verify & Place Order"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                    <div className="mb-3 space-y-2">
                      {shopItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-[#F8FAF9] p-3 rounded-xl border border-[#DCE5DE]">
                          <div>
                            <p className="font-bold text-[#2E4A36]">{item.name} {item.is_service && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-1">Service</span>}</p>
                            <p className="text-sm font-medium text-[#6B7E72]">{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(item.price_kobo / 100)}</p>
                          </div>
                          <button onClick={() => addToCart(item)} className="bg-[#E8EFEA] hover:bg-[#DCE5DE] text-[#2E4A36] px-4 py-2 rounded-lg font-bold text-sm">Add</button>
                        </div>
                      ))}
                    </div>
                    
                    {user && cart.length > 0 && (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-2 text-xs font-bold text-amber-800">Checkout Details</p>
                        <input type="tel" placeholder="Phone number" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={`w-full bg-white border ${orderError && !guestPhone ? 'border-red-500' : 'border-amber-200'} px-3 py-2 rounded-lg text-sm mb-2`} />
                        
                        {cartHasService && (
                          <div className="mb-2">
                            <label className="block text-xs font-bold text-amber-800 mb-1">Appointment Time</label>
                            <input type="datetime-local" value={guestBookingTime} onChange={(e) => setGuestBookingTime(e.target.value)} className={`w-full bg-white border ${orderError && !guestBookingTime ? 'border-red-500' : 'border-amber-200'} px-3 py-2 rounded-lg text-sm`} />
                          </div>
                        )}

                        <input id="guest-address-field" type="text" placeholder="Home/Shop Address" value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} className={`w-full bg-white border ${orderError && !guestAddress ? 'border-red-500' : 'border-amber-200'} px-3 py-2 rounded-lg text-sm`} />
                        {orderError && <p className="mt-2 text-sm font-semibold text-[#B3261E]">{orderError}</p>}
                      </div>
                    )}

                    {!user && cart.length > 0 && (
                      <div className="mb-4 bg-amber-50 p-3 rounded-xl border border-amber-200">
                        <p className="text-xs font-bold text-amber-800 mb-2">Guest Checkout</p>
                        <input type="text" placeholder="Your Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full bg-white border border-amber-200 px-3 py-2 rounded-lg text-sm mb-2" required />
                        <input type="tel" placeholder="Phone Number" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="w-full bg-white border border-amber-200 px-3 py-2 rounded-lg text-sm mb-2" required />
                        
                        {cartHasService && (
                          <div className="mb-2">
                            <label className="block text-xs font-bold text-amber-800 mb-1">Appointment Time</label>
                            <input type="datetime-local" value={guestBookingTime} onChange={(e) => setGuestBookingTime(e.target.value)} className={`w-full bg-white border ${orderError && !guestBookingTime ? 'border-red-500' : 'border-amber-200'} px-3 py-2 rounded-lg text-sm`} required />
                          </div>
                        )}

                        <input id="guest-address-field" type="text" placeholder="Home/Shop Address" value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} className={`w-full bg-white border ${orderError && !guestAddress ? 'border-red-500' : 'border-amber-200'} px-3 py-2 rounded-lg text-sm`} required />
                        {orderError && <p className="text-xs text-red-600 mt-2 font-bold">{orderError}</p>}
                      </div>
                    )}

                    </div>

                    <div className="shrink-0 border-t border-[#DCE5DE] bg-white pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-bold text-[#2E4A36]">Total:</p>
                        <p className="text-lg font-bold text-[#2E4A36]">{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(calculateTotal() / 100)}</p>
                      </div>
                      <button onClick={handleInitiateCheckout} disabled={cart.length === 0 || isSendingOtp || isCheckingOut} className={`w-full font-medium py-3 rounded-xl shadow-sm transition-all ${cart.length === 0 ? 'bg-gray-300 text-gray-500' : 'bg-[#2E4A36] text-white hover:bg-[#203527]'}`}>
                        {isSendingOtp ? "Sending code..." : isCheckingOut ? "Processing..." : "Proceed to Checkout"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : selectedPlace ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2E4A36] capitalize">{selectedPlace.name.toLowerCase()}</h1>
                    <p className="text-xs text-[#6B7E72] font-medium uppercase tracking-wider mt-1">{selectedPlace.category} - {selectedPlace.status}</p>
                  </div>
                  <button onClick={() => setSelectedPlace(null)} className="text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">X</button>
                </div>

                {claimingExistingPlace ? (
                  <form onSubmit={handleClaimExistingSubmit} className="space-y-3 bg-[#E8EFEA] p-4 rounded-xl border border-[#2E4A36]/20 mb-4">
                    <p className="text-xs font-bold text-[#2E4A36] mb-2">Claim this location (Requires Live Photo + GPS)</p>
                    <div className="w-full">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Take a live photo of the front</label>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => setShopPhoto(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white file:text-[#2E4A36] hover:file:bg-gray-100" required />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" disabled={isClaiming} className="flex-1 bg-[#2E4A36] text-white py-2 rounded-lg text-sm font-medium">{isClaiming ? "Verifying..." : "Claim This Place"}</button>
                      <button type="button" onClick={() => { setClaimingExistingPlace(null); setShopPhoto(null); }} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium">Cancel</button>
                    </div>
                  </form>
                ) : isOwnerMode ? (
                  <div className="bg-[#F8FAF9] p-4 rounded-xl border border-[#DCE5DE]">
                    <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-white p-1 border border-[#DCE5DE]">
                      {([["today", "Today"], ["orders", "Orders"], ["items", "Items"], ["setup", "Setup"]] as const).map(([k, label]) => (
                        <button key={k} type="button" onClick={() => setOwnerTab(k)} className={`h-10 rounded-lg text-[12px] font-bold active:scale-95 ${ownerTab === k ? "bg-[#1F7A4D] text-white" : "text-[#2E4A36]"}`}>{label}{k === "orders" && incomingOrders.length > 0 ? ` (${incomingOrders.length})` : ""}</button>
                      ))}
                    </div>
                    {ownerTab === "setup" && <ShopLinkBox key={selectedPlace.id} place={selectedPlace} />}
                    {ownerTab === "setup" && selectedPlace.category === 'Residential' && <HomeRentToggle key={"rent-" + selectedPlace.id} place={selectedPlace} />}
                    {ownerTab === "today" && selectedPlace.category !== 'Residential' && <ShopNeedsInbox key={"needs-" + selectedPlace.id} place={selectedPlace} />}
                    {ownerTab === "today" && selectedPlace.category === 'Service' && <ShopBookingsInbox key={"book-" + selectedPlace.id} place={selectedPlace} />}
                    {ownerTab === "today" && selectedPlace.category === 'Residential' && <p className="text-sm text-gray-600">Nothing to do today. Use Setup to change this home.</p>}
                    {ownerTab === "setup" && selectedPlace.category !== 'Residential' && <ShopContactBox key={"contact-" + selectedPlace.id} place={selectedPlace} />}
                    {ownerTab === "setup" && <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Correct Category</label>
                      <select 
                        value={selectedPlace.category} 
                        onChange={(e) => handleUpdateCategory(e.target.value)}
                        className="w-full bg-white border border-[#DCE5DE] px-3 py-2 rounded-lg text-sm"
                      >
                        {['Shop', 'Food', 'Service', 'Plaza', 'Church', 'Hospital', 'School', 'Office', 'Residential', 'Market', 'Other'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>}

                    {ownerTab === "orders" && <>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-bold text-[#2E4A36]">Incoming Orders</h3>
                      <button onClick={refreshIncomingOrders} className="text-xs text-blue-600 font-bold hover:underline">Refresh</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                      {incomingOrders.length === 0 ? <p className="text-xs text-gray-500 italic">No orders yet.</p> : 
                        incomingOrders.map(order => (
                          <div key={order.id} className="bg-white p-3 rounded-lg border border-[#DCE5DE]">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-sm text-[#2E4A36]">{(order.total_amount_kobo / 100).toLocaleString()} Naira</p>
                                <p className="text-xs text-blue-600 font-medium">Customer: {order.guest_name || "User"}</p>
                                <p className="text-xs text-gray-500">{order.guest_phone || ""}</p>
                                {order.booking_time && (
                                  <p className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1 py-0.5 rounded mt-1 inline-block">
                                    Appointment: {new Date(order.booking_time).toLocaleString()}
                                  </p>
                                )}
                                
                                <button onClick={() => handleRevealAddress(order)} className="text-[10px] text-blue-600 font-bold hover:underline mt-1 block">
                                  Reveal Address
                                </button>
                              </div>
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-md">{order.status}</span>
                            </div>
                            <div className="mt-2 flex gap-2">
                              {order.status === 'Awaiting Seller Confirmation' && (
                                <button onClick={() => handleUpdateOrderStatus(order.id, 'Awaiting Payment')} className="bg-[#2E4A36] text-white px-2 py-1 rounded text-xs font-bold w-full">Accept Order</button>
                              )}
                              
                              {order.status === 'Awaiting Payment' && (
                                <button onClick={() => handleUpdateOrderStatus(order.id, 'Processing')} className="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold w-full">Verify Payment (Simulate)</button>
                              )}

                              {order.status === 'Payment Verified' && (
                                <button onClick={() => handleUpdateOrderStatus(order.id, 'Processing')} className="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold w-full">Start Service / Processing</button>
                              )}

                              {/* IF SERVICE: No packing video, no delivery code. Finish -> Await buyer approval */}
                              {order.status === 'Processing' && order.booking_time && (
                                <button onClick={() => handleUpdateOrderStatus(order.id, 'Out for Delivery')} className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold w-full">Finish Service (Await Buyer Approval)</button>
                              )}

                              {/* IF PHYSICAL GOOD: Packing video required */}
                              {order.status === 'Processing' && !order.booking_time && (
                                <>
                                  {!order.packing_video_url ? (
                                    <div className="w-full">
                                      <label className="block text-[10px] font-bold text-red-600 mb-1">Required: Upload Packing Video</label>
                                      <input 
                                        type="file" 
                                        accept="video/*" 
                                        capture="environment"
                                        disabled={uploadingVideoId === order.id}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadPackingVideo(order.id, file);
                                        }}
                                        className="text-[10px] w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-200 file:text-gray-700" 
                                      />
                                      {uploadingVideoId === order.id && <p className="text-[10px] text-blue-600 mt-1">Uploading video...</p>}
                                    </div>
                                  ) : (
                                    <button onClick={() => handleUpdateOrderStatus(order.id, 'Out for Delivery')} className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold w-full">Out for Delivery</button>
                                  )}
                                </>
                              )}
                              
                              {/* IF PHYSICAL GOOD: Delivery code required */}
                              {order.status === 'Out for Delivery' && !order.booking_time && (
                                <button onClick={() => {
                                  const enteredCode = window.prompt("Ask the buyer for their 4-digit Delivery Code:");
                                  if (enteredCode) {
                                    supabase.rpc('complete_delivery', { p_order_id: order.id, p_code: enteredCode.trim() }).then(({ data, error }) => {
                                      if (error) alert(error.message);
                                      else if ((data as any)?.ok) refreshIncomingOrders();
                                      else alert(`Invalid code! The buyer did not receive this package. Tries left: ${(data as any)?.attempts_left ?? 0}`);
                                    });
                                  }
                                }} className="bg-green-700 text-white px-2 py-1 rounded text-xs font-bold w-full">
                                  Enter Delivery Code to Complete
                                </button>
                              )}
                            </div>
                          </div>
                      ))}
                    </div>

                    </>}

                    {ownerTab === "items" && <>
                    <h3 className="text-sm font-bold text-[#2E4A36] mb-3">Add New Item / Service</h3>
                    <form onSubmit={handleAddItem} className="space-y-3">
                      <input type="text" placeholder="Name (e.g. Jollof Rice, Haircut, Tailor)" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full bg-white border border-[#DCE5DE] px-3 py-2 rounded-lg text-sm" required />
                      <input type="number" placeholder="Price (Naira)" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-full bg-white border border-[#DCE5DE] px-3 py-2 rounded-lg text-sm" required />
                      
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-white p-2 rounded-lg border border-[#DCE5DE]">
                        <input type="checkbox" checked={newItemIsService} onChange={(e) => setNewItemIsService(e.target.checked)} className="w-4 h-4 rounded text-[#2E4A36]" />
                        This is a service (requires appointment)
                      </label>

                      <button type="submit" className="w-full bg-[#2E4A36] text-white font-medium py-2 rounded-lg text-sm">Add to Menu</button>
                    </form>
                    <div className="mt-4 border-t border-[#DCE5DE] pt-4">
                      <button onClick={() => setIsViewingMenu(true)} className="w-full bg-white border border-[#DCE5DE] text-[#2E4A36] font-medium py-2 rounded-lg text-sm">View My Menu</button>
                    </div>
                    </>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPlace.status === 'unclaimed' && (
                      <button onClick={() => setClaimingExistingPlace(selectedPlace)} className="w-full bg-[#E8EFEA] hover:bg-[#DCE5DE] text-[#2E4A36] font-bold py-3 rounded-xl shadow-sm border border-[#2E4A36]/20">Is this yours? Claim This Location</button>
                    )}
                    
                    {selectedPlace.category !== 'Residential' && (() => {
                      const toMin = (t?: string) => { if (!t) return null; const [h, m] = t.split(':'); return Number(h) * 60 + Number(m || 0); };
                      const o = toMin(selectedPlace.open_time), c = toMin(selectedPlace.close_time);
                      const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
                      const isOpen = o !== null && c !== null ? (o <= c ? cur >= o && cur < c : cur >= o || cur < c) : null;
                      const tel = selectedPlace.phone ? String(selectedPlace.phone) : '';
                      return (
                        <div className="space-y-2">
                          {isOpen !== null && (
                            <p className={`text-sm font-bold ${isOpen ? 'text-[#165C3A]' : 'text-[#B3261E]'}`}>
                              {isOpen ? 'Open now' : 'Closed now'} <span className="font-medium text-gray-600">· {selectedPlace.open_time} to {selectedPlace.close_time}</span>
                            </p>
                          )}
                          <div className="flex gap-2">
                            {tel && <a href={`tel:${tel}`} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#F4B73F] text-sm font-bold text-[#17131F] active:scale-95">Call</a>}
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[#DCE5DE] bg-white text-sm font-bold text-[#165C3A] active:scale-95">Directions</a>
                          </div>
                        </div>
                      );
                    })()}
                    {selectedPlace.category === 'Service' && (selectedPlace.status === 'claimed' || selectedPlace.status === 'verified') && (
                      <BookingBox key={"bk-" + selectedPlace.id} place={selectedPlace} myName={user?.email?.split("@")[0] || ""} />
                    )}
                    {selectedPlace.category === 'Residential' && selectedPlace.for_rent && (
                      <div className="rounded-xl bg-[#FFF4DB] border border-[#F4B73F] p-3 text-sm text-[#17131F]">
                        <p className="font-bold">This home is for rent</p>
                        <p className="text-xs mt-1">Stay safe: never pay or share your ID before you have seen the home with someone you trust. Pay only inside AmaNaija.</p>
                      </div>
                    )}
                    {selectedPlace.category !== 'Residential' && (selectedPlace.status === 'claimed' || selectedPlace.status === 'verified') ? (
                      <button onClick={() => setIsViewingMenu(true)} className="w-full bg-[#2E4A36] text-white font-medium py-3 rounded-xl shadow-sm">View Menu & Order</button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <h1 className="text-[26px] leading-tight text-[#1F1E1D]">Your street</h1>
                  <p className="text-[13px] text-[#6B6A68]">{user ? "Signed in" : "Browsing as guest"}</p>
                </div>

                <div className="ama-card mb-4 divide-y divide-[#E8E6DC] overflow-hidden">
                  <button type="button" onClick={() => setIsInRoom(true)} className="ama-row"><span>Visit Aba Room</span><i>›</i></button>
                  <button type="button" onClick={() => setIsTracking(true)} className="ama-row"><span>Track an order</span><i>›</i></button>
                  {user && <button type="button" onClick={handleViewMyOrders} className="ama-row"><span>My orders</span><i>›</i></button>}
                  <a href="/market" className="ama-row"><span>Market</span><i>›</i></a>
                  <a href="/hawkers" className="ama-row"><span>Hawkers near me</span><i>›</i></a>
                  {user && <a href="/hawk" className="ama-row"><span>I am hawking today</span><i>›</i></a>}
                  {user && <a href="/sell" className="ama-row"><span>Sell something</span><i>›</i></a>}
                  {user && <button type="button" onClick={() => setShowClaimForm(true)} className="ama-row"><span>Claim a location here</span><i>›</i></button>}
                </div>

                {!user ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Tap a shop to order. No account needed!</p>
                    <div className="border-t border-[#DCE5DE] pt-4">
                      <p className="text-xs text-gray-500 mb-2">Are you a shop owner?</p>
                      <form onSubmit={handleAuth} className="space-y-3">
                        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#F8FAF9] border border-[#DCE5DE] px-4 py-3 rounded-xl text-sm" required />
                        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#F8FAF9] border border-[#DCE5DE] px-4 py-3 rounded-xl text-sm" required />
                        <button type="submit" className="w-full bg-gray-800 text-white font-medium py-3 rounded-xl text-sm">{isSignUp ? "Sign Up" : "Log In"}</button>
                        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-xs text-gray-500 mt-2">{isSignUp ? "Log In" : "Sign Up"}</button>
                        {authMessage && <p className="text-xs text-center text-red-500 mt-2">{authMessage}</p>}
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {showClaimForm ? (
                      <form onSubmit={handleClaimStall} className="space-y-3 bg-[#F8FAF9] p-4 rounded-xl border border-[#DCE5DE]">
                        <p className="text-xs font-bold text-gray-600 mb-2">Claim a NEW Location (Smart Classifier will auto-categorize)</p>
                        <input type="text" placeholder="Name (e.g. Grace Hospital, Mama Pott)" value={newPlaceName} onChange={(e) => setNewPlaceName(e.target.value)} className="w-full bg-white border border-[#DCE5DE] px-3 py-2 rounded-lg text-sm" required />
                        
                        <div className="w-full">
                          <label className="block text-xs font-bold text-gray-600 mb-1">Take a live photo</label>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => setShopPhoto(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#E8EFEA] file:text-[#2E4A36] hover:file:bg-[#DCE5DE]" required />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button type="submit" disabled={isClaiming} className="flex-1 bg-[#2E4A36] text-white py-2 rounded-lg text-sm font-medium">{isClaiming ? "Verifying..." : "Submit Claim"}</button>
                          <button type="button" onClick={() => { setShowClaimForm(false); setShopPhoto(null); }} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="px-1 text-[13px] text-[#6B6A68]">Tap any shop on the map to order, or use the list above.</p>
                      </>
                    )}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E8E6DC] pt-3">
                  <SoundToggle />
                  {user && <AlertsButton />}
                  {user && <a href="/delete-account" className="text-xs font-semibold text-[#6B6A68] whitespace-nowrap">Delete account</a>}
                  {user && <button type="button" onClick={handleLogout} className="text-xs font-semibold text-[#B3261E] whitespace-nowrap">Log out</button>}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}