"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Material = {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  created_at: string;
};

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt";
const MAX_SIZE_MB = 25;

export function MaterialUploader({
  classId,
  teacherId,
  initialMaterials,
}: {
  classId: string;
  teacherId: string;
  initialMaterials: Material[];
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large. Max size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);

    const path = `${classId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const { error: uploadErr } = await supabase.storage
      .from("materials")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      setUploading(false);
      setError(uploadErr.message);
      return;
    }

    const { data: row, error: insertErr } = await supabase
      .from("materials")
      .insert({
        class_id: classId,
        teacher_id: teacherId,
        file_name: file.name,
        storage_path: path,
        file_type: file.type || null,
        file_size_bytes: file.size,
      })
      .select("id, file_name, storage_path, file_type, created_at")
      .single();

    setUploading(false);

    if (insertErr || !row) {
      setError(insertErr?.message ?? "Upload succeeded but saving the record failed.");
      return;
    }

    setMaterials((prev) => [row, ...prev]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDownload(m: Material) {
    const { data, error: urlErr } = await supabase.storage
      .from("materials")
      .createSignedUrl(m.storage_path, 60);

    if (urlErr || !data) {
      setError(urlErr?.message ?? "Could not generate a download link.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm"
        />
        {uploading && <span className="text-sm text-slate-500">Uploading…</span>}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {materials.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No materials uploaded yet — PDFs, notes, worksheets, or a syllabus
          document all work.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="truncate">{m.file_name}</span>
              <button
                onClick={() => handleDownload(m)}
                className="ml-3 shrink-0 text-teacher underline"
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
