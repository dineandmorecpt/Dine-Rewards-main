import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  FolderSync,
  FileText,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { useCmsAuth } from "@/hooks/use-cms-auth";

interface CmsLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/dineandmore/cms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/dineandmore/cms/restaurants", label: "Restaurants", icon: Building2 },
  { path: "/dineandmore/cms/ftp", label: "FTP Status", icon: FolderSync },
  { path: "/dineandmore/cms/content", label: "Content Pages", icon: FileText },
];

function NavContent({ onItemClick }: { onItemClick?: () => void }) {
  const [location] = useLocation();
  const { admin, logout } = useCmsAuth();

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-lg font-bold text-primary" data-testid="cms-title">Dine&More CMS</h1>
        <p className="text-xs text-muted-foreground mt-1">Platform Administration</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.path || location.startsWith(item.path + "/");
          return (
            <Link key={item.path} href={item.path}>
              <button
                onClick={onItemClick}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="text-sm font-medium mb-2" data-testid="text-admin-name">{admin?.name}</div>
        <div className="text-xs text-muted-foreground mb-3">{admin?.email}</div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function CmsLayout({ children }: CmsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex w-64 bg-white border-r flex-col fixed inset-y-0">
        <NavContent />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-40 px-4 py-3 flex items-center gap-3">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <NavContent onItemClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-bold text-primary">Dine&More CMS</h1>
      </div>

      <main className="flex-1 lg:ml-64">
        <div className="pt-16 lg:pt-0 p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
