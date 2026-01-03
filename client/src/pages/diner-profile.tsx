import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, User, Mail, Phone, Save, Loader2, Trash2, ShieldCheck, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

export default function DinerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  const [phoneChangeModalOpen, setPhoneChangeModalOpen] = useState(false);
  const [pendingNewPhone, setPendingNewPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const changed = 
        name !== (user.name || "") ||
        lastName !== (user.lastName || "") ||
        email !== (user.email || "");
      setHasChanges(changed);
    }
  }, [name, lastName, email, user]);

  useEffect(() => {
    if (!otpExpiresAt) return;
    
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((otpExpiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [otpExpiresAt]);

  const updateProfile = useMutation({
    mutationFn: async (data: { name: string; lastName: string; email: string }) => {
      const res = await fetch(`/api/users/${user?.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      toast({
        title: "Profile updated",
        description: "Your changes have been saved.",
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestPhoneChangeOtp = useMutation({
    mutationFn: async (newPhone: string) => {
      const res = await fetch("/api/phone-change/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPhone }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send verification code");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOtpExpiresAt(new Date(data.expiresAt));
      toast({
        title: "Code sent",
        description: "Enter the 6-digit code sent to your new phone number.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyPhoneChangeOtp = useMutation({
    mutationFn: async (otp: string) => {
      const res = await fetch("/api/phone-change/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      setPhoneChangeModalOpen(false);
      setPhone(data.user.phone);
      setPendingNewPhone("");
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpExpiresAt(null);
      toast({
        title: "Phone number updated",
        description: "Your phone number has been changed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Missing information",
        description: "First name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!email.trim()) {
      toast({
        title: "Missing information",
        description: "Email is required.",
        variant: "destructive",
      });
      return;
    }
    updateProfile.mutate({ name, lastName, email });
  };

  const handlePhoneChange = () => {
    if (!pendingNewPhone.trim()) {
      toast({
        title: "Missing phone number",
        description: "Please enter a new phone number.",
        variant: "destructive",
      });
      return;
    }
    
    if (pendingNewPhone === user?.phone) {
      toast({
        title: "Same phone number",
        description: "This is already your current phone number.",
        variant: "destructive",
      });
      return;
    }
    
    requestPhoneChangeOtp.mutate(pendingNewPhone);
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    const fullOtp = newDigits.join("");
    if (fullOtp.length === 6) {
      verifyPhoneChangeOtp.mutate(fullOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split("");
      setOtpDigits(newDigits);
      verifyPhoneChangeOtp.mutate(pasted);
    }
  };

  const requestDeletion = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to request account deletion");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setDeleteModalOpen(false);
      setDeleteConfirmText("");
      toast({
        title: "Check your email",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm.",
        variant: "destructive",
      });
      return;
    }
    requestDeletion.mutate();
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!user) {
    return (
      <DinerLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </DinerLayout>
    );
  }

  return (
    <DinerLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-1 sm:gap-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-foreground">My Profile</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your personal information.</p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              Personal Information
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Update your details below. Changes will be saved to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="name" className="text-xs sm:text-sm">First Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 sm:h-9 text-sm"
                  data-testid="input-profile-name"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="lastName" className="text-xs sm:text-sm">Surname</Label>
                <Input
                  id="lastName"
                  placeholder="Enter your surname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-10 sm:h-9 text-sm"
                  data-testid="input-profile-lastname"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-xs sm:text-sm">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 sm:h-9 text-sm"
                data-testid="input-profile-email"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="flex items-center gap-2 text-xs sm:text-sm">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                Phone Number
              </Label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  value={phone}
                  readOnly
                  className="h-10 sm:h-9 text-sm bg-muted/50 flex-1"
                  data-testid="display-profile-phone"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPendingNewPhone(phone);
                    setPhoneChangeModalOpen(true);
                  }}
                  className="h-10 sm:h-9 shrink-0"
                  data-testid="button-change-phone"
                >
                  Change
                </Button>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Phone changes require SMS verification
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 sm:pt-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {hasChanges ? "You have unsaved changes" : "All changes saved"}
              </p>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateProfile.isPending}
                className="w-full sm:w-auto h-10 sm:h-9"
                data-testid="button-save-profile"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Account Information</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Details about your Dine&More account.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Account Type</span>
                <span className="font-medium capitalize">{user.userType}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Member ID</span>
                <span className="font-mono text-[10px] sm:text-xs">{user.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl border-destructive/50">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Irreversible actions that affect your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium text-sm sm:text-base">Delete Account</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Permanently delete your account and all associated data.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteModalOpen(true)}
                className="w-full sm:w-auto h-10 sm:h-9"
                data-testid="button-delete-account"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={phoneChangeModalOpen} onOpenChange={(open) => {
        if (!open) {
          setPendingNewPhone("");
          setOtpDigits(["", "", "", "", "", ""]);
          setOtpExpiresAt(null);
        }
        setPhoneChangeModalOpen(open);
      }}>
        <DialogContent className="w-[calc(100%-24px)] max-w-md mx-auto rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
              Change Phone Number
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {otpExpiresAt 
                ? "Enter the 6-digit verification code sent to your new number."
                : "Enter your new phone number. We'll send a verification code to confirm it's yours."}
            </DialogDescription>
          </DialogHeader>
          
          {!otpExpiresAt ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-phone" className="text-xs sm:text-sm">New Phone Number</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  placeholder="+27 82 123 4567"
                  value={pendingNewPhone}
                  onChange={(e) => setPendingNewPhone(e.target.value)}
                  className="h-10 sm:h-9 text-sm"
                  data-testid="input-new-phone"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Code expires in {formatCountdown(countdown)}</span>
              </div>
              <div className="flex justify-center gap-2">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono"
                    data-testid={`input-otp-${index}`}
                  />
                ))}
              </div>
              {countdown === 0 && (
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={handlePhoneChange}
                    disabled={requestPhoneChangeOtp.isPending}
                    className="text-xs sm:text-sm"
                    data-testid="button-resend-code"
                  >
                    {requestPhoneChangeOtp.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Resend verification code
                  </Button>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setPhoneChangeModalOpen(false);
                setPendingNewPhone("");
                setOtpDigits(["", "", "", "", "", ""]);
                setOtpExpiresAt(null);
              }}
              className="w-full sm:w-auto h-10 sm:h-9 order-2 sm:order-1"
            >
              Cancel
            </Button>
            {!otpExpiresAt && (
              <Button
                onClick={handlePhoneChange}
                disabled={!pendingNewPhone.trim() || requestPhoneChangeOtp.isPending}
                className="w-full sm:w-auto h-10 sm:h-9 order-1 sm:order-2"
                data-testid="button-send-code"
              >
                {requestPhoneChangeOtp.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Send Verification Code
              </Button>
            )}
            {otpExpiresAt && (
              <Button
                onClick={() => verifyPhoneChangeOtp.mutate(otpDigits.join(""))}
                disabled={otpDigits.join("").length !== 6 || verifyPhoneChangeOtp.isPending}
                className="w-full sm:w-auto h-10 sm:h-9 order-1 sm:order-2"
                data-testid="button-verify-code"
              >
                {verifyPhoneChangeOtp.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Verify & Update
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="w-[calc(100%-24px)] max-w-md mx-auto rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-3 sm:space-y-4 text-xs sm:text-sm">
              <p>
                This action will permanently delete your account and all your data, including:
              </p>
              <ul className="list-disc list-inside text-xs sm:text-sm space-y-0.5 sm:space-y-1">
                <li>Your profile information</li>
                <li>All loyalty points</li>
                <li>All vouchers (including unredeemed ones)</li>
                <li>Transaction history</li>
              </ul>
              <p className="font-medium text-foreground text-xs sm:text-sm">
                This action cannot be undone.
              </p>
              <p className="text-xs sm:text-sm">
                A confirmation email will be sent to your inbox. You'll need to click the link in that email to complete the deletion.
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground border-t pt-2 sm:pt-3 mt-2 sm:mt-3">
                <strong>Data Retention:</strong> After deletion, your anonymized data will be retained for 90 days for compliance purposes, then permanently removed.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 sm:space-y-2 py-2 sm:py-4">
            <Label htmlFor="confirm-delete" className="text-xs sm:text-sm">
              Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              className="h-10 sm:h-9 text-sm"
              data-testid="input-confirm-delete"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmText("");
              }}
              className="w-full sm:w-auto h-10 sm:h-9 order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || requestDeletion.isPending}
              className="w-full sm:w-auto h-10 sm:h-9 order-1 sm:order-2"
              data-testid="button-confirm-delete"
            >
              {requestDeletion.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Send Confirmation Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DinerLayout>
  );
}
