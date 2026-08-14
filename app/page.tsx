import Link from "next/link";

const FEATURES = [
  {
    emoji: "🧑‍🏫",
    title: "Smart Lesson Planning",
    body: "Tell LearnNest the grade, subject, and how many classes you have — it proposes a full month's teaching plan, foundational topics first, with revision and assessment days built in. You review, edit, and accept before anything goes live.",
  },
  {
    emoji: "🔄",
    title: "Adaptive Rescheduling",
    body: "After each class, just say how much you covered. If a topic ran over, LearnNest proposes a schedule adjustment — never applied automatically, always your call to accept, edit, or keep the original.",
  },
  {
    emoji: "📊",
    title: "Student Progress",
    body: "Attendance, homework, and syllabus completion tracked automatically as you teach — no spreadsheets, no manual tallying.",
  },
  {
    emoji: "👪",
    title: "Parent Dashboard",
    body: "Parents see their child's attendance, homework, and grades in one place — without being shown the child's private questions to their teacher.",
  },
  {
    emoji: "💳",
    title: "Automatic Fee Tracking",
    body: "Fee cycles track themselves against classes completed, so you always know who's paid and who's due — no more chasing spreadsheets at month end.",
  },
  {
    emoji: "💬",
    title: "Ask Teacher",
    body: "Students can ask questions right from their dashboard — quick, safe, and only between them and you.",
  },
];

const STEPS = [
  { n: "1", t: "Create a class", d: "Pick grade, subject, classes per month, and duration." },
  { n: "2", t: "Get a proposed plan", d: "LearnNest drafts the month's lessons from a real syllabus catalog." },
  { n: "3", t: "Teach and check in", d: "After each class, log how much you covered." },
  { n: "4", t: "Everything else follows", d: "Progress, fees, and schedule adjustments update themselves." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-24 text-center">
        <p className="text-sm font-medium text-teacher">LearnNest</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Make Every Tuition Class More Interactive.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Teach, play, track progress, and manage your entire tuition class
          from one simple platform.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-xl bg-teacher px-6 py-3 font-medium text-white shadow hover:opacity-90"
          >
            Start Teaching
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Log In
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-teacher text-white font-semibold">
                  {s.n}
                </div>
                <p className="mt-3 font-medium">{s.t}</p>
                <p className="mt-1 text-sm text-slate-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-semibold">
            Everything a tuition class needs
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 p-6"
              >
                <p className="text-3xl">{f.emoji}</p>
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-teacher-light py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-semibold">
            The platform should do the admin work. You do the teaching.
          </h2>
          <p className="mt-3 text-slate-600">
            Free to start. Built for individual tutors and small tuition
            classes.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-xl bg-teacher px-6 py-3 font-medium text-white shadow hover:opacity-90"
          >
            Start Teaching Free
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-400">
        LearnNest — a tuition management platform.
      </footer>
    </main>
  );
}
