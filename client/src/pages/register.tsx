import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Gift, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function Register() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const token = new URLSearchParams(searchString).get('token') || '';
  
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      if (!token) throw new Error("No invitation token provided");
      const res = await fetch(`/api/invitations/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid invitation");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const register = useMutation({
    mutationFn: async (data: { token: string; email: string; name: string; lastName: string; termsAccepted: boolean; privacyAccepted: boolean }) => {
      const res = await fetch('/api/diners/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Registration failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setRegistrationComplete(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate({
      token,
      email,
      name,
      lastName,
      termsAccepted,
      privacyAccepted,
    });
  };

  const isFormValid = name.trim() && lastName.trim() && email.trim() && termsAccepted && privacyAccepted;

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This registration link is invalid or missing. Please use the link sent to your phone.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invitation.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Link Error</CardTitle>
            <CardDescription>
              {(invitation.error as Error).message}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-2" />
            <CardTitle className="text-2xl">Welcome to the Rewards Program!</CardTitle>
            <CardDescription className="text-base">
              Your registration is complete. Start earning points on your next visit to {invitation.data?.restaurantName}!
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/diner/dashboard')} data-testid="button-go-dashboard">
              View My Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">Join {invitation.data?.restaurantName}</CardTitle>
          <CardDescription>
            Complete your registration to start earning rewards with every visit!
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter your first name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-register-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Surname</Label>
              <Input
                id="lastName"
                placeholder="Enter your surname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                data-testid="input-register-surname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-register-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={invitation.data?.phone || ''}
                disabled
                className="bg-muted"
                data-testid="input-register-phone"
              />
              <p className="text-xs text-muted-foreground">This is the number associated with your invitation.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  data-testid="checkbox-terms"
                />
                <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                  I accept the <a href="#" className="text-primary underline">Terms & Conditions</a>
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="privacy"
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  data-testid="checkbox-privacy"
                />
                <Label htmlFor="privacy" className="text-sm leading-tight cursor-pointer">
                  I accept the <a href="#" className="text-primary underline">Privacy Policy</a>
                </Label>
              </div>
            </div>

            {register.isError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {(register.error as Error).message}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={!isFormValid || register.isPending}
              data-testid="button-register"
            >
              {register.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
