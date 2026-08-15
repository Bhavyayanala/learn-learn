import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLiveKitToken, roomNameForClass } from "@/lib/livekit";

// Authorization here relies on the SAME RLS policies as the rest of the
// app, not a duplicate permission check: a plain SELECT against
// `classes` succeeds only for the owning teacher (proving teacher
// status), and a SELECT against `class_students` filtered to this class
// succeeds only if the row belongs to the caller's own student record
// (proving enrollment). Neither query needs elevated privileges — if
// RLS says no, this route says no, automatically staying in sync with
// every other access rule already tested in this app.
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

  const fullName = (user.user_metadata as { full_name?: string })?.full_name ?? "Participant";

  const { data: ownedClass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.classId)
    .maybeSingle();

  let isTeacher = false;
  let authorized = false;

  if (ownedClass) {
    isTeacher = true;
    authorized = true;
  } else {
    const { data: enrollment } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("class_id", params.classId)
      .maybeSingle();
    authorized = !!enrollment;
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "You don't have access to this class's live room." },
      { status: 403 }
    );
  }

  const livekitUrl = process.env.LIVEKIT_URL;
  if (!livekitUrl) {
    return NextResponse.json(
      { error: "Live classroom isn't configured on this server yet." },
      { status: 503 }
    );
  }

  try {
    const roomName = roomNameForClass(params.classId);
    const token = await createLiveKitToken({
      roomName,
      identity: user.id,
      name: fullName,
      isTeacher,
    });

    return NextResponse.json({ token, url: livekitUrl, roomName, isTeacher });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create a room token." },
      { status: 500 }
    );
  }
}
