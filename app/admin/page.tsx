import { redirect } from "next/navigation";
import { deleteAccount, setApproved } from "@/app/admin/actions";
import { loadProfile } from "@/lib/records";
import { homeForSections } from "@/lib/sections";

type Account = {
  id: string;
  email: string | null;
  enabled_sections: string[] | null;
  created_at: string;
  approved: boolean;
};

export default async function AdminPage() {
  const profile = await loadProfile();
  if (!profile.approved) redirect("/waiting");
  if (!profile.isAdmin) redirect(homeForSections(profile.enabledSections));
  const { data, error } = await profile.supabase.rpc("admin_list_accounts");
  const accounts = (data ?? []) as Account[];
  const pending = accounts.filter((account) => !account.approved);
  const approved = accounts.filter((account) => account.approved);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10" data-testid="admin">
      <h1 className="font-heading text-4xl">Approvals</h1>
      <p className="mt-2 text-muted-foreground">New accounts wait here until you let them in.</p>
      {error ? <p className="mt-4 text-sm text-destructive">{error.message}</p> : null}
      <AccountList title="Waiting" accounts={pending} empty="Nobody is waiting." />
      <AccountList title="Approved" accounts={approved} empty="No approved accounts yet." />
    </main>
  );
}

function AccountList({ title, accounts, empty }: { title: string; accounts: Account[]; empty: string }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-2xl">{title}</h2>
      {accounts.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="mt-3 space-y-3">
        {accounts.map((account) => (
          <li key={account.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-medium">{account.email ?? "No email"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(account.enabled_sections ?? []).join(", ") || "No section"} · {new Date(account.created_at).toLocaleDateString("en-GB")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {account.approved ? (
                <form action={setApproved.bind(null, account.id, false)}>
                  <button className="h-10 rounded-full border border-border px-4 text-sm" type="submit">
                    Revoke
                  </button>
                </form>
              ) : (
                <form action={setApproved.bind(null, account.id, true)}>
                  <button className="h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground" type="submit">
                    Approve
                  </button>
                </form>
              )}
              <form action={deleteAccount.bind(null, account.id)}>
                <button className="h-10 rounded-full border border-destructive px-4 text-sm text-destructive" type="submit">
                  Delete
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
