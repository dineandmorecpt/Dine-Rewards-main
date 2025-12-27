import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, User, Mail, Phone, Save, Loader2, Trash2 } from "lucide-react";
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
        email !== (user.email || "") ||
        phone !== (user.phone || "");
      setHasChanges(changed);
    }
  }, [name, lastName, email, phone, user]);

  const updateProfile = useMutation({
    mutationFn: async (data: { name: string; lastName: string; email: string; phone: string }) => {
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
    updateProfile.mutate({ name, lastName, email, phone });
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
              <Label htmlFor="phone" className="flex items-center gap-2 text-xs sm:text-sm">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+27 82 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 sm:h-9 text-sm"
                data-testid="input-profile-phone"
              />
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
