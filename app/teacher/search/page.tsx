import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherSearch } from "@/components/TeacherSearch";

export default async function TeacherSearchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/teacher/dashboard" className="text-sm text-teacher underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Search</h1>
      <div className="mt-6">
        <TeacherSearch />
      </div>
    </main>
  );
}
