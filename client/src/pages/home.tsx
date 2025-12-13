import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Utensils, ChefHat, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [dinerEmail, setDinerEmail] = useState("");
  const [dinerPassword, setDinerPassword] = useState("");
  
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleLogin = async (userType: 'diner' | 'admin', email: string, password: string) => {
    if (!email || !password) {
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
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.user.userType !== userType) {
        throw new Error(userType === 'diner' 
          ? "This account is not registered as a diner." 
          : "This account is not registered as a restaurant admin.");
      }

      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.name}`,
      });

      if (userType === 'diner') {
        navigate("/diner/dashboard");
      } else {
        navigate("/admin/dashboard");
      }
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
                <div className="space-y-2">
                  <Label htmlFor="diner-email">Email</Label>
                  <Input
                    id="diner-email"
                    type="email"
                    placeholder="your@email.com"
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
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin('diner', dinerEmail, dinerPassword)}
                    data-testid="input-diner-password"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleLogin('diner', dinerEmail, dinerPassword)}
                  disabled={isLoading}
                  data-testid="button-diner-login"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In as Diner
                </Button>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin('admin', adminEmail, adminPassword)}
                    data-testid="input-admin-password"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleLogin('admin', adminEmail, adminPassword)}
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
