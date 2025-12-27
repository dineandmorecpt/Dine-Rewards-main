import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface Branch {
  id: string;
  restaurantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface BranchContextType {
  branches: Branch[];
  accessibleBranches: Branch[];
  selectedBranch: Branch | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isLoading: boolean;
  error: Error | null;
  isAllBranchesView: boolean;
  hasMultipleBranches: boolean;
  canViewAllBranches: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const ALL_BRANCHES_KEY = "dinemore_all_branches_view";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { restaurant, hasAllBranchAccess, accessibleBranchIds } = useAuth();
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: branches = [], isLoading, error } = useQuery<Branch[], Error>({
    queryKey: ["branches", restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const res = await fetch(`/api/restaurants/${restaurant.id}/branches`);
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
    enabled: !!restaurant?.id,
  });

  const accessibleBranches = useMemo(() => {
    if (hasAllBranchAccess) {
      return branches;
    }
    return branches.filter(b => accessibleBranchIds.includes(b.id));
  }, [branches, hasAllBranchAccess, accessibleBranchIds]);

  const hasMultipleBranches = branches.length > 1;
  const canViewAllBranches = hasAllBranchAccess;

  const setSelectedBranchId = (id: string | null) => {
    if (id === null && !canViewAllBranches && accessibleBranches.length > 0) {
      id = accessibleBranches[0].id;
    }
    setSelectedBranchIdState(id);
    if (restaurant?.id) {
      const key = `${ALL_BRANCHES_KEY}_${restaurant.id}`;
      if (id === null) {
        localStorage.setItem(key, "all");
      } else {
        localStorage.setItem(key, id);
      }
    }
  };

  useEffect(() => {
    if (branches.length > 0 && restaurant?.id && !initialized) {
      const key = `${ALL_BRANCHES_KEY}_${restaurant.id}`;
      const saved = localStorage.getItem(key);
      
      if (canViewAllBranches) {
        if (saved === "all" && hasMultipleBranches) {
          setSelectedBranchIdState(null);
        } else if (saved && branches.find(b => b.id === saved)) {
          setSelectedBranchIdState(saved);
        } else if (hasMultipleBranches) {
          setSelectedBranchIdState(null);
        } else {
          const defaultBranch = branches.find(b => b.isDefault);
          setSelectedBranchIdState(defaultBranch?.id || branches[0].id);
        }
      } else {
        if (saved && accessibleBranches.find(b => b.id === saved)) {
          setSelectedBranchIdState(saved);
        } else if (accessibleBranches.length > 0) {
          setSelectedBranchIdState(accessibleBranches[0].id);
        }
      }
      setInitialized(true);
    }
  }, [branches, restaurant?.id, hasMultipleBranches, initialized, canViewAllBranches, accessibleBranches]);

  useEffect(() => {
    if (restaurant?.id) {
      setInitialized(false);
      setSelectedBranchIdState(null);
    }
  }, [restaurant?.id]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null;
  const isAllBranchesView = hasMultipleBranches && selectedBranchId === null && canViewAllBranches;

  return (
    <BranchContext.Provider value={{
      branches,
      accessibleBranches,
      selectedBranch,
      selectedBranchId,
      setSelectedBranchId,
      isLoading,
      error: error || null,
      isAllBranchesView,
      hasMultipleBranches,
      canViewAllBranches,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
