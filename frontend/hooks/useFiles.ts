"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/api";

export type FileItem = {
  id: string;
  file_name: string;
  drive_file_id: string;
  account_index: number;
  size: number;
  mime_type: string | null;
  has_thumbnail: boolean;
  parent_drive_file_id: string | null;
  created_at: string;
};

export function useFiles() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);

  const refreshFiles = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await authenticatedFetch("/api/files", token);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("[useFiles] Error:", err);
    }
  }, [getToken]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return { files, refreshFiles };
}
