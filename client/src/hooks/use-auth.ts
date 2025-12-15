import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  name: string;
  lastName?: string;
  phone?: string;
  userType: 'diner' | 'admin';
}

interface Restaurant {
  id: string;
  name: string;
}

type PortalRole = 'owner' | 'manager' | 'staff' | null;

interface AuthResponse {
  user: User | null;
  restaurant: Restaurant | null;
  portalRole: PortalRole;
}

async function fetchAuthStatus(): Promise<AuthResponse> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });
  if (!response.ok) {
    return { user: null, restaurant: null, portalRole: null };
  }
  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, refetch } = useQuery<AuthResponse>({
    queryKey: ["auth"],
    queryFn: fetchAuthStatus,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
    queryClient.setQueryData(["auth"], { user: null, restaurant: null, portalRole: null });
    window.location.href = "/";
  }, [queryClient]);

  const user = data?.user ?? null;
  const restaurant = data?.restaurant ?? null;
  const portalRole = data?.portalRole ?? null;
  const isAuthenticated = !!user;
  const isDiner = user?.userType === 'diner';
  const isAdmin = user?.userType === 'admin';
  const isOwnerOrManager = portalRole === 'owner' || portalRole === 'manager';
  const isStaff = portalRole === 'staff';

  return {
    user,
    restaurant,
    portalRole,
    isLoading,
    isAuthenticated,
    isDiner,
    isAdmin,
    isOwnerOrManager,
    isStaff,
    logout,
    refetch,
  };
}
