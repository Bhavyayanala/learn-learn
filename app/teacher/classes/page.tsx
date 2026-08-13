import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherClassesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: classes } = teacher
    ? await supabase
        .from("classes")
        .select("id, grade, classes_per_month, duration_minutes, monthly_fee, subjects(name)")
        .eq("teacher_id", teacher.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-teacher">Your Classes</p>
          <h1 className="mt-1 text-2xl font-semibold">Tuition Classes</h1>
        </div>
        <Link
          href="/teacher/classes/new"
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New Class
        </Link>
      </div>

      {!classes || classes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          <p>You haven&apos;t created a tuition class yet.</p>
          <Link
            href="/teacher/classes/new"
            className="mt-3 inline-block text-teacher underline"
          >
            Create your first class
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {classes.map((c) => {
            const subjectName = Array.isArray(c.subjects)
              ? (c.subjects[0] as { name: string } | undefined)?.name
              : (c.subjects as unknown as { name: string } | null)?.name;
            return (
              <li key={c.id}>
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="block rounded-2xl border border-teacher-light bg-white p-5 shadow-sm transition hover:border-teacher"
                >
                  <p className="font-semibold">
                    {c.grade} — {subjectName ?? "Subject"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.classes_per_month} classes/month · {c.duration_minutes} min each
                    {c.monthly_fee ? ` · ₹${c.monthly_fee}/month` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
