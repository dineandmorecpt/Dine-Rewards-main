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
  const [showRegister, setShowRegister] = useState(false);
  
  const [dinerEmail, setDinerEmail] = useState("");
  const [dinerPassword, setDinerPassword] = useState("");
  
  const [registerName, setRegisterName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleDinerLogin = async () => {
    if (!dinerEmail || !dinerPassword) {
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
        body: JSON.stringify({ email: dinerEmail, password: dinerPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.user.userType !== 'diner') {
        throw new Error("This account is not registered as a diner.");
      }

      // Refetch auth cache and wait for it to complete before navigating
      await queryClient.refetchQueries({ queryKey: ["auth"] });
      
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

  const handleDinerRegister = async () => {
    if (!registerName || !registerLastName || !registerEmail || !registerPhone || !registerPassword) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register-diner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: registerName,
          lastName: registerLastName,
          email: registerEmail,
          phone: registerPhone,
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      await queryClient.refetchQueries({ queryKey: ["auth"] });

      toast({
        title: "Registration successful!",
        description: `Welcome, ${data.user.name}!`,
      });

      navigate("/diner/dashboard");
    } catch (error: any) {
      toast({
        title: "Registration failed",
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

      if (data.user.userType !== 'admin' && data.user.userType !== 'restaurant_admin') {
        throw new Error("This account is not registered as a restaurant admin.");
      }

      // Refetch auth cache and wait for it to complete before navigating
      await queryClient.refetchQueries({ queryKey: ["auth"] });
      
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
                {!showRegister ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="diner-email">Email</Label>
                      <Input
                        id="diner-email"
                        type="email"
                        placeholder="diner@example.com"
                        value={dinerEmail}
                        onChange={(e) => setDinerEmail(e.target.value)}
                        data-testid="input-diner-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diner-password">Password</Label>
                      <Input
                        id="diner-password"
                        type="password"
                        placeholder="Enter your password"
                        value={dinerPassword}
                        onChange={(e) => setDinerPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDinerLogin()}
                        data-testid="input-diner-password"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleDinerLogin}
                      disabled={isLoading}
                      data-testid="button-diner-login"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Sign In
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium"
                        onClick={() => setShowRegister(true)}
                        data-testid="button-show-register"
                      >
                        Register
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="register-name">First Name</Label>
                      <Input
                        id="register-name"
                        placeholder="Enter your first name"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        data-testid="input-register-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-lastname">Surname</Label>
                      <Input
                        id="register-lastname"
                        placeholder="Enter your surname"
                        value={registerLastName}
                        onChange={(e) => setRegisterLastName(e.target.value)}
                        data-testid="input-register-lastname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        data-testid="input-register-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-phone">Phone Number</Label>
                      <Input
                        id="register-phone"
                        type="tel"
                        placeholder="+27 82 123 4567"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(e.target.value)}
                        data-testid="input-register-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a password"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDinerRegister()}
                        data-testid="input-register-password"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleDinerRegister}
                      disabled={isLoading}
                      data-testid="button-diner-register"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Register
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium"
                        onClick={() => setShowRegister(false)}
                        data-testid="button-show-login"
                      >
                        Sign In
                      </button>
                    </div>
                  </>
                )}
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
