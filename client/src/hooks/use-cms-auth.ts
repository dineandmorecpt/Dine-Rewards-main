import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface CmsAdmin {
  id: string;
  email: string;
  name: string;
}

async function fetchCmsAuthStatus(): Promise<CmsAdmin | null> {
  const response = await fetch("/api/cms/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

export function useCmsAuth() {
  const queryClient = useQueryClient();

  const { data: admin, isLoading } = useQuery<CmsAdmin | null>({
    queryKey: ["cms-auth"],
    queryFn: fetchCmsAuthStatus,
    retry: false,
    staleTime: 60000,
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/cms/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }

    const adminData = await res.json();
    queryClient.setQueryData(["cms-auth"], adminData);
    return adminData;
  }, [queryClient]);

  const logout = useCallback(async () => {
    await fetch("/api/cms/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    queryClient.setQueryData(["cms-auth"], null);
  }, [queryClient]);

  return {
    admin,
    isLoading,
    isAuthenticated: !!admin,
    login,
    logout,
  };
}
