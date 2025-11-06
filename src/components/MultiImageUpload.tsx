"use client";

import React, { useState, useRef } from "react";
import { createClient } from "@/database/supabase/client";
import { Button } from "@/components/ui/button";
import { supabaseService } from "@/services/supabaseService";
import { Input } from "./ui/input";

type UploadedItem = {
  path: string;
  publicUrl?: string | null;
};

export default function MultiImageUpload({
  bucket = "product_images",
  folder = "uploads",
  onComplete,
}: {
  bucket?: string;
  folder?: string;
  onComplete?: (items: UploadedItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
    setStatuses({});
    // auto-upload immediately after selection
    if (selected.length) {
      // fire-and-forget; uploadAll will manage uploading state
      void uploadAll(selected);
    }
  }

  function clearSelection() {
    setFiles([]);
    setPreviews((p) => {
      p.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });
    if (inputRef.current) inputRef.current.value = "";
    setStatuses({});
  }

  async function uploadAll(filesToUpload?: File[]) {
    const targetFiles = filesToUpload ?? files;
    if (!targetFiles.length) return;
    setUploading(true);
    const uploaded: UploadedItem[] = [];

    // send files as FormData to server endpoint
    const formData = new FormData();
    for (const f of targetFiles) formData.append("files", f);
    // include optional folder and bucket for future flexibility
    formData.append("folder", folder);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Upload failed");
      }

      const json = await res.json();
      // json.uploaded: [{ path, publicUrl, dbRow? }]
      for (const it of json.uploaded as any[]) {
        uploaded.push({ path: it.path, publicUrl: it.publicUrl ?? null });
        // mark as done for the corresponding filename roughly by matching path end
        const filename = it.path.split("/").pop() ?? it.path;
        setStatuses((statuses) => ({ ...statuses, [filename]: "done" }));
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      // set all target files to error
      for (const file of targetFiles) {
        setStatuses((statuses) => ({ ...statuses, [file.name]: "error" }));
      }
    }

    setUploading(false);
    if (onComplete) onComplete(uploaded);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          id="picture"
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          className="cursor-pointer"
        />
        <Button
          variant="ghost"
          onClick={clearSelection}
          disabled={!files.length}
        >
          Clear
        </Button>
        {/* Upload happens automatically on file selection */}
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => {
            const file = files[i];
            return (
              <div key={src} className="flex flex-col items-center gap-1 p-4">
                <img
                  src={src}
                  alt={file.name}
                  className="h-28 w-full object-cover rounded-md"
                />
                <div className="text-xs text-muted-foreground truncate w-full text-center">
                  {file.name}
                </div>
                <div className="text-xs">
                  {statuses[file.name] === "uploading" && (
                    <span>Uploading…</span>
                  )}
                  {statuses[file.name] === "done" && (
                    <span className="text-green-500">Done</span>
                  )}
                  {statuses[file.name] === "error" && (
                    <span className="text-destructive">Error</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
