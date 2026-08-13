import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ParentDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-parent-light bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-parent">Parent Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Welcome, {user.user_metadata?.full_name ?? "Parent"}
        </h1>
        <p className="mt-2 text-slate-600">
          Once your child is linked to your account, their attendance,
          progress, homework, and fee status will appear here.
        </p>
      </div>
    </main>
  );
}
