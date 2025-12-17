import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Lock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const token = new URLSearchParams(search).get("token");

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        setIsValid(false);
        setErrorMessage("No reset token provided");
        return;
      }

      try {
        const response = await fetch(`/api/auth/validate-reset-token?token=${token}`);
        const data = await response.json();

        setIsValid(data.valid);
        if (!data.valid) {
          setErrorMessage(data.error || "Invalid reset link");
        }
      } catch (error) {
        setIsValid(false);
        setErrorMessage("Failed to validate reset link");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: "Missing information",
        description: "Please fill in both password fields.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setIsSuccess(true);
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
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="rounded-xl border bg-card p-6 space-y-6 text-left">
            {isValidating ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-4">Validating reset link...</p>
              </div>
            ) : !isValid ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-semibold">Invalid Link</h2>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
                <Link href="/forgot-password">
                  <Button variant="outline" className="mt-4" data-testid="button-request-new">
                    Request a New Link
                  </Button>
                </Link>
              </div>
            ) : isSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold">Password Reset!</h2>
                <p className="text-sm text-muted-foreground">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => navigate("/")}
                  data-testid="button-go-login"
                >
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-semibold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your new password below.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-password"
                    />
                  </div>

                  <Button 
                    type="submit"
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    Reset Password
                  </Button>
                </form>
              </>
            )}

            {!isSuccess && (
              <div className="text-center pt-2">
                <Link href="/" className="inline-flex items-center text-sm text-primary hover:underline" data-testid="link-back-login">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="absolute bottom-6 text-sm text-muted-foreground/60">
        © 2024 Dine&More. Elevating the dining experience.
      </footer>
    </div>
  );
}
