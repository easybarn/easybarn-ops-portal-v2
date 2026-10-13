import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { PageHeader, Notice } from "@/components/ui";
import UsersTable from "./users-table";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const { user } = await requireAdmin();
  let users = [], error = null;
  try {
    const { data, error: e } = await createAdminClient().from("profiles").select("*").order("created_at", { ascending: false });
    if (e) throw e;
    users = data || [];
  } catch (e) { error = e.message + (process.env.SUPABASE_SECRET_KEY ? "" : " (SUPABASE_SECRET_KEY is missing from .env.local)"); }
  return (
    <div>
      <PageHeader title="Users" sub="Approve new team members and set who can edit products." />
      {error ? <Notice tone="bad">Couldn&apos;t load users: {error}</Notice> : <UsersTable users={users} me={user.id} />}
    </div>
  );
}
