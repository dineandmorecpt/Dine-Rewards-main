import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearStoredAuth, getStoredAuth } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  name: string;
  lastName?: string;
  phone?: string;
  userType: 'diner' | 'admin' | 'restaurant_admin';
}

interface Restaurant {
  id: string;
  name: string;
}

type PortalRole = 'owner' | 'manager' | 'staff' | null;

interface BranchAccess {
  branchIds: string[];
  hasAllAccess: boolean;
}

interface AuthResponse {
  user: User | null;
  restaurant: Restaurant | null;
  portalRole: PortalRole;
  branchAccess: BranchAccess | null;
}

async function fetchAuthStatus(): Promise<AuthResponse> {
  const storedAuth = getStoredAuth();
  const headers: Record<string, string> = {};
  if (storedAuth) {
    headers["X-User-Id"] = storedAuth.userId;
    headers["X-User-Type"] = storedAuth.userType;
  }
  
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    return { user: null, restaurant: null, portalRole: null, branchAccess: null };
  }
  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, refetch } = useQuery<AuthResponse>({
    queryKey: ["auth"],
    queryFn: fetchAuthStatus,
    retry: false,
    staleTime: 60000, // Keep auth data fresh for 1 minute to avoid race conditions after login
    refetchOnMount: false, // Don't refetch on mount - use cached data from login
  });

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Clear localStorage auth and all cached data
    clearStoredAuth();
    queryClient.clear();
    window.location.href = "/";
  }, [queryClient]);

  const user = data?.user ?? null;
  const restaurant = data?.restaurant ?? null;
  const portalRole = data?.portalRole ?? null;
  const branchAccess = data?.branchAccess ?? null;
  const isAuthenticated = !!user;
  const isDiner = user?.userType === 'diner';
  const isAdmin = user?.userType === 'admin';
  const isOwnerOrManager = portalRole === 'owner' || portalRole === 'manager';
  const isStaff = portalRole === 'staff';
  const hasAllBranchAccess = branchAccess?.hasAllAccess ?? false;
  const accessibleBranchIds = branchAccess?.branchIds ?? [];

  return {
    user,
    restaurant,
    portalRole,
    branchAccess,
    isLoading,
    isAuthenticated,
    isDiner,
    isAdmin,
    isOwnerOrManager,
    isStaff,
    hasAllBranchAccess,
    accessibleBranchIds,
    logout,
    refetch,
  };
}
