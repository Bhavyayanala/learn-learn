import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkChild } from "@/components/LinkChild";
import { ParentFees, type ParentFeeCycle } from "@/components/ParentFees";
import { NotificationBell } from "@/components/NotificationBell";

type ChildSummary = {
  studentId: string;
  name: string;
  grade: string;
  attendedCount: number;
  totalSessions: number;
  homeworkDone: number;
  homeworkTotal: number;
  averageScore: number | null;
};

export default async function ParentDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: links } = parent
    ? await supabase
        .from("parent_students")
        .select("student_id, students(id, grade, users(full_name))")
        .eq("parent_id", parent.id)
    : { data: [] };

  const children: ChildSummary[] = [];

  for (const link of links ?? []) {
    const studentRel = Array.isArray(link.students) ? link.students[0] : link.students;
    const userRel = studentRel
      ? Array.isArray((studentRel as { users: unknown }).users)
        ? ((studentRel as { users: { full_name: string }[] }).users)[0]
        : ((studentRel as unknown as { users: { full_name: string } | null }).users)
      : null;

    // RLS limits all of these to this parent's own child.
    const { data: attendanceRows } = await supabase
      .from("attendance")
      .select("status")
      .eq("student_id", link.student_id);

    const attended = (attendanceRows ?? []).filter(
      (a) => a.status === "present" || a.status === "late"
    ).length;

    const { data: subs } = await supabase
      .from("assignment_submissions")
      .select("marks_awarded, status, assignments(max_marks)")
      .eq("student_id", link.student_id);

    const graded = (subs ?? []).filter((s) => s.marks_awarded !== null);
    let averageScore: number | null = null;
    if (graded.length > 0) {
      const pcts = graded.map((s) => {
        const asg = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
        const max = (asg as { max_marks?: number } | null)?.max_marks ?? 10;
        return ((s.marks_awarded ?? 0) / max) * 100;
      });
      averageScore = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }

    const { count: assignmentTotal } = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true });

    children.push({
      studentId: link.student_id,
      name: userRel?.full_name ?? "Your child",
      grade: (studentRel as { grade?: string } | null)?.grade ?? "",
      attendedCount: attended,
      totalSessions: attendanceRows?.length ?? 0,
      homeworkDone: (subs ?? []).length,
      homeworkTotal: assignmentTotal ?? 0,
      averageScore,
    });
  }

  // RLS limits this to fee cycles for this parent's own children.
  const { data: feeRows } = await supabase
    .from("fee_cycles")
    .select("id, period_label, classes_planned, classes_completed, amount, status, student_id")
    .order("period_label", { ascending: false });

  const nameByStudentId = new Map(children.map((c) => [c.studentId, c.name]));

  const feeCycles: ParentFeeCycle[] = (feeRows ?? []).map((f) => ({
    id: f.id,
    child_name: nameByStudentId.get(f.student_id) ?? "Your child",
    period_label: f.period_label,
    classes_planned: f.classes_planned,
    classes_completed: f.classes_completed,
    amount: Number(f.amount),
    status: f.status,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-3 flex justify-end">
        <NotificationBell accentColor="parent" />
      </div>
      <div className="rounded-2xl border border-parent-light bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-parent">Parent Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Hello, {user.user_metadata?.full_name ?? "there"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Track your {children.length === 1 ? "child's" : "children's"} classes,
          attendance, and progress.
        </p>
      </div>

      {children.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="font-medium">No children linked yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Link your child using the email they signed up with.
          </p>
          <div className="mt-4">
            <LinkChild />
          </div>
        </div>
      ) : (
        <>
          {children.map((c) => (
            <section
              key={c.studentId}
              className="mt-6 rounded-2xl border border-parent-light bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <span className="text-xs text-slate-400">{c.grade}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-parent-light p-3 text-center">
                  <p className="text-xl font-semibold text-parent">
                    {c.totalSessions > 0
                      ? `${c.attendedCount}/${c.totalSessions}`
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-600">Attendance</p>
                </div>
                <div className="rounded-xl bg-parent-light p-3 text-center">
                  <p className="text-xl font-semibold text-parent">
                    {c.homeworkTotal > 0
                      ? `${c.homeworkDone}/${c.homeworkTotal}`
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-600">Homework</p>
                </div>
                <div className="rounded-xl bg-parent-light p-3 text-center">
                  <p className="text-xl font-semibold text-parent">
                    {c.averageScore !== null ? `${c.averageScore}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-600">Avg score</p>
                </div>
              </div>

              {c.totalSessions === 0 && (
                <p className="mt-3 text-xs text-slate-400">
                  No attendance recorded yet.
                </p>
              )}
            </section>
          ))}

          <section className="mt-6 rounded-2xl border border-parent-light bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Tuition Fees</h2>
            <div className="mt-4">
              <ParentFees cycles={feeCycles} />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-600">
              Link another child
            </h2>
            <div className="mt-3">
              <LinkChild />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
