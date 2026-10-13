"use client";
export default function PrintButton() {
  return <button onClick={() => window.print()} className="h-[30px] px-3 rounded-[5px] bg-black text-white font-medium">Print</button>;
}
