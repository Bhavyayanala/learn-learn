import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// A parent links themselves to a child using the email the student
// signed up with. Same privacy shape as the enroll route: the caller's
// own identity is established through RLS first, and the admin client is
// used only for the single email lookup (a parent has no RLS visibility
// into a student they aren't linked to yet).
export async function POST(req: Request) {
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

  const { data: parent, error: parentErr } = await supabase
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (parentErr || !parent) {
    return NextResponse.json(
      { error: "Only a parent account can link a child." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  const { data: studentUser, error: lookupErr } = await admin
    .from("users")
    .select("id, role, full_name")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }

  if (!studentUser || studentUser.role !== "student") {
    return NextResponse.json(
      { error: "No student account found with that email." },
      { status: 404 }
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

  const { error: linkErr } = await admin
    .from("parent_students")
    .insert({ parent_id: parent.id, student_id: studentRow.id });

  if (linkErr) {
    if (linkErr.code === "23505") {
      return NextResponse.json(
        { error: "That child is already linked to your account." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json({
    child: { id: studentRow.id, full_name: studentUser.full_name },
  });
}
