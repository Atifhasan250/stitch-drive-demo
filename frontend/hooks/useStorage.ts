"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/api";

type Account = {
  account_index: number;
  email: string | null;
  is_connected: boolean;
  used: number;
  limit: number;
  free: number;
};

export function useStorage() {
  const { getToken } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);

  const refreshStorage = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await authenticatedFetch("/api/accounts", token);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      } else if (res.status === 401) {
        console.warn("[useStorage] Missing credentials detected.");
      }
    } catch (err) {
      console.error("[useStorage] Error:", err);
    }
  }, [getToken]);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  return { accounts, refreshStorage };
}
