import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PracticeGame } from "@/components/PracticeGame";

export default async function PracticePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrolments } = await supabase
    .from("class_students")
    .select("class_id");

  const classIds = (enrolments ?? []).map((e) => e.class_id);

  const { data: questions } = classIds.length
    ? await supabase
        .from("questions_for_students")
        .select("id, question_type, question_text, options, marks")
        .in("class_id", classIds)
        .limit(20)
    : { data: [] };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/student/dashboard" className="text-sm text-student underline">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-bold">🎮 Practice Time</h1>
      <div className="mt-4">
        <PracticeGame questions={questions ?? []} />
      </div>
    </main>
  );
}
