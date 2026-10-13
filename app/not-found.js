import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="text-[17px] font-semibold">Not found</h1>
        <p className="text-muted mb-3">That page or product doesn&apos;t exist.</p>
        <Link href="/dashboard" className="text-accent hover:underline">Back to overview</Link>
      </div>
    </main>
  );
}
