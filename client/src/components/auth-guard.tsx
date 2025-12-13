import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredUserType?: 'diner' | 'admin';
}

export function AuthGuard({ children, requiredUserType }: AuthGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    if (requiredUserType && user?.userType !== requiredUserType) {
      if (user?.userType === 'diner') {
        navigate("/diner/dashboard");
      } else {
        navigate("/admin/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, user, requiredUserType, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredUserType && user?.userType !== requiredUserType) {
    return null;
  }

  return <>{children}</>;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredUserType="admin">{children}</AuthGuard>;
}

export function DinerGuard({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredUserType="diner">{children}</AuthGuard>;
}
