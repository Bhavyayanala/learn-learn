export function EmptyState({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink/10 bg-white/60 p-8 text-center">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-display font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-ink/50">{body}</p>}
    </div>
  );
}
