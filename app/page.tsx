import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">LearnNest</h1>
      <p className="max-w-md text-slate-600">
        Make every tuition class more interactive. Teach, play, track
        progress, and manage your class from one simple platform.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-xl bg-teacher px-6 py-3 font-medium text-white shadow hover:opacity-90"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Log In
        </Link>
      </div>
    </main>
  );
}
