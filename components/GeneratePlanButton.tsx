"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GeneratePlanButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/classes/${classId}/generate-plan`, {
      method: "POST",
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not generate a lesson plan.");
      return;
    }

    router.push(`/teacher/classes/${classId}/plan`);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-xl bg-teacher px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Lesson Plan"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
