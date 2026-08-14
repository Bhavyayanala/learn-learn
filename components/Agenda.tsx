export type AgendaItem = {
  date: string; // ISO date
  label: string;
  kind: "class" | "assignment_due" | "test";
  href?: string;
};

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const KIND_STYLE: Record<AgendaItem["kind"], string> = {
  class: "bg-teacher-light text-teacher",
  assignment_due: "bg-amber-100 text-amber-800",
  test: "bg-rose-100 text-rose-700",
};

const KIND_LABEL: Record<AgendaItem["kind"], string> = {
  class: "Class",
  assignment_due: "Due",
  test: "Test",
};

export function Agenda({ items }: { items: AgendaItem[] }) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
        Nothing scheduled.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sorted.map((item, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-slate-400">
              {formatDate(item.date)}
            </span>
            <span className="text-sm">{item.label}</span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLE[item.kind]}`}
          >
            {KIND_LABEL[item.kind]}
          </span>
        </li>
      ))}
    </ul>
  );
}
