import Image from "next/image";

export default function AuthLayout({ children }) {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="bg-white rounded-md px-2.5 py-1.5 border border-line flex">
            <Image src="/logo.png" alt="Easy Barn & Bifold Doors" width={150} height={38} style={{ width: 150, height: "auto" }} priority />
          </span>
        </div>
        <div className="bg-panel border border-line rounded-md p-5">{children}</div>
        <p className="text-center text-[11px] text-faint mt-4">Easy Barn Ops · internal use only</p>
      </div>
    </main>
  );
}
