import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentHomework } from "@/components/StudentHomework";
import { AskTeacher } from "@/components/AskTeacher";
import { NotificationBell } from "@/components/NotificationBell";
import Link from "next/link";
import { BadgeShelf } from "@/components/BadgeShelf";

export default async function StudentDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("id, grade, xp, streak_days")
    .eq("user_id", user.id)
    .single();

  // RLS already limits this to classes the student is enrolled in.
  const { data: enrolments } = await supabase
    .from("class_students")
    .select("class_id, classes(id, grade, subjects(name))")
    .limit(10);

  const classes = (enrolments ?? []).map((row) => {
    const klass = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const subjectRel = klass
      ? Array.isArray((klass as { subjects: unknown }).subjects)
        ? ((klass as { subjects: { name: string }[] }).subjects)[0]
        : ((klass as unknown as { subjects: { name: string } | null }).subjects)
      : null;
    return {
      id: row.class_id,
      subjectName: subjectRel?.name ?? "Class",
    };
  });

  const classIds = classes.map((c) => c.id);

  // Today's / next topic across the student's accepted plans.
  const { data: nextItems } = classIds.length
    ? await supabase
        .from("lesson_plan_items")
        .select("id, day_number, custom_title, learning_objective, completion_percentage, topics(name)")
        .lt("completion_percentage", 100)
        .order("day_number")
        .limit(1)
    : { data: [] };

  const nextItem = nextItems?.[0];
  const nextTopicName = nextItem
    ? nextItem.custom_title ??
      (Array.isArray(nextItem.topics)
        ? (nextItem.topics[0] as { name: string } | undefined)?.name
        : (nextItem.topics as unknown as { name: string } | null)?.name) ??
      "Your next lesson"
    : null;

  const { data: assignments } = classIds.length
    ? await supabase
        .from("assignments")
        .select("id, title, instructions, due_date, max_marks, class_id")
        .order("due_date", { ascending: true })
    : { data: [] };

  const { data: submissions } = student
    ? await supabase
        .from("assignment_submissions")
        .select("id, assignment_id, response_text, status, marks_awarded, teacher_comment")
        .eq("student_id", student.id)
    : { data: [] };

  const { data: materials } = classIds.length
    ? await supabase
        .from("materials")
        .select("id, file_name, storage_path")
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: availableTests } = classIds.length
    ? await supabase
        .from("tests")
        .select("id, title")
        .in("class_id", classIds)
    : { data: [] };

  const { data: myAttempts } = student
    ? await supabase
        .from("test_attempts")
        .select("test_id, status")
        .eq("student_id", student.id)
    : { data: [] };

  const attemptedTestIds = new Set(
    (myAttempts ?? []).filter((a) => a.status === "submitted").map((a) => a.test_id)
  );

  const { data: earnedBadges } = student
    ? await supabase
        .from("student_badges")
        .select("earned_at, badges(code, title, emoji, description)")
        .eq("student_id", student.id)
    : { data: [] };

  const badges = (earnedBadges ?? []).map((eb) => {
    const b = Array.isArray(eb.badges) ? eb.badges[0] : eb.badges;
    return {
      code: (b as { code: string })?.code ?? "",
      title: (b as { title: string })?.title ?? "",
      emoji: (b as { emoji: string })?.emoji ?? "🏅",
      description: (b as { description: string })?.description ?? "",
      earned_at: eb.earned_at,
    };
  });

  const { data: myDoubts } = student
    ? await supabase
        .from("doubts")
        .select("id, question, answer, status, created_at")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const pendingCount = (assignments ?? []).filter(
    (a) => !(submissions ?? []).some((s) => s.assignment_id === a.id)
  ).length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-3 flex justify-end">
        <NotificationBell accentColor="student" />
      </div>
      <div className="rounded-2xl border-2 border-student-light bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-medium text-student">
          Hi {user.user_metadata?.full_name ?? "there"}! 👋
        </p>
        <h1 className="mt-1 text-2xl font-bold">Ready to learn?</h1>
      </div>

      {classes.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-4xl">🎒</p>
          <p className="mt-3 font-medium">You&apos;re not in a class yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Ask your teacher to add you using your email address.
          </p>
        </div>
      ) : (
        <>
          {nextTopicName && (
            <section className="mt-6 rounded-2xl border-2 border-student bg-student-light p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-student">
                Today&apos;s Mission
              </p>
              <p className="mt-2 text-xl font-bold">🧮 {nextTopicName}</p>
              {nextItem?.learning_objective && (
                <p className="mt-2 text-sm text-slate-700">
                  {nextItem.learning_objective}
                </p>
              )}
            </section>
          )}

          <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3">
            <span className="text-sm font-bold text-amber-800">
              ⭐ {student?.xp ?? 0} XP
            </span>
            {(student?.streak_days ?? 0) > 0 && (
              <span className="text-sm font-bold text-amber-800">
                🔥 {student?.streak_days} day streak
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/student/practice"
              className="rounded-2xl border-2 border-student bg-student-light p-5 text-center"
            >
              <p className="text-3xl">🎮</p>
              <p className="mt-1 text-sm font-bold text-student">Play &amp; Practice</p>
            </Link>
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-center">
              <p className="text-3xl">✏️</p>
              <p className="mt-2 text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-slate-500">Homework to do</p>
            </div>
          </div>

          {classes.length > 0 && (
            <div className="mt-3">
              <Link
                href={`/classroom/${classes[0].id}`}
                className="block rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-center font-bold text-emerald-700"
              >
                🎥 Join Live Class
              </Link>
            </div>
          )}

          {availableTests && availableTests.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold">📝 Tests</h2>
              <ul className="mt-3 space-y-2">
                {availableTests.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 py-3"
                  >
                    <span className="text-sm font-medium">{t.title}</span>
                    {attemptedTestIds.has(t.id) ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        Done
                      </span>
                    ) : (
                      <Link
                        href={`/student/tests/${t.id}`}
                        className="rounded-lg bg-student px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Start
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-bold">✏️ My Homework</h2>
            <div className="mt-3">
              <StudentHomework
                studentId={student?.id ?? ""}
                assignments={assignments ?? []}
                initialSubmissions={submissions ?? []}
              />
            </div>
          </section>

          {materials && materials.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold">📚 Study Materials</h2>
              <ul className="mt-3 space-y-2">
                {materials.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    {m.file_name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-bold">🏆 My Badges</h2>
            <div className="mt-3">
              <BadgeShelf badges={badges} studentName={user.user_metadata?.full_name ?? "Student"} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-bold">💬 Ask Your Teacher</h2>
            <div className="mt-3">
              <AskTeacher
                studentId={student?.id ?? ""}
                classId={classes[0]?.id ?? ""}
                initialDoubts={myDoubts ?? []}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
