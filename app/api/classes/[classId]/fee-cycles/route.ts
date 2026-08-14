import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Creates (or refreshes) this month's fee cycle for every student
// enrolled in a class. Master prompt sections 26-27: once the planned
// number of classes is completed, the cycle flips to 'due'.
export async function POST(
  req: Request,
  { params }: { params: { classId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const periodLabel: string =
    typeof body?.period_label === "string" && body.period_label
      ? body.period_label
      : new Date().toISOString().slice(0, 7); // YYYY-MM

  // RLS scopes this — a hit proves ownership.
  const { data: klass, error: classErr } = await supabase
    .from("classes")
    .select("id, classes_per_month, monthly_fee")
    .eq("id", params.classId)
    .single();

  if (classErr || !klass) {
    return NextResponse.json(
      { error: "Class not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  if (klass.monthly_fee === null) {
    return NextResponse.json(
      { error: "Set a monthly fee on this class before generating fee cycles." },
      { status: 422 }
    );
  }

  const { data: enrolled } = await supabase
    .from("class_students")
    .select("student_id")
    .eq("class_id", klass.id);

  if (!enrolled || enrolled.length === 0) {
    return NextResponse.json(
      { error: "No students are enrolled in this class yet." },
      { status: 422 }
    );
  }

  // How many classes have actually been completed this cycle?
  const { data: plan } = await supabase
    .from("lesson_plans")
    .select("id")
    .eq("class_id", klass.id)
    .maybeSingle();

  let completed = 0;
  if (plan) {
    const { data: items } = await supabase
      .from("lesson_plan_items")
      .select("completion_percentage")
      .eq("lesson_plan_id", plan.id);
    completed = (items ?? []).filter((i) => i.completion_percentage >= 100).length;
  }

  const status = completed >= klass.classes_per_month ? "due" : "active";

  const rows = enrolled.map((e) => ({
    class_id: klass.id,
    student_id: e.student_id,
    period_label: periodLabel,
    classes_planned: klass.classes_per_month,
    classes_completed: completed,
    amount: klass.monthly_fee as number,
    status,
  }));

  // Upsert so re-running refreshes the completed count and status
  // rather than erroring on the unique constraint. Paid cycles are
  // preserved below.
  const { data: existing } = await supabase
    .from("fee_cycles")
    .select("id, student_id, status")
    .eq("class_id", klass.id)
    .eq("period_label", periodLabel);

  const paidStudents = new Set(
    (existing ?? []).filter((c) => c.status === "paid").map((c) => c.student_id)
  );

  const toUpsert = rows.filter((r) => !paidStudents.has(r.student_id));

  const { error: upsertErr } = await supabase
    .from("fee_cycles")
    .upsert(toUpsert, { onConflict: "class_id,student_id,period_label" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    period: periodLabel,
    cyclesCreated: toUpsert.length,
    classesCompleted: completed,
    status,
  });
}
