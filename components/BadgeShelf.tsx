"use client";

import { DownloadCertificateButton } from "@/components/DownloadCertificateButton";

type Badge = {
  code: string;
  title: string;
  emoji: string;
  description: string;
  earned_at: string;
};

export function BadgeShelf({
  badges,
  studentName,
}: {
  badges: Badge[];
  studentName: string;
}) {
  if (badges.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500">
        No badges yet — practice and do homework to earn some! 🏆
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map((b) => (
        <div
          key={b.code}
          title={b.description}
          className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-center"
        >
          <p className="text-3xl">{b.emoji}</p>
          <p className="mt-1 text-xs font-bold">{b.title}</p>
          <DownloadCertificateButton
            studentName={studentName}
            badgeTitle={b.title}
            badgeDescription={b.description}
            earnedAt={b.earned_at}
          />
        </div>
      ))}
    </div>
  );
}
