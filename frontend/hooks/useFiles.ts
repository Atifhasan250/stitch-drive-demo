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

type UseFilesOptions = {
  page?: number;
  limit?: number;
  parent?: string | null;
  foldersOnly?: boolean;
  search?: string;
  accountIndex?: number | "all";
  type?: string;
  sort?: string;
};

export function useFiles(options: UseFilesOptions = {}) {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(options.page ?? 1);
  const [limit, setLimit] = useState(options.limit ?? 1000);

  const refreshFiles = useCallback(async () => {
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (options.page) params.set("page", String(options.page));
      if (options.limit) params.set("limit", String(options.limit));
      if (options.parent === null) params.set("parent", "root");
      if (options.parent) params.set("parent", options.parent);
      if (options.foldersOnly) params.set("foldersOnly", "true");
      if (options.search) params.set("search", options.search);
      if (options.accountIndex !== undefined) params.set("accountIndex", String(options.accountIndex));
      if (options.type && options.type !== "all") params.set("type", options.type);
      if (options.sort) params.set("sort", options.sort);

      const url = params.size > 0 ? `/api/files?${params.toString()}` : "/api/files";
      const res = await authenticatedFetch(url, token);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        setTotal(Number(res.headers.get("X-Total-Count") || data.length || 0));
        setPage(Number(res.headers.get("X-Page") || options.page || 1));
        setLimit(Number(res.headers.get("X-Limit") || options.limit || 1000));
      }
    } catch (err) {
      console.error("[useFiles] Error:", err);
    }
  }, [
    getToken,
    options.accountIndex,
    options.foldersOnly,
    options.limit,
    options.page,
    options.parent,
    options.search,
    options.sort,
    options.type,
  ]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return {
    files,
    total,
    page,
    limit,
    hasMore: page * limit < total,
    refreshFiles,
  };
}
