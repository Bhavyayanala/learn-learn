export function ProgressBar({
  label,
  percent,
  accent = "teacher",
}: {
  label: string;
  percent: number;
  accent?: "teacher" | "student" | "parent";
}) {
  const bar = { teacher: "bg-teacher", student: "bg-student", parent: "bg-parent" }[accent];
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-ink/50">{clamped}%</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/8">
        <div
          className={`h-full rounded-full transition-all ${bar}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
