import { cn } from "@/lib/utils";
import { Link, useLocation, useRoute } from "wouter";
import { 
  LayoutDashboard, 
  Ticket, 
  Settings, 
  LogOut,
  Menu,
  FileCheck,
  Megaphone,
  CalendarDays,
  Activity,
  Building2,
  ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BranchProvider, useBranch } from "@/hooks/use-branch";
import { useQuery } from "@tanstack/react-query";

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, restaurant } = useAuth();
  const { branches, selectedBranch, setSelectedBranchId } = useBranch();

  const { data: restaurantData } = useQuery({
    queryKey: ["/api/restaurants", restaurant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurant?.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!restaurant?.id,
  });

  useEffect(() => {
    if (restaurantData && restaurantData.onboardingStatus !== 'active' && !location.startsWith('/admin/onboarding')) {
      setLocation('/admin/onboarding');
    }
  }, [restaurantData, location, setLocation]);

  const navigation = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Vouchers", href: "/admin/vouchers", icon: Ticket },
    { name: "Reconciliation", href: "/admin/reconciliation", icon: FileCheck },
    { name: "Activity Logs", href: "/admin/activity-logs", icon: Activity },
    { name: "Reservations", href: null, icon: CalendarDays, comingSoon: true },
    { name: "Campaigns", href: null, icon: Megaphone, comingSoon: true },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6">
        <h1 className="text-2xl font-serif font-bold tracking-tight text-primary-foreground">
          Dine<span className="text-sidebar-primary">&</span>More
        </h1>
        <p className="text-sm text-sidebar-primary font-semibold mt-1">{restaurant?.name || 'Restaurant'}</p>
        <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider font-medium">Restaurant Admin</p>
        
        {branches.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full mt-3 justify-between text-left font-normal bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent"
                data-testid="button-branch-switcher"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 text-sidebar-primary shrink-0" />
                  <span className="truncate">{selectedBranch?.name || 'Select branch'}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={cn(
                    "cursor-pointer",
                    selectedBranch?.id === branch.id && "bg-accent"
                  )}
                  data-testid={`menu-branch-${branch.id}`}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {branch.name}
                  {branch.isDefault && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                      Default
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          
          if (item.comingSoon) {
            return (
              <div
                key={item.name}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md text-sidebar-foreground/40 cursor-not-allowed pointer-events-none select-none"
              >
                <item.icon className="h-5 w-5 text-sidebar-foreground/30" />
                {item.name}
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 border-sidebar-foreground/20 text-sidebar-foreground/40">
                  Soon
                </Badge>
              </div>
            );
          }
          
          return (
            <Link
              key={item.name}
              href={item.href!}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 pl-4"
          onClick={logout}
          data-testid="button-signout"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Mobile Sidebar */}
      <div className="lg:hidden p-4 border-b flex items-center justify-between bg-card">
        <span className="font-serif font-bold text-xl">Dine&More</span>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <SidebarContent />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-muted/20">
          <div className="container mx-auto max-w-7xl px-4 py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <BranchProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </BranchProvider>
  );
}
