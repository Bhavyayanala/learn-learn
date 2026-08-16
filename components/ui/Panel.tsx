export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/8 bg-white p-6 shadow-soft">
      <h2 className="font-display font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink/50">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
