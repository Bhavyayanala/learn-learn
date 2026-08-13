import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-teacher-light bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teacher">Teacher Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Welcome, {user.user_metadata?.full_name ?? "Teacher"} 👋
        </h1>
        <p className="mt-2 text-slate-600">
          This is your stage-1 dashboard shell. Class creation, lesson
          planning, attendance, and the live classroom will be added in the
          next build stages.
        </p>
      </div>
    </main>
  );
}
