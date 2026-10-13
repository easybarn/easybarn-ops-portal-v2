import Link from "next/link";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Awaiting approval" };

export default function PendingPage() {
  return (
    <div className="grid gap-3">
      <h1 className="text-[16px] font-semibold">Awaiting approval</h1>
      <p className="text-muted">
        Your account is set up but an admin still needs to approve it. You&apos;ll be able to sign in once that&apos;s done.
      </p>
      <LinkButton href="/login" className="w-full">Back to sign in</LinkButton>
      <p className="text-[12px] text-faint text-center">Wrong account? <Link href="/signup" className="hover:underline">Request access again</Link></p>
    </div>
  );
}
