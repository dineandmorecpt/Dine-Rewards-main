import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Utensils, ChefHat, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  
  const [dinerPhone, setDinerPhone] = useState("");
  const [dinerOtp, setDinerOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleDinerLogin = async () => {
    if (!dinerPhone) {
      toast({
        title: "Missing information",
        description: "Please enter your phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // First check if user has a valid access token
      const checkResponse = await fetch("/api/auth/check-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: dinerPhone }),
      });

      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        throw new Error(checkData.error || "Login check failed");
      }

      // If user has valid token, they're already logged in
      if (checkData.hasValidToken && checkData.user) {
        // Invalidate auth cache so DinerGuard gets fresh session
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
        toast({
          title: "Welcome back!",
          description: `Logged in as ${checkData.user.name}`,
        });
        navigate("/diner/dashboard");
        return;
      }

      // No valid token, need to request OTP
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: dinerPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: data.smsSent 
          ? "Check your phone for the login code." 
          : "Could not send SMS. Please try again.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!dinerOtp) {
      toast({
        title: "Missing information",
        description: "Please enter the OTP code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: dinerPhone, otp: dinerOtp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Invalidate auth cache so DinerGuard gets fresh session
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.name}`,
      });

      navigate("/diner/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      toast({
        title: "Missing information",
        description: "Please enter your email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.user.userType !== 'admin') {
        throw new Error("This account is not registered as a restaurant admin.");
      }

      // Invalidate auth cache so AdminGuard gets fresh session
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.name}`,
      });

      navigate("/admin/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute bottom-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-secondary/30 blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight text-primary">
            Dine<span className="text-chart-1">&</span>More
          </h1>
          <p className="text-lg text-muted-foreground font-light">
            The premium rewards experience for exceptional dining.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <Tabs defaultValue="diner" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="diner" className="flex items-center gap-2" data-testid="tab-diner">
                <Utensils className="w-4 h-4" />
                Diner
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2" data-testid="tab-admin">
                <ChefHat className="w-4 h-4" />
                Restaurant
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="diner" className="mt-6">
              <div className="rounded-xl border bg-card p-6 space-y-4 text-left">
                {!otpSent ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="diner-phone">Phone Number</Label>
                      <Input
                        id="diner-phone"
                        type="tel"
                        placeholder="Enter your phone number"
                        value={dinerPhone}
                        onChange={(e) => setDinerPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDinerLogin()}
                        data-testid="input-diner-phone"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleDinerLogin}
                      disabled={isLoading}
                      data-testid="button-diner-login"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Continue
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center pb-2">
                      <p className="text-sm text-muted-foreground">
                        Enter the 6-digit code sent to <strong>{dinerPhone}</strong>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diner-otp">Login Code</Label>
                      <Input
                        id="diner-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={dinerOtp}
                        onChange={(e) => setDinerOtp(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                        data-testid="input-diner-otp"
                        className="text-center text-2xl tracking-widest"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleVerifyOtp}
                      disabled={isLoading}
                      data-testid="button-verify-otp"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Sign In
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full text-sm" 
                      onClick={() => { setOtpSent(false); setDinerOtp(""); }}
                      data-testid="button-change-phone"
                    >
                      Use a different phone number
                    </Button>
                  </>
                )}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Received an invitation? Check your SMS for the registration link.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="admin" className="mt-6">
              <div className="rounded-xl border bg-card p-6 space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@restaurant.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    data-testid="input-admin-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    data-testid="input-admin-password"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                  data-testid="button-admin-login"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In as Restaurant
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="absolute bottom-6 text-sm text-muted-foreground/60">
        © 2024 Dine&More. Elevating the dining experience.
      </footer>
    </div>
  );
}
