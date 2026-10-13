import { requireUser } from "@/lib/auth";
import { navCounts } from "@/lib/counts";
import Shell from "@/components/shell";

export default async function AppLayout({ children }) {
  const { profile, isAdmin } = await requireUser();
  const counts = await navCounts(isAdmin);
  return <Shell profile={profile} isAdmin={isAdmin} counts={counts}>{children}</Shell>;
}
