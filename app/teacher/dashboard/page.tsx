import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ClassSummary = {
  id: string;
  grade: string;
  subjectName: string;
  studentCount: number;
  planStatus: "none" | "draft" | "accepted";
  daysTotal: number;
  daysCompleted: number;
  progressPct: number;
  pendingProposal: boolean;
};

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

  const { data: classes } = teacher
    ? await supabase
        .from("classes")
        .select("id, grade, classes_per_month, subjects(name)")
        .eq("teacher_id", teacher.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const summaries: ClassSummary[] = [];

  for (const c of classes ?? []) {
    const subjectName = Array.isArray(c.subjects)
      ? (c.subjects[0] as { name: string } | undefined)?.name
      : (c.subjects as unknown as { name: string } | null)?.name;

    const { count: studentCount } = await supabase
      .from("class_students")
      .select("student_id", { count: "exact", head: true })
      .eq("class_id", c.id);

    const { data: plan } = await supabase
      .from("lesson_plans")
      .select("id, status")
      .eq("class_id", c.id)
      .maybeSingle();

    let daysTotal = 0;
    let daysCompleted = 0;
    let progressPct = 0;
    let pendingProposal = false;

    if (plan) {
      const { data: items } = await supabase
        .from("lesson_plan_items")
        .select("completion_percentage")
        .eq("lesson_plan_id", plan.id);

      daysTotal = items?.length ?? 0;
      daysCompleted = (items ?? []).filter((i) => i.completion_percentage >= 100).length;
      progressPct =
        daysTotal > 0
          ? Math.round(
              (items ?? []).reduce((s, i) => s + i.completion_percentage, 0) / daysTotal
            )
          : 0;

      const { count: proposalCount } = await supabase
        .from("schedule_proposals")
        .select("id", { count: "exact", head: true })
        .eq("lesson_plan_id", plan.id)
        .eq("status", "pending");

      pendingProposal = (proposalCount ?? 0) > 0;
    }

    summaries.push({
      id: c.id,
      grade: c.grade,
      subjectName: subjectName ?? "Subject",
      studentCount: studentCount ?? 0,
      planStatus: plan ? (plan.status as "draft" | "accepted") : "none",
      daysTotal,
      daysCompleted,
      progressPct,
      pendingProposal,
    });
  }

  const totalStudents = summaries.reduce((s, c) => s + c.studentCount, 0);
  const actionsNeeded = summaries.filter(
    (c) => c.pendingProposal || c.planStatus === "draft"
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-teacher-light bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teacher">Teacher Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Welcome, {user.user_metadata?.full_name ?? "Teacher"} 👋
        </h1>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-semibold">{summaries.length}</p>
            <p className="text-xs text-slate-500">
              Class{summaries.length === 1 ? "" : "es"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-semibold">{totalStudents}</p>
            <p className="text-xs text-slate-500">
              Student{totalStudents === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-semibold">{actionsNeeded.length}</p>
            <p className="text-xs text-slate-500">Need attention</p>
          </div>
        </div>

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
          <Link
            href="/teacher/calendar"
            className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            📅 Calendar
          </Link>
          <Link
            href="/teacher/search"
            className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            🔍 Search
          </Link>
        </div>
      </div>

      {actionsNeeded.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Needs your attention</h2>
          <ul className="mt-3 space-y-2">
            {actionsNeeded.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/teacher/classes/${c.id}${c.planStatus !== "none" ? "/plan" : ""}`}
                  className="block rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm hover:border-amber-400"
                >
                  <span className="font-medium">
                    {c.grade} — {c.subjectName}
                  </span>
                  <span className="ml-2 text-amber-700">
                    {c.pendingProposal
                      ? "Schedule adjustment waiting for review"
                      : "Lesson plan draft not yet accepted"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summaries.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-600">Your classes</h2>
          <ul className="mt-3 space-y-3">
            {summaries.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teacher"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {c.grade} — {c.subjectName}
                    </p>
                    <span className="text-xs text-slate-400">
                      {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  {c.planStatus === "none" ? (
                    <p className="mt-2 text-sm text-slate-500">
                      No lesson plan generated yet
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teacher"
                          style={{ width: `${c.progressPct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {c.daysCompleted}/{c.daysTotal} classes completed ·{" "}
                        {c.progressPct}% syllabus progress
                      </p>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
