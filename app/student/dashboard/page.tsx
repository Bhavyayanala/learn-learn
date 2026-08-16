import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudentHomework } from "@/components/StudentHomework";
import { AskTeacher } from "@/components/AskTeacher";
import { BadgeShelf } from "@/components/BadgeShelf";
import { ScrollToHash } from "@/components/ScrollToHash";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";

function materialIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm"].includes(ext)) return "🎥";
  if (["mp3", "wav", "m4a"].includes(ext)) return "🔊";
  if (["pdf"].includes(ext)) return "📕";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📄";
  return "📎";
}

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

  const pendingAssignments = (assignments ?? []).filter(
    (a) => !(submissions ?? []).some((s) => s.assignment_id === a.id)
  );
  const pendingCount = pendingAssignments.length;
  const pendingTestCount = (availableTests ?? []).filter((t) => !attemptedTestIds.has(t.id)).length;

  const subjectNames = Array.from(new Set(classes.map((c) => c.subjectName)));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <ScrollToHash />

      {/* TOP: greeting + streak/goal */}
      <div className="rounded-3xl border-2 border-student-light bg-white p-6 text-center shadow-soft">
        <p className="text-lg font-medium text-student-dark">
          Hi {user.user_metadata?.full_name ?? "there"}! 👋
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">Ready to learn something new today?</h1>

        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
            ⭐ {student?.xp ?? 0} XP
          </span>
          {(student?.streak_days ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-bold text-orange-700">
              🔥 {student?.streak_days}-day streak
            </span>
          )}
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            emoji="🎒"
            title="You're not in a class yet"
            body="Ask your teacher to add you using your email address."
          />
        </div>
      ) : (
        <>
          {/* MAIN: Continue Learning — the single most prominent action */}
          {nextTopicName && (
            <section className="mt-6 overflow-hidden rounded-3xl border-2 border-student bg-student-light p-6 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wide text-student-dark">
                Continue Learning
              </p>
              <p className="mt-2 font-display text-xl font-bold">🧮 {nextTopicName}</p>
              {nextItem?.learning_objective && (
                <p className="mt-2 text-sm text-ink/70">{nextItem.learning_objective}</p>
              )}
              <Link
                href={`/classroom/${classes[0].id}`}
                className="mt-4 inline-block rounded-xl bg-student px-5 py-2.5 text-sm font-bold text-white shadow-soft"
              >
                Continue Learning →
              </Link>
            </section>
          )}

          {/* MAIN: today's classes / practice — equal-weight quick actions */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/student/practice"
              className="rounded-2xl border-2 border-student bg-white p-5 text-center shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <p className="text-3xl">🎮</p>
              <p className="mt-1 text-sm font-bold text-student-dark">Practice</p>
              <p className="text-[11px] text-ink/45">Play &amp; improve</p>
            </Link>
            <Link
              href={`/classroom/${classes[0].id}`}
              className="rounded-2xl border-2 border-emerald-400 bg-white p-5 text-center shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <p className="text-3xl">🎥</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">Join Class</p>
              <p className="text-[11px] text-ink/45">Live now</p>
            </Link>
          </div>

          {/* MAIN: Upcoming Test + Pending Homework at a glance */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-bold text-rose-600">{pendingTestCount}</p>
              <p className="text-xs text-ink/50">Test{pendingTestCount === 1 ? "" : "s"} waiting</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-ink/50">Homework to do</p>
            </div>
          </div>

          {/* Subjects strip */}
          {subjectNames.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-bold">📚 My Subjects</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {subjectNames.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-ink/10 bg-white px-4 py-1.5 text-sm font-medium shadow-soft"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Tests */}
          <section id="voice-tests-section" className="mt-6 scroll-mt-20">
            <h2 className="font-display text-lg font-bold">📝 Tests</h2>
            {!availableTests || availableTests.length === 0 ? (
              <div className="mt-3">
                <EmptyState emoji="🎯" title="No tests right now" body="You're ready for your next challenge!" />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {availableTests.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-2xl border-2 border-ink/8 bg-white px-4 py-3 shadow-soft"
                  >
                    <span className="text-sm font-medium">{t.title}</span>
                    {attemptedTestIds.has(t.id) ? (
                      <StatusPill variant="success">✓ Done</StatusPill>
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
            )}
          </section>

          {/* Homework */}
          <section id="voice-homework-section" className="mt-6 scroll-mt-20">
            <h2 className="font-display text-lg font-bold">✏️ My Homework</h2>
            {!assignments || assignments.length === 0 ? (
              <div className="mt-3">
                <EmptyState emoji="🎉" title="You're all caught up!" body="No homework waiting for you." />
              </div>
            ) : (
              <div className="mt-3">
                <StudentHomework
                  studentId={student?.id ?? ""}
                  assignments={assignments}
                  initialSubmissions={submissions ?? []}
                />
              </div>
            )}
          </section>

          {/* Study Materials as resource cards */}
          <section id="voice-materials-section" className="mt-6 scroll-mt-20">
            <h2 className="font-display text-lg font-bold">📖 Study Materials</h2>
            {!materials || materials.length === 0 ? (
              <div className="mt-3">
                <EmptyState emoji="📚" title="Nothing here yet" body="Your teacher hasn't added materials yet." />
              </div>
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {materials.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-2xl border-2 border-ink/8 bg-white px-4 py-3 shadow-soft"
                  >
                    <span className="text-2xl">{materialIcon(m.file_name)}</span>
                    <span className="truncate text-sm font-medium">{m.file_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* BOTTOM: achievements/progress */}
          <section id="voice-progress-section" className="mt-6 scroll-mt-20">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">🏆 My Achievements</h2>
              <Link href="/student/progress" className="text-sm font-medium text-student-dark underline">
                See full progress →
              </Link>
            </div>
            <div className="mt-3">
              <BadgeShelf badges={badges} studentName={user.user_metadata?.full_name ?? "Student"} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-lg font-bold">💬 Ask Your Teacher</h2>
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
