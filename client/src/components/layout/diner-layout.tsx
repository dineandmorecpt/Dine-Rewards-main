import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { 
  Wallet, 
  User, 
  History, 
  LogOut,
  Menu,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
    { name: "FAQ", href: "/diner/faq", icon: HelpCircle },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full text-white border-r-0">
      <div className="p-4 sm:p-6">
        <Link href="/" onClick={() => setSidebarOpen(false)} className="block hover:opacity-80 transition-opacity">
          <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-white">
            Dine<span className="text-rose-200">&</span>More
          </h1>
          <p className="text-[10px] sm:text-xs text-rose-200 mt-1 uppercase tracking-wider font-medium">Diner Rewards</p>
        </Link>
      </div>

      <nav className="flex-1 px-3 sm:px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 sm:px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 group min-h-[44px]",
                isActive
                  ? "bg-white/20 text-white"
                  : "text-rose-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-rose-200 group-hover:text-white")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 sm:p-4 border-t border-white/20 mt-auto">
        <div className="bg-white/10 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 text-center">
            {qrValue ? (
              <div className="bg-white p-2 rounded-lg inline-block mb-2">
                <QRCodeSVG 
                  value={qrValue} 
                  size={72}
                  level="M"
                  includeMargin={false}
                />
              </div>
            ) : (
              <div className="h-[72px] w-[72px] mx-auto bg-white/20 rounded mb-2" />
            )}
            <p className="text-xs font-medium text-white">Member ID: {memberId || '---'}</p>
            <p className="text-[10px] text-rose-200">Scan at till to earn points</p>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-rose-100 hover:text-red-300 hover:bg-white/10 pl-3 sm:pl-4 min-h-[44px]"
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
    <div className="min-h-screen bg-background font-sans diner-theme">
      {/* Mobile Header with bottom navigation */}
      <div className="lg:hidden">
        {/* Top header bar - blue gradient */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between diner-header-gradient sticky top-0 z-40">
          <Link href="/" className="font-serif font-bold text-lg sm:text-xl text-white hover:opacity-80 transition-opacity">Dine&More</Link>
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20">
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] sm:w-72 border-r-0 diner-sidebar">
              <VisuallyHidden>
                <SheetTitle>Navigation Menu</SheetTitle>
                <SheetDescription>Main navigation menu for Dine&More</SheetDescription>
              </VisuallyHidden>
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Main Content for mobile */}
        <main className="bg-white min-h-[calc(100vh-52px)] pb-20">
          <div className="px-3 py-4 sm:px-4 sm:py-6">
            {children}
          </div>
        </main>

        {/* Bottom navigation for mobile - burgundy theme */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-rose-100 z-50 safe-area-pb">
          <div className="flex justify-around items-center h-16">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors min-w-[64px]",
                    isActive
                      ? "text-rose-700"
                      : "text-gray-400"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 mb-1", isActive ? "text-rose-700" : "text-gray-400")} />
                  <span className="text-[10px] sm:text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="w-72 shrink-0 diner-sidebar">
          <SidebarContent />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="container mx-auto max-w-5xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
