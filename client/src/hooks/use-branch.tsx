import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  selectedBranch: Branch | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isLoading: boolean;
  error: Error | null;
  isAllBranchesView: boolean;
  hasMultipleBranches: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const ALL_BRANCHES_KEY = "dinemore_all_branches_view";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { restaurant } = useAuth();
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

  const hasMultipleBranches = branches.length > 1;

  const setSelectedBranchId = (id: string | null) => {
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
      
      if (saved === "all" && hasMultipleBranches) {
        setSelectedBranchIdState(null);
      } else if (saved && branches.find(b => b.id === saved)) {
        setSelectedBranchIdState(saved);
      } else {
        if (hasMultipleBranches) {
          setSelectedBranchIdState(null);
        } else {
          const defaultBranch = branches.find(b => b.isDefault);
          setSelectedBranchIdState(defaultBranch?.id || branches[0].id);
        }
      }
      setInitialized(true);
    }
  }, [branches, restaurant?.id, hasMultipleBranches, initialized]);

  useEffect(() => {
    if (restaurant?.id) {
      setInitialized(false);
      setSelectedBranchIdState(null);
    }
  }, [restaurant?.id]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null;
  const isAllBranchesView = hasMultipleBranches && selectedBranchId === null;

  return (
    <BranchContext.Provider value={{
      branches,
      selectedBranch,
      selectedBranchId,
      setSelectedBranchId,
      isLoading,
      error: error || null,
      isAllBranchesView,
      hasMultipleBranches,
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
