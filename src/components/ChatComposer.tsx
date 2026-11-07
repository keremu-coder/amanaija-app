"use client";

import { useRef, useEffect, useState } from "react";

export function ChatComposer({
  body,
  onBodyChange,
  onSubmit,
  onSendMedia,
  selectedFont,
  replyTo,
  onCancelReply
}: {
  body: string;
  onBodyChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSendMedia: (file: File) => void;
  selectedFont: string;
  replyTo: any;
  onCancelReply: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [body]);

  const canSend = body.trim().length > 0;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File is too large. Max 15MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Only photos and videos are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      await onSendMedia(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-gray-200 bg-white shrink-0"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {replyTo && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border-l-4 border-[#2E4A36] bg-[#E8EFEA] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-[#2E4A36]">Replying to {replyTo.user_name}</p>
            <p className="truncate text-[12px] text-gray-600">{replyTo.body || "(media)"}</p>
          </div>
          <button type="button" onClick={onCancelReply} className="shrink-0 rounded-full p-1 text-gray-500 hover:bg-gray-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFile}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Attach photo or video"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50"
        >
          {uploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>

        <div className="flex-1 rounded-2xl border border-gray-300 bg-gray-50 focus-within:border-[#2E4A36] focus-within:bg-white transition-colors">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Message"
            rows={1}
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSubmit(e as unknown as React.FormEvent);
              }
            }}
            className={`block w-full resize-none bg-transparent px-3.5 py-2.5 text-[15px] leading-snug text-gray-900 placeholder:text-gray-400 outline-none ${selectedFont}`}
            style={{ maxHeight: "120px", minHeight: "42px" }}
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2E4A36] text-white transition-all active:scale-90 disabled:opacity-30 disabled:active:scale-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>

      <p className="px-4 pt-1 pb-1 text-[10px] text-gray-400 text-right">{body.length}/500</p>
    </form>
  );
}