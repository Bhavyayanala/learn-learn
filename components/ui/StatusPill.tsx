const VARIANTS = {
  pending: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
  neutral: "bg-ink/8 text-ink/60",
  info: "bg-teacher-light text-teacher",
};

export function StatusPill({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
