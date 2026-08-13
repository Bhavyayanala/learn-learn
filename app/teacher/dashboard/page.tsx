import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { count: classCount } = teacher
    ? await supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacher.id)
    : { count: 0 };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-teacher-light bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teacher">Teacher Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Welcome, {user.user_metadata?.full_name ?? "Teacher"} 👋
        </h1>
        <p className="mt-2 text-slate-600">
          {classCount
            ? `You have ${classCount} tuition class${classCount === 1 ? "" : "es"} set up.`
            : "You haven't created a tuition class yet — that's the first step."}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/teacher/classes"
            className="rounded-xl bg-teacher px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            View My Classes
          </Link>
          <Link
            href="/teacher/classes/new"
            className="rounded-xl border border-teacher px-4 py-2.5 font-medium text-teacher hover:bg-teacher-light"
          >
            + Create a Class
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Attendance, the live classroom, games, and fee tracking are coming
          in later build stages.
        </p>
      </div>
    </main>
  );
}
