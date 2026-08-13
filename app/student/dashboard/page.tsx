import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StudentDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-center">
      <div className="rounded-2xl border border-student-light bg-white p-8 shadow-sm">
        <p className="text-lg font-medium text-student">
          Hi {user.user_metadata?.full_name ?? "there"}! 👋
        </p>
        <h1 className="mt-1 text-2xl font-bold">Ready to learn?</h1>
        <p className="mt-2 text-slate-500">
          Your games, lessons, and badges will show up here soon!
        </p>
      </div>
    </main>
  );
}
