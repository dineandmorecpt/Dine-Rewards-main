import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { 
  Wallet, 
  User, 
  History, 
  LogOut,
  Menu,
  HelpCircle,
  FileText,
  ShieldCheck,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";
import dinerLogo from "@/assets/diner-logo.png";
import dinerText from "@/assets/diner-text.png";

interface DinerLayoutProps {
  children: React.ReactNode;
}

export function DinerLayout({ children }: DinerLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  
  const memberId = user?.id ? user.id.slice(0, 8).toUpperCase() : '';
  const qrValue = user?.id ? `diner:${user.id}` : '';

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"prompt" | "otp" | "success">("prompt");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user && user.userType === 'diner' && user.phoneVerified === false && !dismissed) {
      setShowVerifyModal(true);
    }
  }, [user, dismissed]);

  const requestVerification = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/request-phone-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send verification code');
      }
      return res.json();
    },
    onSuccess: () => {
      setVerifyStep("otp");
      setOtpError("");
    },
  });

  const verifyPhone = useMutation({
    mutationFn: async (otpCode: string) => {
      const res = await fetch('/api/auth/verify-phone-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Verification failed');
      }
      return res.json();
    },
    onSuccess: () => {
      setVerifyStep("success");
      setOtpError("");
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      setTimeout(() => {
        setShowVerifyModal(false);
      }, 2000);
    },
    onError: (error: Error) => {
      setOtpError(error.message);
    },
  });

  const navigation = [
    { name: "My Rewards", href: "/diner/dashboard", icon: Wallet },
    { name: "History", href: "/diner/history", icon: History },
    { name: "Profile", href: "/diner/profile", icon: User },
    { name: "FAQ", href: "/diner/faq", icon: HelpCircle },
    { name: "Terms", href: "/diner/terms", icon: FileText },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full text-white border-r-0">
      <div className="p-4 sm:p-6">
        <Link href="/diner/dashboard" onClick={() => setSidebarOpen(false)} className="block hover:opacity-80 transition-opacity">
          <img src={dinerLogo} alt="Dine&More" className="h-16 sm:h-20 w-auto" />
        </Link>
        <p className="text-[10px] sm:text-xs text-rose-200 mt-1 uppercase tracking-wider font-medium">Diner Rewards</p>
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
      {/* Header with hamburger menu - shown on all screen sizes */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between bg-background border-b border-gray-100 sticky top-0 z-40">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-700 hover:bg-gray-100" data-testid="button-open-menu">
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
        <Link href="/diner/dashboard" className="hover:opacity-80 transition-opacity">
          <img src={dinerLogo} alt="Dine&More" className="h-14 sm:h-16 w-auto" />
        </Link>
      </div>
      
      {/* Main Content */}
      <main className="bg-white min-h-[calc(100vh-80px)] pb-20 md:pb-0">
        <div className="container mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </main>

      {/* Bottom navigation - mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-rose-100 z-50 safe-area-pb">
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

      <Dialog open={showVerifyModal} onOpenChange={(open) => {
        if (!open) {
          setDismissed(true);
          setShowVerifyModal(false);
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="modal-phone-verify">
          {verifyStep === "prompt" && (
            <>
              <DialogHeader className="text-center items-center">
                <div className="mx-auto bg-rose-100 rounded-full p-3 mb-2">
                  <ShieldCheck className="h-8 w-8 text-rose-600" />
                </div>
                <DialogTitle className="text-xl">Verify Your Mobile Number</DialogTitle>
                <DialogDescription className="text-center">
                  Verify your mobile number to secure your account and receive important updates about your rewards.
                </DialogDescription>
              </DialogHeader>
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-1">We'll send a code to</p>
                <p className="font-medium text-lg font-mono">{user?.phone || 'your phone'}</p>
              </div>
              {requestVerification.isError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
                  {(requestVerification.error as Error).message}
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => requestVerification.mutate()}
                  disabled={requestVerification.isPending}
                  className="w-full"
                  data-testid="button-verify-now"
                >
                  {requestVerification.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Verify Now"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDismissed(true);
                    setShowVerifyModal(false);
                  }}
                  className="text-muted-foreground"
                  data-testid="button-verify-later"
                >
                  I'll do this later
                </Button>
              </div>
            </>
          )}

          {verifyStep === "otp" && (
            <>
              <DialogHeader className="text-center items-center">
                <div className="mx-auto bg-rose-100 rounded-full p-3 mb-2">
                  <ShieldCheck className="h-8 w-8 text-rose-600" />
                </div>
                <DialogTitle className="text-xl">Enter Verification Code</DialogTitle>
                <DialogDescription className="text-center">
                  We sent a 6-digit code to {user?.phone}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    setOtpError("");
                  }}
                  data-testid="input-verify-otp"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {otpError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
                  {otpError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => verifyPhone.mutate(otp)}
                  disabled={otp.length !== 6 || verifyPhone.isPending}
                  className="w-full"
                  data-testid="button-submit-otp"
                >
                  {verifyPhone.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
                <Button
                  variant="link"
                  onClick={() => requestVerification.mutate()}
                  disabled={requestVerification.isPending}
                  className="text-sm"
                  data-testid="button-resend-code"
                >
                  {requestVerification.isPending ? "Sending..." : "Resend code"}
                </Button>
              </div>
            </>
          )}

          {verifyStep === "success" && (
            <>
              <DialogHeader className="text-center items-center">
                <div className="mx-auto bg-green-100 rounded-full p-3 mb-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <DialogTitle className="text-xl">Phone Verified!</DialogTitle>
                <DialogDescription className="text-center">
                  Your mobile number has been verified successfully.
                </DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
