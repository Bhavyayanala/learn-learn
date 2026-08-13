import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateCompletion, type PlanItemRow } from "@/lib/reschedulePlanner";

function statusFromPercentage(pct: number): "not_started" | "in_progress" | "completed" {
  if (pct >= 100) return "completed";
  if (pct <= 0) return "not_started";
  return "in_progress";
}

export async function POST(
  req: Request,
  { params }: { params: { itemId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const percentage = Number(body?.percentage);
  const notes = typeof body?.notes === "string" ? body.notes : null;

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return NextResponse.json(
      { error: "percentage must be a number between 0 and 100." },
      { status: 400 }
    );
  }

  // RLS scopes this to items the logged-in teacher owns.
  const { data: item, error: itemErr } = await supabase
    .from("lesson_plan_items")
    .update({
      completion_percentage: percentage,
      completion_status: statusFromPercentage(percentage),
      teacher_notes: notes,
    })
    .eq("id", params.itemId)
    .select("id, lesson_plan_id, day_number, topic_id, custom_title, learning_objective, suggested_activities, estimated_minutes, is_revision, is_assessment")
    .single();

  if (itemErr || !item) {
    return NextResponse.json(
      { error: itemErr?.message ?? "Item not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  // Fetch the full plan (with topic names resolved) to evaluate reschedule impact.
  const { data: allItems, error: allErr } = await supabase
    .from("lesson_plan_items")
    .select(
      "id, day_number, scheduled_date, topic_id, custom_title, learning_objective, suggested_activities, estimated_minutes, is_revision, is_assessment, topics(name)"
    )
    .eq("lesson_plan_id", item.lesson_plan_id)
    .order("day_number");

  if (allErr || !allItems) {
    return NextResponse.json({ error: allErr?.message ?? "Could not load plan." }, { status: 500 });
  }

  const rows: PlanItemRow[] = allItems.map((row) => {
    const topicName = Array.isArray(row.topics)
      ? (row.topics[0] as { name: string } | undefined)?.name
      : (row.topics as unknown as { name: string } | null)?.name;
    return {
      id: row.id,
      day_number: row.day_number,
      scheduled_date: row.scheduled_date,
      topic_id: row.topic_id,
      custom_title: row.custom_title,
      title: row.custom_title ?? topicName ?? "Untitled",
      learning_objective: row.learning_objective,
      suggested_activities: row.suggested_activities,
      estimated_minutes: row.estimated_minutes,
      is_revision: row.is_revision,
      is_assessment: row.is_assessment,
    };
  });

  const evaluation = evaluateCompletion(rows, item.id, percentage);

  if (!evaluation.needsReschedule) {
    return NextResponse.json({ proposal: null });
  }

  // Clear out any earlier pending proposal for this plan before creating
  // a new one — only one live proposal per plan at a time.
  await supabase
    .from("schedule_proposals")
    .delete()
    .eq("lesson_plan_id", item.lesson_plan_id)
    .eq("status", "pending");

  const { data: proposal, error: proposalErr } = await supabase
    .from("schedule_proposals")
    .insert({
      lesson_plan_id: item.lesson_plan_id,
      triggered_by_item_id: item.id,
      reason: evaluation.reason,
      proposed_items: evaluation.proposedItems,
      status: "pending",
    })
    .select("id, reason, proposed_items")
    .single();

  if (proposalErr || !proposal) {
    return NextResponse.json(
      { error: proposalErr?.message ?? "Could not create schedule proposal." },
      { status: 500 }
    );
  }

  return NextResponse.json({ proposal });
}
