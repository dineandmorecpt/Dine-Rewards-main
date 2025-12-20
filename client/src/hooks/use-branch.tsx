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
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { restaurant } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["branches", restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const res = await fetch(`/api/restaurants/${restaurant.id}/branches`);
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
    enabled: !!restaurant?.id,
  });

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      const defaultBranch = branches.find(b => b.isDefault);
      setSelectedBranchId(defaultBranch?.id || branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null;

  return (
    <BranchContext.Provider value={{
      branches,
      selectedBranch,
      selectedBranchId,
      setSelectedBranchId,
      isLoading,
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
