import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProposedItem } from "@/lib/reschedulePlanner";

export async function POST(
  req: Request,
  { params }: { params: { proposalId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'reject'." },
      { status: 400 }
    );
  }

  // RLS scopes this to proposals for lesson plans the teacher owns.
  const { data: proposal, error: proposalErr } = await supabase
    .from("schedule_proposals")
    .select("id, lesson_plan_id, triggered_by_item_id, proposed_items, status")
    .eq("id", params.proposalId)
    .single();

  if (proposalErr || !proposal) {
    return NextResponse.json(
      { error: proposalErr?.message ?? "Proposal not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  if (proposal.status !== "pending") {
    return NextResponse.json(
      { error: `This proposal was already ${proposal.status}.` },
      { status: 409 }
    );
  }

  if (action === "reject") {
    await supabase
      .from("schedule_proposals")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", proposal.id);
    return NextResponse.json({ status: "rejected" });
  }

  // ACCEPT — apply the (possibly teacher-edited) items the client sends,
  // falling back to what was originally proposed if the client didn't
  // send an edited version.
  const itemsToApply: ProposedItem[] = Array.isArray(body?.items)
    ? body.items
    : proposal.proposed_items;

  if (!proposal.triggered_by_item_id) {
    return NextResponse.json(
      { error: "The day this proposal was based on no longer exists." },
      { status: 409 }
    );
  }

  const { data: triggerItem, error: triggerErr } = await supabase
    .from("lesson_plan_items")
    .select("day_number")
    .eq("id", proposal.triggered_by_item_id)
    .single();

  if (triggerErr || !triggerItem) {
    return NextResponse.json(
      { error: "Could not find the day this proposal was based on." },
      { status: 404 }
    );
  }

  // Remove every day after the trigger day, then insert the new
  // (possibly edited) set — two separate statements, matching the same
  // pattern proven safe elsewhere in this app (RLS + sequential writes).
  const { error: deleteErr } = await supabase
    .from("lesson_plan_items")
    .delete()
    .eq("lesson_plan_id", proposal.lesson_plan_id)
    .gt("day_number", triggerItem.day_number);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  const rows = itemsToApply.map((item) => ({
    lesson_plan_id: proposal.lesson_plan_id,
    day_number: item.day_number,
    scheduled_date: item.scheduled_date,
    topic_id: item.topic_id,
    custom_title: item.custom_title,
    learning_objective: item.learning_objective,
    suggested_activities: item.suggested_activities,
    estimated_minutes: item.estimated_minutes,
    is_revision: item.is_revision,
    is_assessment: item.is_assessment,
  }));

  const { error: insertErr } = await supabase.from("lesson_plan_items").insert(rows);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await supabase
    .from("schedule_proposals")
    .update({ status: "accepted", resolved_at: new Date().toISOString() })
    .eq("id", proposal.id);

  return NextResponse.json({ status: "accepted" });
}
