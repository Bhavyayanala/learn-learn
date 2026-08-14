import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Agenda, type AgendaItem } from "@/components/Agenda";

export default async function TeacherCalendarPage() {
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
        .select("id, grade, subjects(name)")
        .eq("teacher_id", teacher.id)
    : { data: [] };

  const classIds = (classes ?? []).map((c) => c.id);
  const subjectByClass = new Map(
    (classes ?? []).map((c) => {
      const subjectName = Array.isArray(c.subjects)
        ? (c.subjects[0] as { name: string } | undefined)?.name
        : (c.subjects as unknown as { name: string } | null)?.name;
      return [c.id, `${c.grade} · ${subjectName ?? "Class"}`];
    })
  );

  const today = new Date().toISOString().slice(0, 10);
  const items: AgendaItem[] = [];

  if (classIds.length > 0) {
    const { data: planItems } = await supabase
      .from("lesson_plan_items")
      .select("scheduled_date, custom_title, topics(name), lesson_plans(class_id)")
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", today);

    for (const row of planItems ?? []) {
      const plan = Array.isArray(row.lesson_plans) ? row.lesson_plans[0] : row.lesson_plans;
      const classId = (plan as { class_id?: string } | null)?.class_id;
      if (!classId || !classIds.includes(classId)) continue;
      const topicName = Array.isArray(row.topics)
        ? (row.topics[0] as { name: string } | undefined)?.name
        : (row.topics as unknown as { name: string } | null)?.name;
      items.push({
        date: row.scheduled_date as string,
        label: `${subjectByClass.get(classId) ?? "Class"} — ${row.custom_title ?? topicName ?? "Lesson"}`,
        kind: "class",
      });
    }

    const { data: assignments } = await supabase
      .from("assignments")
      .select("due_date, title, class_id")
      .not("due_date", "is", null)
      .gte("due_date", today)
      .in("class_id", classIds);

    for (const a of assignments ?? []) {
      items.push({
        date: a.due_date as string,
        label: `${subjectByClass.get(a.class_id) ?? "Class"} — ${a.title} due`,
        kind: "assignment_due",
      });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/teacher/dashboard" className="text-sm text-teacher underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Upcoming</h1>
      <p className="mt-1 text-sm text-slate-500">
        Scheduled classes and assignment due dates across all your classes.
      </p>
      <div className="mt-6">
        <Agenda items={items} />
      </div>
    </main>
  );
}
