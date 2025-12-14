import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { 
  Wallet, 
  User, 
  History, 
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { QRCodeSVG } from "qrcode.react";

interface DinerLayoutProps {
  children: React.ReactNode;
}

export function DinerLayout({ children }: DinerLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  
  const memberId = user?.id ? user.id.slice(0, 8).toUpperCase() : '';
  const qrValue = user?.id ? `diner:${user.id}` : '';

  const navigation = [
    { name: "My Rewards", href: "/diner/dashboard", icon: Wallet },
    { name: "History", href: "/diner/history", icon: History },
    { name: "Profile", href: "/diner/profile", icon: User },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card text-card-foreground border-r border-border">
      <div className="p-6">
        <h1 className="text-2xl font-serif font-bold tracking-tight text-primary">
          Dine<span className="text-chart-1">&</span>More
        </h1>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Diner Rewards</p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 group",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="bg-primary/5 rounded-lg p-4 mb-4 text-center">
            {qrValue ? (
              <div className="bg-white p-2 rounded-lg inline-block mb-2">
                <QRCodeSVG 
                  value={qrValue} 
                  size={80}
                  level="M"
                  includeMargin={false}
                />
              </div>
            ) : (
              <div className="h-20 w-20 mx-auto bg-muted rounded mb-2" />
            )}
            <p className="text-xs font-medium text-primary">Member ID: {memberId || '---'}</p>
            <p className="text-[10px] text-muted-foreground">Scan at till to earn points</p>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 pl-4"
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
          <div className="container mx-auto max-w-5xl px-4 py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
