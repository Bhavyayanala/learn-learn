import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonPlanReview, type PlanItem, type Proposal } from "@/components/LessonPlanReview";

export default async function LessonPlanPage({
  params,
}: {
  params: { classId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: klass } = await supabase
    .from("classes")
    .select("id, grade, subjects(name)")
    .eq("id", params.classId)
    .single();

  if (!klass) notFound();

  const { data: plan } = await supabase
    .from("lesson_plans")
    .select("id, status")
    .eq("class_id", params.classId)
    .maybeSingle();

  if (!plan) notFound();

  const { data: items } = await supabase
    .from("lesson_plan_items")
    .select(
      "id, day_number, scheduled_date, custom_title, learning_objective, suggested_activities, estimated_minutes, is_revision, is_assessment, completion_status, completion_percentage, teacher_notes, topics(name)"
    )
    .eq("lesson_plan_id", plan.id)
    .order("day_number");

  const { data: pendingProposal } = await supabase
    .from("schedule_proposals")
    .select("id, reason, proposed_items")
    .eq("lesson_plan_id", plan.id)
    .eq("status", "pending")
    .maybeSingle();

  const subjectName = Array.isArray(klass.subjects)
    ? (klass.subjects[0] as { name: string } | undefined)?.name
    : (klass.subjects as unknown as { name: string } | null)?.name;

  const planItems: PlanItem[] = (items ?? []).map((row) => {
    const topicName = Array.isArray(row.topics)
      ? (row.topics[0] as { name: string } | undefined)?.name
      : (row.topics as unknown as { name: string } | null)?.name;
    return {
      id: row.id,
      day_number: row.day_number,
      scheduled_date: row.scheduled_date,
      title: row.custom_title ?? topicName ?? "Untitled",
      learning_objective: row.learning_objective,
      suggested_activities: row.suggested_activities,
      estimated_minutes: row.estimated_minutes,
      is_revision: row.is_revision,
      is_assessment: row.is_assessment,
      completion_status: row.completion_status,
      completion_percentage: row.completion_percentage,
      teacher_notes: row.teacher_notes,
    };
  });

  const proposal: Proposal = pendingProposal
    ? {
        id: pendingProposal.id,
        reason: pendingProposal.reason,
        proposed_items: pendingProposal.proposed_items,
      }
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/teacher/classes/${params.classId}`}
        className="text-sm text-teacher underline"
      >
        ← Back to class
      </Link>

      <div className="mt-3">
        <p className="text-sm font-medium text-teacher">
          {klass.grade} · {subjectName ?? "Subject"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Monthly Lesson Plan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Review each day below. Edit anything that doesn&apos;t fit, then
          accept the plan to make it the class&apos;s active schedule. Once
          accepted, mark each day&apos;s completion after class to keep the
          schedule realistic.
        </p>
      </div>

      <div className="mt-6">
        <LessonPlanReview
          planId={plan.id}
          status={plan.status as "draft" | "accepted"}
          items={planItems}
          initialProposal={proposal}
        />
      </div>
    </main>
  );
}
