import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "An email address is required." }, { status: 400 });
  }

  // Confirm the caller actually owns this class before doing anything.
  // RLS scopes this select, so a hit proves ownership.
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

  // Look up the student by email. This needs the admin client: a teacher
  // has no RLS visibility into a student who isn't enrolled with them yet
  // (correctly so — they shouldn't be able to browse all users). We've
  // already verified class ownership above, and we only ever return
  // whether the lookup succeeded, never arbitrary user data.
  const admin = createAdminClient();

  const { data: studentUser, error: lookupErr } = await admin
    .from("users")
    .select("id, role, full_name")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }

  if (!studentUser) {
    return NextResponse.json(
      { error: "No account found with that email. The student needs to sign up first." },
      { status: 404 }
    );
  }

  if (studentUser.role !== "student") {
    return NextResponse.json(
      { error: "That account isn't a student account." },
      { status: 400 }
    );
  }

  const { data: studentRow, error: studentErr } = await admin
    .from("students")
    .select("id")
    .eq("user_id", studentUser.id)
    .single();

  if (studentErr || !studentRow) {
    return NextResponse.json(
      { error: "That student account is missing its student profile." },
      { status: 500 }
    );
  }

  const { error: enrollErr } = await supabase
    .from("class_students")
    .insert({ class_id: klass.id, student_id: studentRow.id });

  if (enrollErr) {
    if (enrollErr.code === "23505") {
      return NextResponse.json(
        { error: "That student is already enrolled in this class." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  }

  return NextResponse.json({
    student: { id: studentRow.id, full_name: studentUser.full_name },
  });
}
