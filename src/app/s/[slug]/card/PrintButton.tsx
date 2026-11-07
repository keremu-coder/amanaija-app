"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="print:hidden h-12 w-full rounded-full bg-[#17131F] text-[15px] font-bold text-white active:scale-95">
      Print or save as PDF
    </button>
  );
}
