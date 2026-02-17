import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCmsAuth } from "@/hooks/use-cms-auth";
import { Loader2 } from "lucide-react";

export function CmsGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useCmsAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/dineandmore/cms");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
