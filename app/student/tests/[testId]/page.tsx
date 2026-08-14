import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TakeTest } from "@/components/TakeTest";

export default async function TestPage({ params }: { params: { testId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: test } = await supabase
    .from("tests")
    .select("id, title")
    .eq("id", params.testId)
    .single();

  if (!test) notFound();

  const { data: questions } = await supabase
    .from("test_questions_for_students")
    .select("test_id, sequence_order, question_id, question_type, question_text, options, marks")
    .eq("test_id", test.id)
    .order("sequence_order");

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/student/dashboard" className="text-sm text-student underline">
        ← Back
      </Link>
      <div className="mt-4">
        <TakeTest testId={test.id} title={test.title} questions={questions ?? []} />
      </div>
    </main>
  );
}
