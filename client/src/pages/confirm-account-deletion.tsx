import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ConfirmAccountDeletion() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
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
        setErrorMessage("No deletion token provided");
        return;
      }

      try {
        const response = await fetch(`/api/account/validate-deletion-token?token=${token}`);
        const data = await response.json();

        setIsValid(data.valid);
        if (!data.valid) {
          setErrorMessage(data.error || "Invalid deletion link");
        }
      } catch (error) {
        setIsValid(false);
        setErrorMessage("Failed to validate deletion link");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleConfirmDeletion = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/account/confirm-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account");
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

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Validating deletion request...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-serif font-bold mb-4">Account Deleted</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been successfully deleted. Your data will be retained for 90 days before permanent removal.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            We're sorry to see you go. If you ever want to come back, you're always welcome to create a new account.
          </p>
          <Link href="/">
            <Button className="w-full" data-testid="button-back-home">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8 text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-serif font-bold mb-4">Invalid Link</h1>
          <p className="text-muted-foreground mb-6">{errorMessage}</p>
          <Link href="/">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-destructive">Confirm Account Deletion</h1>
          <p className="text-muted-foreground mt-2">This is your final confirmation</p>
        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium mb-2">You are about to permanently delete:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Your profile and account information</li>
            <li>All loyalty points across all restaurants</li>
            <li>All vouchers (including unredeemed ones)</li>
            <li>Your complete transaction history</li>
          </ul>
        </div>

        <div className="bg-muted rounded-lg p-4 mb-6">
          <p className="text-xs text-muted-foreground">
            <strong>Data Retention Policy:</strong> After deletion, your anonymized data will be retained for 90 days for compliance and audit purposes, after which it will be permanently removed from our systems.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleConfirmDeletion}
            disabled={isLoading}
            data-testid="button-final-confirm-delete"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Yes, Delete My Account
          </Button>
          
          <Link href="/diner/dashboard">
            <Button variant="outline" className="w-full" data-testid="button-cancel-deletion">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancel and Go Back
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
