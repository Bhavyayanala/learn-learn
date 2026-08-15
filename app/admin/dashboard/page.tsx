import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Authoritative check against the live database, not JWT metadata —
  // see the comment in middleware.ts for why. Anyone not actually
  // role='admin' in the database gets bounced, regardless of what their
  // session claims.
  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") {
    redirect("/login");
  }

  const [
    { count: teacherCount },
    { count: studentCount },
    { count: parentCount },
    { count: classCount },
    { data: payments },
  ] = await Promise.all([
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("parents").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("amount, status"),
  ]);

  const totalCollected = (payments ?? [])
    .filter((p) => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);

  const { data: classes } = await supabase
    .from("classes")
    .select("id, grade, subjects(name), teachers(users(full_name))")
    .order("created_at", { ascending: false })
    .limit(20);

  function resolveTeacherName(rel: unknown): string {
    const t = Array.isArray(rel) ? rel[0] : rel;
    const u = t ? (t as { users: unknown }).users : null;
    const uu = Array.isArray(u) ? u[0] : u;
    return (uu as { full_name?: string } | null)?.full_name ?? "Unknown";
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-medium text-slate-500">Admin</p>
      <h1 className="mt-1 text-2xl font-semibold">Platform Overview</h1>
      <p className="mt-2 text-sm text-slate-500">
        Read-only oversight — this dashboard doesn&apos;t edit anything.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Teachers", value: teacherCount ?? 0 },
          { label: "Students", value: studentCount ?? 0 },
          { label: "Parents", value: parentCount ?? 0 },
          { label: "Classes", value: classCount ?? 0 },
          { label: "Collected", value: `₹${totalCollected}` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-xl font-semibold">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-600">Recent classes</h2>
        <ul className="mt-3 space-y-2">
          {(classes ?? []).map((c) => {
            const subjectName = Array.isArray(c.subjects)
              ? (c.subjects[0] as { name: string } | undefined)?.name
              : (c.subjects as unknown as { name: string } | null)?.name;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <span>
                  {c.grade} · {subjectName ?? "Subject"}
                </span>
                <span className="text-xs text-slate-400">
                  {resolveTeacherName(c.teachers)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
