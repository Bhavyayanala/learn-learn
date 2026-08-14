import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Creates (or reuses) a class session for a given date, and seeds an
// attendance row for every enrolled student so the teacher just toggles
// statuses rather than adding rows one by one.
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
  const sessionDate: string =
    typeof body?.session_date === "string" && body.session_date
      ? body.session_date
      : new Date().toISOString().slice(0, 10);
  const lessonPlanItemId: string | null = body?.lesson_plan_item_id ?? null;

  // RLS scopes this — a hit proves the caller owns the class.
  const { data: klass, error: classErr } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.classId)
    .single();

  if (classErr || !klass) {
    return NextResponse.json(
      { error: "Class not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  // Reuse an existing session for this date if there is one, so hitting
  // "take attendance" twice doesn't create duplicates.
  const { data: existing } = await supabase
    .from("class_sessions")
    .select("id")
    .eq("class_id", klass.id)
    .eq("session_date", sessionDate)
    .maybeSingle();

  let sessionId = existing?.id;

  if (!sessionId) {
    const { data: created, error: createErr } = await supabase
      .from("class_sessions")
      .insert({
        class_id: klass.id,
        session_date: sessionDate,
        lesson_plan_item_id: lessonPlanItemId,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message ?? "Could not create the session." },
        { status: 500 }
      );
    }
    sessionId = created.id;
  }

  // Seed attendance rows for enrolled students who don't have one yet.
  const { data: enrolled } = await supabase
    .from("class_students")
    .select("student_id")
    .eq("class_id", klass.id);

  const { data: existingAttendance } = await supabase
    .from("attendance")
    .select("student_id")
    .eq("class_session_id", sessionId);

  const alreadyHas = new Set((existingAttendance ?? []).map((a) => a.student_id));
  const missing = (enrolled ?? [])
    .map((e) => e.student_id)
    .filter((id) => !alreadyHas.has(id));

  if (missing.length > 0) {
    const { error: seedErr } = await supabase.from("attendance").insert(
      missing.map((student_id) => ({
        class_session_id: sessionId,
        student_id,
        status: "present",
      }))
    );
    if (seedErr) {
      return NextResponse.json({ error: seedErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ sessionId });
}
