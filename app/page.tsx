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
    body: "After each class, just say how much you covered. If a topic ran over, LearnNest proposes a schedule adjustment — never applied automatically, always your call.",
  },
  {
    emoji: "🎥",
    title: "Live Classroom + Whiteboard",
    body: "Real video, real-time collaborative drawing — teach exactly like you would in person, without switching between five different apps.",
  },
  {
    emoji: "📊",
    title: "Progress That Tracks Itself",
    body: "Attendance, homework, and syllabus completion tracked automatically as you teach — no spreadsheets, no manual tallying.",
  },
  {
    emoji: "👪",
    title: "Parent Dashboard",
    body: "Parents see attendance, homework, and grades in one place — without being shown their child's private questions to the teacher.",
  },
  {
    emoji: "💳",
    title: "Fees That Track Themselves",
    body: "Fee cycles track against classes completed, so you always know who's paid and who's due.",
  },
];

const STEPS = [
  { n: "1", t: "Create a class", d: "Grade, subject, classes per month, duration." },
  { n: "2", t: "Get a proposed plan", d: "Drafted from a real syllabus catalog." },
  { n: "3", t: "Teach and check in", d: "Log how much you covered after each class." },
  { n: "4", t: "Everything else follows", d: "Progress, fees, and schedule adjustments update themselves." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper">
      {/* Hero */}
      <section className="dot-grid relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-teacher/15 bg-white px-4 py-1.5 text-xs font-medium text-teacher shadow-soft">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-teacher text-[9px] font-bold text-white">
              L
            </span>
            LearnNest
          </div>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Make every tuition
            <br />
            class <span className="text-teacher">more interactive.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink/60">
            Teach, play, track progress, and manage your entire tuition class
            from one simple platform — built to do the admin work so you can
            do the teaching.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-teacher px-7 py-3.5 font-medium text-white shadow-lift transition-transform hover:-translate-y-0.5"
            >
              Start Teaching Free
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-ink/10 bg-white px-7 py-3.5 font-medium text-ink hover:border-ink/20"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-ink/5 bg-white py-20">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink/40">
            How it works
          </p>
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-teacher font-display font-semibold text-white shadow-soft">
                  {s.n}
                </div>
                <p className="mt-4 font-medium">{s.t}</p>
                <p className="mt-1 text-sm text-ink/50">{s.d}</p>
                {i < STEPS.length - 1 && (
                  <div className="absolute right-[-14px] top-5 hidden text-ink/15 sm:block">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink/40">
            Everything included
          </p>
          <h2 className="mt-3 text-center font-display text-3xl font-semibold">
            Built for how tuition actually runs
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-ink/8 bg-white p-6 shadow-soft transition-shadow hover:shadow-lift"
              >
                <p className="text-3xl">{f.emoji}</p>
                <p className="mt-4 font-display font-semibold">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/55">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="dot-grid bg-teacher-light py-20 text-center">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="font-display text-3xl font-semibold leading-tight text-teacher-dark">
            The platform does the admin work.
            <br />
            You do the teaching.
          </h2>
          <p className="mt-3 text-ink/60">
            Free to start. Built for individual tutors and small tuition
            classes.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-block rounded-xl bg-teacher px-8 py-3.5 font-medium text-white shadow-lift transition-transform hover:-translate-y-0.5"
          >
            Start Teaching Free
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-ink/35">
        LearnNest — a tuition management platform.
      </footer>
    </main>
  );
}
