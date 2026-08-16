export function StatCard({
  value,
  label,
  accent = "teacher",
  icon,
}: {
  value: string | number;
  label: string;
  accent?: "teacher" | "student" | "parent";
  icon?: string;
}) {
  const accentBg = {
    teacher: "bg-teacher-light",
    student: "bg-student-light",
    parent: "bg-parent-light",
  }[accent];
  const accentText = {
    teacher: "text-teacher",
    student: "text-student-dark",
    parent: "text-parent",
  }[accent];

  return (
    <div className={`rounded-2xl p-4 text-center ${accentBg}`}>
      {icon && <p className="text-xl">{icon}</p>}
      <p className={`font-display text-2xl font-bold ${accentText}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-ink/50">{label}</p>
    </div>
  );
}
