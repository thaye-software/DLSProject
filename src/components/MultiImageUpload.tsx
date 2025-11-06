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

  async function uploadAll() {
    if (!files.length) return;
    setUploading(true);
    const uploaded: UploadedItem[] = [];

    for (const file of files) {
      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${
        file.name
      }`;
      const path = `${folder}/${unique}`;
      setStatuses((s) => ({ ...s, [file.name]: "uploading" }));

      try {
        supabaseService.uploadFile(file).then((publicUrl) => {
          uploaded.push({ path, publicUrl });
          setStatuses((statuses) => ({ ...statuses, [file.name]: "done" }));
        });
      } catch (err: any) {
        console.error("Upload failed", file.name, err);
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
        <Button onClick={uploadAll} disabled={!files.length || uploading}>
          {uploading ? "Uploading..." : "Upload all"}
        </Button>
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
