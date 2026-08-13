import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLessonPlan, type Topic } from "@/lib/lessonPlanner";

export async function POST(
  _req: Request,
  { params }: { params: { classId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // RLS scopes this select to classes the logged-in teacher owns, so a
  // successful fetch here already proves ownership.
  const { data: klass, error: classErr } = await supabase
    .from("classes")
    .select("id, subject_id, grade, classes_per_month, duration_minutes, start_date, days_of_week")
    .eq("id", params.classId)
    .single();

  if (classErr || !klass) {
    return NextResponse.json(
      { error: "Class not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  const { data: topics, error: topicsErr } = await supabase
    .from("topics")
    .select("id, sequence_order, name, learning_objective, suggested_activities, is_foundational")
    .eq("subject_id", klass.subject_id)
    .eq("grade", klass.grade)
    .order("sequence_order");

  if (topicsErr) {
    return NextResponse.json({ error: topicsErr.message }, { status: 500 });
  }

  if (!topics || topics.length === 0) {
    return NextResponse.json(
      {
        error:
          "No syllabus topics found for this subject and grade yet. An admin needs to add topics before a plan can be generated.",
      },
      { status: 422 }
    );
  }

  const draftItems = generateLessonPlan({
    classesPerMonth: klass.classes_per_month,
    durationMinutes: klass.duration_minutes,
    startDate: klass.start_date,
    daysOfWeek: klass.days_of_week ?? [],
    topics: topics as Topic[],
  });

  // Replace any existing draft/accepted plan for this class with a fresh
  // one — regenerating supersedes the old proposal. (Cascades delete the
  // old lesson_plan_items via FK.)
  await supabase.from("lesson_plans").delete().eq("class_id", klass.id);

  const { data: plan, error: planErr } = await supabase
    .from("lesson_plans")
    .insert({ class_id: klass.id, status: "draft" })
    .select("id")
    .single();

  if (planErr || !plan) {
    return NextResponse.json(
      { error: planErr?.message ?? "Could not create the lesson plan." },
      { status: 500 }
    );
  }

  const rows = draftItems.map((item) => ({
    lesson_plan_id: plan.id,
    ...item,
  }));

  const { error: itemsErr } = await supabase.from("lesson_plan_items").insert(rows);

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ planId: plan.id });
}
