"use client";

import { useState } from "react";

export type Tab = {
  id: string;
  label: string;
  icon?: string;
  content: React.ReactNode;
};

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-soft">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-teacher text-white shadow-soft"
                : "text-ink/55 hover:bg-ink/5"
            }`}
          >
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-5">{activeTab?.content}</div>
    </div>
  );
}
