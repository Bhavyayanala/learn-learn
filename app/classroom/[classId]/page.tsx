import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLiveKitToken, roomNameForClass } from "@/lib/livekit";
import { LiveClassroom } from "@/components/LiveClassroom";

export default async function ClassroomPage({
  params,
}: {
  params: { classId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Same authorization shape as /api/classes/[classId]/live/token:
  // a successful SELECT under RLS is the proof of access, not a
  // separate permission check that could drift out of sync with the
  // rest of the app's access rules.
  const { data: klass } = await supabase
    .from("classes")
    .select("id, grade, subjects(name)")
    .eq("id", params.classId)
    .maybeSingle();

  let isTeacher = false;
  let authorized = false;

  if (klass) {
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

  if (!authorized) notFound();

  const livekitUrl = process.env.LIVEKIT_URL;
  if (!livekitUrl) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-slate-500">
          Live classroom isn&apos;t configured on this server yet.
        </p>
      </main>
    );
  }

  const fullName = (user.user_metadata as { full_name?: string })?.full_name ?? "Participant";
  const token = await createLiveKitToken({
    roomName: roomNameForClass(params.classId),
    identity: user.id,
    name: fullName,
    isTeacher,
  });

  const backHref = isTeacher
    ? `/teacher/classes/${params.classId}`
    : "/student/dashboard";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href={backHref} className="text-sm text-slate-500 underline">
        ← Back
      </Link>
      <div className="mt-3">
        <LiveClassroom token={token} serverUrl={livekitUrl} isTeacher={isTeacher} />
      </div>
    </main>
  );
}
