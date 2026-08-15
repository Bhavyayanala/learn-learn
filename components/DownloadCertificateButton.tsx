"use client";

import { useState } from "react";

export function DownloadCertificateButton({
  studentName,
  badgeTitle,
  badgeDescription,
  earnedAt,
}: {
  studentName: string;
  badgeTitle: string;
  badgeDescription: string;
  earnedAt: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);

    // Dynamic import: jsPDF is a real dependency (see package.json), but
    // loading it only when someone actually clicks "Download" keeps it
    // out of the initial page bundle for everyone who doesn't.
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Border
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(2);
    doc.rect(10, 10, pageW - 20, pageH - 20);
    doc.setLineWidth(0.5);
    doc.rect(14, 14, pageW - 28, pageH - 28);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("LEARNNEST", pageW / 2, 35, { align: "center" });

    doc.setFontSize(28);
    doc.setTextColor(30);
    doc.text("Certificate of Achievement", pageW / 2, 55, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text("This certifies that", pageW / 2, 75, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229);
    doc.text(studentName, pageW / 2, 90, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text("has earned the badge", pageW / 2, 105, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(badgeTitle, pageW / 2, 118, { align: "center" });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(90);
    doc.text(badgeDescription, pageW / 2, 128, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      `Awarded on ${new Date(earnedAt).toLocaleDateString()}`,
      pageW / 2,
      pageH - 25,
      { align: "center" }
    );

    doc.save(`${badgeTitle.replace(/\s+/g, "_")}_certificate.pdf`);
    setBusy(false);
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className="mt-1 text-[10px] font-medium text-amber-700 underline disabled:opacity-50"
    >
      {busy ? "…" : "Download"}
    </button>
  );
}
