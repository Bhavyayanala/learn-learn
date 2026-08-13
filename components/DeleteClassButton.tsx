"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteClassButton({ classId }: { classId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    // Best-effort cleanup of uploaded files first — deleting the class row
    // cascades the database rows (class_students, materials, lesson_plans,
    // lesson_plan_items, schedule_proposals) automatically via FK, but it
    // doesn't touch the actual files sitting in Storage.
    const { data: files } = await supabase.storage.from("materials").list(classId);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${classId}/${f.name}`);
      await supabase.storage.from("materials").remove(paths);
    }

    const { error: deleteErr } = await supabase.from("classes").delete().eq("id", classId);

    setDeleting(false);

    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }

    router.push("/teacher/classes");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-red-600 underline"
      >
        Delete this class
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">
        Delete this class permanently?
      </p>
      <p className="mt-1 text-sm text-red-700">
        This removes the class, its materials, lesson plan, and enrolled
        student records. This can&apos;t be undone.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes, delete it"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
