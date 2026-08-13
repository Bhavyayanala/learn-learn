"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Subject = { id: string; name: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function NewClassPage() {
  const router = useRouter();
  const supabase = createClient();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [grade, setGrade] = useState("Class 4");
  const [classesPerMonth, setClassesPerMonth] = useState(12);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [monthlyFee, setMonthlyFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("subjects")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) {
          setSubjects(data);
          if (data[0]) setSubjectId(data[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDay(day: string) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { data: teacher, error: teacherErr } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherErr || !teacher) {
      setError("Could not find your teacher profile.");
      setLoading(false);
      return;
    }

    const { data: newClass, error: insertErr } = await supabase
      .from("classes")
      .insert({
        teacher_id: teacher.id,
        subject_id: subjectId,
        grade,
        classes_per_month: classesPerMonth,
        duration_minutes: durationMinutes,
        monthly_fee: monthlyFee ? Number(monthlyFee) : null,
        start_date: startDate || null,
        days_of_week: days,
      })
      .select("id")
      .single();

    setLoading(false);

    if (insertErr || !newClass) {
      setError(insertErr?.message ?? "Could not create the class.");
      return;
    }

    router.push(`/teacher/classes/${newClass.id}`);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="text-sm font-medium text-teacher">New Tuition Class</p>
      <h1 className="mt-1 text-2xl font-semibold">Set up a class</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tell us the basics — LearnNest will propose a full month&apos;s
        lesson plan once this is created.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Grade</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option>Class 3</option>
            <option>Class 4</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Classes per month
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={classesPerMonth}
              onChange={(e) => setClassesPerMonth(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Monthly fee (₹, optional)
          </label>
          <input
            type="number"
            min={0}
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            placeholder="1500"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            Start date (optional)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Days of week</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  days.includes(day)
                    ? "border-teacher bg-teacher-light text-teacher"
                    : "border-slate-300 text-slate-500"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !subjectId}
          className="w-full rounded-xl bg-teacher px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Class"}
        </button>
      </form>
    </main>
  );
}
