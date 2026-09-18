import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const { data: workspace, error } = await supabase.from("workspaces").select("id, name").maybeSingle();
  if (error) throw new Error("Unable to load the team workspace.");
  if (!workspace) return <main className="py-16"><p className="eyebrow">Account connected</p><h1 className="mt-4 text-3xl font-bold">Your workspace is waiting to be provisioned.</h1><p className="mt-4 text-slate-400">Ask the administrator to link this account to the team workspace using the setup guide.</p></main>;
  return <main className="py-12"><p className="eyebrow">Private team workspace</p><h1 className="mt-3 text-4xl font-bold">{workspace.name}</h1><p className="mt-3 text-slate-400">Your home for competition notes, evidence, and write-ups.</p>
    <section className="panel mt-10 p-8"><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">Foundation ready</span><h2 className="mt-5 text-2xl font-semibold">Ready for your next competition</h2><p className="mt-3 max-w-xl text-slate-400">Team access and private storage are in place. Competition creation and challenge capture arrive in the next implementation step.</p></section>
  </main>;
}
