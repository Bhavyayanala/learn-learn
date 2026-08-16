import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function StudentProgressPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("id, xp, streak_days")
    .eq("user_id", user.id)
    .single();

  const { data: enrolments } = await supabase
    .from("class_students")
    .select("class_id, classes(id, subjects(name))");

  const classIds = (enrolments ?? []).map((e) => e.class_id);
  const subjectByClass = new Map(
    (enrolments ?? []).map((e) => {
      const klass = Array.isArray(e.classes) ? e.classes[0] : e.classes;
      const subj = klass
        ? Array.isArray((klass as { subjects: unknown }).subjects)
          ? (klass as { subjects: { name: string }[] }).subjects[0]
          : (klass as unknown as { subjects: { name: string } | null }).subjects
        : null;
      return [e.class_id, subj?.name ?? "Class"];
    })
  );

  // Subject-wise completion: average completion_percentage across each
  // accepted plan's items, grouped by the class's subject.
  let subjectProgress: { subject: string; percent: number }[] = [];
  let lessonsCompleted = 0;

  if (classIds.length > 0) {
    const { data: plans } = await supabase
      .from("lesson_plans")
      .select("id, class_id")
      .in("class_id", classIds)
      .eq("status", "accepted");

    const planIds = (plans ?? []).map((p) => p.id);
    const classByPlan = new Map((plans ?? []).map((p) => [p.id, p.class_id]));

    if (planIds.length > 0) {
      const { data: items } = await supabase
        .from("lesson_plan_items")
        .select("lesson_plan_id, completion_percentage")
        .in("lesson_plan_id", planIds);

      const bySubject = new Map<string, { total: number; count: number }>();
      for (const item of items ?? []) {
        const classId = classByPlan.get(item.lesson_plan_id);
        const subject = classId ? subjectByClass.get(classId) ?? "Class" : "Class";
        const bucket = bySubject.get(subject) ?? { total: 0, count: 0 };
        bucket.total += item.completion_percentage;
        bucket.count += 1;
        bySubject.set(subject, bucket);
        if (item.completion_percentage >= 100) lessonsCompleted++;
      }

      subjectProgress = Array.from(bySubject.entries()).map(([subject, b]) => ({
        subject,
        percent: b.count > 0 ? Math.round(b.total / b.count) : 0,
      }));
    }
  }

  const { count: testsCompleted } = student
    ? await supabase
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.id)
        .eq("status", "submitted")
    : { count: 0 };

  const { count: homeworkCompleted } = student
    ? await supabase
        .from("assignment_submissions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.id)
    : { count: 0 };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/student/dashboard" className="text-sm text-student-dark underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold">My Progress 🏆</h1>

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold text-ink/50">By subject</h2>
        {subjectProgress.length === 0 ? (
          <div className="mt-3">
            <EmptyState emoji="📈" title="No progress yet" body="Once your teacher accepts a lesson plan, it'll show up here." />
          </div>
        ) : (
          <div className="mt-3 space-y-4 rounded-2xl bg-white p-5 shadow-soft">
            {subjectProgress.map((s) => (
              <ProgressBar key={s.subject} label={s.subject} percent={s.percent} accent="student" />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold text-ink/50">Totals</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard icon="📚" value={lessonsCompleted} label="Lessons completed" accent="student" />
          <StatCard icon="📝" value={testsCompleted ?? 0} label="Tests completed" accent="student" />
          <StatCard icon="✏️" value={homeworkCompleted ?? 0} label="Homework completed" accent="student" />
          <StatCard icon="⭐" value={student?.xp ?? 0} label="XP earned" accent="student" />
          <StatCard icon="🔥" value={student?.streak_days ?? 0} label="Current streak" accent="student" />
        </div>
      </section>
    </main>
  );
}
