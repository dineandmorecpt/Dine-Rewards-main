import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Users, Gift, Settings, Save, UserPlus, Trash2, Mail, Download, QrCode, Building2, Edit, Globe, ShieldCheck, AlertTriangle, Loader2, CheckCircle2, Crown, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import { QRCodeCanvas } from "qrcode.react";
import { getStoredAuth } from "@/lib/queryClient";

function getAuthHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (auth) {
    return { "X-User-Id": auth.userId, "X-User-Type": auth.userType };
  }
  return {};
}

function DinerDiscoverySection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const discoveryQuery = useQuery({
    queryKey: ['/api/admin/discovery'],
    queryFn: async () => {
      const res = await fetch('/api/admin/discovery', { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch discovery settings');
      return res.json();
    },
  });

  const toggleDiscovery = useMutation({
    mutationFn: async ({ enabled, termsAccepted: accepted }: { enabled: boolean; termsAccepted: boolean }) => {
      const res = await fetch('/api/admin/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ enabled, termsAccepted: accepted }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update discovery settings');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discovery'] });
      toast({
        title: data.dinerDiscoveryEnabled ? "Discovery Enabled" : "Discovery Disabled",
        description: data.dinerDiscoveryEnabled
          ? "Your restaurant is now visible to all Dine&More diners."
          : "Your restaurant has been removed from diner discovery.",
      });
      setShowTermsModal(false);
      setTermsAccepted(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isEnabled = discoveryQuery.data?.dinerDiscoveryEnabled ?? false;
  const acceptedAt = discoveryQuery.data?.dinerDiscoveryAcceptedAt;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      setShowTermsModal(true);
    } else {
      toggleDiscovery.mutate({ enabled: false, termsAccepted: false });
    }
  };

  const handleAcceptAndEnable = () => {
    if (!termsAccepted) return;
    toggleDiscovery.mutate({ enabled: true, termsAccepted: true });
  };

  return (
    <>
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Diner Discovery
            </CardTitle>
            <CardDescription>
              Make your restaurant visible to all Dine&More diners as a new rewards partner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">List as Rewards Partner</p>
                <p className="text-sm text-muted-foreground">
                  {isEnabled
                    ? "Your restaurant is currently visible to all diners on Dine&More."
                    : "Enable this to appear in the Dine&More diner directory as a rewards partner."}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={toggleDiscovery.isPending || discoveryQuery.isLoading}
                data-testid="switch-discovery-toggle"
              />
            </div>

            {isEnabled && acceptedAt && (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-green-800">Discovery Active</p>
                  <p className="text-sm text-green-700">
                    Terms accepted on {new Date(acceptedAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}. New diners may join your rewards programme through Dine&More.
                  </p>
                </div>
              </div>
            )}

            {!isEnabled && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">Important Information</p>
                  <p className="text-sm text-amber-700">
                    When you enable discovery, your restaurant will be listed as a rewards partner to all diners on the Dine&More platform. New diners who join your rewards programme through this listing will be billed to your account. You will need to accept the terms and conditions before enabling.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTermsModal} onOpenChange={(open) => {
        if (!open) {
          setShowTermsModal(false);
          setTermsAccepted(false);
        }
      }}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-discovery-terms">
          <DialogHeader className="text-center items-center">
            <div className="mx-auto bg-rose-100 rounded-full p-3 mb-2">
              <ShieldCheck className="h-8 w-8 text-rose-600" />
            </div>
            <DialogTitle className="text-xl">Diner Discovery Terms & Conditions</DialogTitle>
            <DialogDescription className="text-center">
              Please read and accept the following terms before enabling diner discovery.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto border rounded-lg p-4 space-y-3 text-sm text-muted-foreground bg-muted/30">
            <p className="font-semibold text-foreground">1. Diner Registration Charges</p>
            <p>
              By enabling Diner Discovery, you agree that your restaurant will be listed as a rewards partner on the Dine&More platform, visible to all registered diners. Any new diners who register and join your rewards programme through this listing will be added to your account asynchronously.
            </p>

            <p className="font-semibold text-foreground">2. Billing for New Diner Registrations</p>
            <p>
              You acknowledge and accept that you will be charged for each new diner who joins your rewards programme through the Dine&More platform. These charges will be applied to your account as per the current pricing plan. Dine&More reserves the right to update pricing with prior notice.
            </p>

            <p className="font-semibold text-foreground">3. Asynchronous Registration</p>
            <p>
              Diners may register for your rewards programme at any time after discovering your restaurant on the platform. Registrations happen asynchronously and you will be notified of new diner sign-ups via your admin dashboard.
            </p>

            <p className="font-semibold text-foreground">4. Opt-Out</p>
            <p>
              You may disable Diner Discovery at any time from your settings. Disabling will remove your restaurant from the diner listing, but will not affect existing diner memberships or pending charges.
            </p>

            <p className="font-semibold text-foreground">5. Data and Privacy</p>
            <p>
              All diner data is handled in accordance with the Protection of Personal Information Act (POPIA). Restaurant information displayed to diners is limited to your business name, cuisine type, and branch locations.
            </p>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="accept-terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(!!checked)}
              data-testid="checkbox-accept-terms"
            />
            <Label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
              I have read and accept the Diner Discovery Terms & Conditions. I understand that my restaurant will be charged for new diner registrations through the Dine&More platform.
            </Label>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleAcceptAndEnable}
              disabled={!termsAccepted || toggleDiscovery.isPending}
              className="w-full"
              data-testid="button-accept-enable"
            >
              {toggleDiscovery.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                "Accept & Enable Discovery"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowTermsModal(false);
                setTermsAccepted(false);
              }}
              className="w-full text-muted-foreground"
              data-testid="button-cancel-terms"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubscriptionSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedScope, setSelectedScope] = useState<"all" | "specific">("all");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<"monthly" | "annual">("monthly");

  const subscriptionQuery = useQuery({
    queryKey: ['/api/admin/subscription'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription', { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch subscription status');
      return res.json();
    },
  });

  const branchesQuery = useQuery({
    queryKey: ['/api/admin/branches'],
    queryFn: async () => {
      const res = await fetch('/api/admin/branches', { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch branches');
      return res.json();
    },
  });

  const allBranches: { id: string; name: string; isActive: boolean }[] = Array.isArray(branchesQuery.data) ? branchesQuery.data : [];
  const totalBranchCount = allBranches.length || 1;
  const pricePerBranch = subscriptionQuery.data?.pricePerBranch ?? 1299;

  const subscribedScope = subscriptionQuery.data?.subscriptionScope ?? "all";
  const subscribedBranchIds: string[] = subscriptionQuery.data?.subscribedBranchIds ?? [];
  const subscribedBranchCount = subscribedScope === "specific" ? subscribedBranchIds.length : totalBranchCount;

  const selectedCount = selectedScope === "all" ? totalBranchCount : selectedBranchIds.length;
  const previewTotal = pricePerBranch * selectedCount;

  const currentTotal = pricePerBranch * subscribedBranchCount;

  const toggleBranch = (branchId: string) => {
    setSelectedBranchIds(prev =>
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    );
  };

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const body: any = { scope: selectedScope, billingCycle: selectedBillingCycle };
      if (selectedScope === "specific") {
        body.branchIds = selectedBranchIds;
      }
      const res = await fetch('/api/admin/subscription/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to subscribe');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription'] });
      setShowConfirmDialog(false);
      toast({
        title: "Subscription Activated",
        description: "Your restaurant is now subscribed to the Dine&More partner package.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/subscription/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unsubscribe');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription'] });
      setShowCancelDialog(false);
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isSubscribed = subscriptionQuery.data?.isSubscribed ?? false;
  const isCancelled = subscriptionQuery.data?.isCancelled ?? false;
  const plan = subscriptionQuery.data?.plan ?? "free";
  const subscribedAt = subscriptionQuery.data?.subscribedAt;
  const currentBillingCycle = subscriptionQuery.data?.billingCycle ?? "monthly";
  const expiresAt = subscriptionQuery.data?.expiresAt;

  const annualPricePerBranch = pricePerBranch * 12;
  const previewTotalAnnual = annualPricePerBranch * selectedCount;
  const displayTotal = selectedBillingCycle === "annual" ? previewTotalAnnual : previewTotal;

  if (subscriptionQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subscriptionQuery.isError) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-800">Failed to load subscription</p>
                <p className="text-sm text-red-700">Please refresh the page and try again.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Subscription Plan
            </CardTitle>
            <CardDescription>
              Subscribe to unlock campaigns, reservations and deeper data insights for your restaurant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-lg">Current Plan</p>
                  <Badge variant={isSubscribed ? "default" : "secondary"} className="capitalize">
                    {isSubscribed ? "Subscribed" : "Free"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed
                    ? `R${pricePerBranch.toLocaleString()} per branch/month \u00B7 ${subscribedBranchCount} ${subscribedBranchCount === 1 ? 'branch' : 'branches'} \u00B7 R${currentTotal.toLocaleString()}/month total`
                    : "Subscribe to unlock campaigns, reservations and deeper insights."}
                </p>
              </div>
            </div>

            {isSubscribed ? (
              <>
                {isCancelled ? (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800">Subscription Cancelled</p>
                      <p className="text-sm text-amber-700">
                        Your subscription is still active until{" "}
                        <span className="font-semibold">
                          {expiresAt
                            ? new Date(expiresAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
                            : "the end of your billing period"}
                        </span>. No refunds are available for the remaining period.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">Subscription Active</p>
                      <p className="text-sm text-green-700">
                        {subscribedAt
                          ? `Subscribed since ${new Date(subscribedAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}. Billed ${currentBillingCycle === "annual" ? "annually" : "monthly"}.`
                          : "Your subscription is active."}
                      </p>
                    </div>
                  </div>
                )}

                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      What's Included
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        Set up and manage campaigns
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        Manage reservations
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        Deeper data insights on the insights dashboard
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {subscribedScope === "specific" && subscribedBranchIds.length > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-3 text-sm">Subscribed Branches</h4>
                      <div className="flex flex-wrap gap-2">
                        {allBranches.filter(b => subscribedBranchIds.includes(b.id)).map(branch => (
                          <Badge key={branch.id} variant="outline" className="text-xs">{branch.name}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">Billing</p>
                  {currentBillingCycle === "annual" ? (
                    <p>R{pricePerBranch.toLocaleString()} per branch/month &times; {subscribedBranchCount} {subscribedBranchCount === 1 ? 'branch' : 'branches'} &times; 12 months = <span className="font-semibold text-foreground">R{(pricePerBranch * subscribedBranchCount * 12).toLocaleString()}/year</span></p>
                  ) : (
                    <p>R{pricePerBranch.toLocaleString()} per branch/month &times; {subscribedBranchCount} {subscribedBranchCount === 1 ? 'branch' : 'branches'} = <span className="font-semibold text-foreground">R{currentTotal.toLocaleString()}/month</span></p>
                  )}
                  <p>Invoiced {currentBillingCycle === "annual" ? "annually" : "monthly"} via invoice, payable within 7 days.</p>
                  {subscriptionQuery.data?.nextInvoiceDate && (
                    <p>Next invoice: <span className="font-medium text-foreground">{new Date(subscriptionQuery.data.nextInvoiceDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</span> &middot; Payment due: <span className="font-medium text-foreground">{new Date(subscriptionQuery.data.paymentDueDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                  )}
                </div>

                {!isCancelled && (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => setShowCancelDialog(true)}
                    data-testid="button-unsubscribe"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </>
            ) : (
              <>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setSelectedBillingCycle("monthly")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedBillingCycle === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        data-testid="button-cycle-monthly"
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBillingCycle("annual")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedBillingCycle === "annual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        data-testid="button-cycle-annual"
                      >
                        Annual
                      </button>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-bold text-foreground">R{pricePerBranch.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">per branch / month</span>
                    </div>
                    {selectedBillingCycle === "annual" && (
                      <p className="text-sm text-muted-foreground mb-1">
                        R{annualPricePerBranch.toLocaleString()} per branch / year (billed annually)
                      </p>
                    )}
                    <div className="mb-4" />
                    <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                      <li className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0" />
                        Set up and manage campaigns
                      </li>
                      <li className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0" />
                        Manage reservations
                      </li>
                      <li className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0" />
                        Deeper data insights on the insights dashboard
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground border-t pt-3">
                      Billed {selectedBillingCycle === "annual" ? "annually" : "monthly"} via invoice, payable within 7 days.
                      {" "}No refunds upon cancellation — your subscription will remain active until the end of the {selectedBillingCycle === "annual" ? "year" : "month"}.
                    </p>
                  </CardContent>
                </Card>

                {totalBranchCount > 1 && (
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <h4 className="font-medium text-sm">Select branches to subscribe</h4>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="scope"
                            checked={selectedScope === "all"}
                            onChange={() => setSelectedScope("all")}
                            className="accent-primary"
                            data-testid="radio-scope-all"
                          />
                          <span className="text-sm">All branches ({totalBranchCount})</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="scope"
                            checked={selectedScope === "specific"}
                            onChange={() => setSelectedScope("specific")}
                            className="accent-primary"
                            data-testid="radio-scope-specific"
                          />
                          <span className="text-sm">Specific branches</span>
                        </label>
                      </div>

                      {selectedScope === "specific" && (
                        <div className="space-y-2 pl-1">
                          {allBranches.map(branch => (
                            <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedBranchIds.includes(branch.id)}
                                onChange={() => toggleBranch(branch.id)}
                                className="accent-primary rounded"
                                data-testid={`checkbox-branch-${branch.id}`}
                              />
                              <span className="text-sm">{branch.name}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground pt-2 border-t">
                        {selectedCount > 0 ? (
                          selectedBillingCycle === "annual" ? (
                            <p>{selectedCount} {selectedCount === 1 ? 'branch' : 'branches'} &times; R{annualPricePerBranch.toLocaleString()} = <span className="font-semibold text-foreground">R{(annualPricePerBranch * selectedCount).toLocaleString()}/year</span></p>
                          ) : (
                            <p>{selectedCount} {selectedCount === 1 ? 'branch' : 'branches'} &times; R{pricePerBranch.toLocaleString()} = <span className="font-semibold text-foreground">R{previewTotal.toLocaleString()}/month</span></p>
                          )
                        ) : (
                          <p className="text-amber-600">Please select at least one branch</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={selectedScope === "specific" && selectedBranchIds.length === 0}
                  data-testid="button-subscribe"
                >
                  <Crown className="h-4 w-4" />
                  Subscribe Now
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-subscribe-confirm">
          <DialogHeader className="text-center items-center">
            <div className="mx-auto bg-primary/10 rounded-full p-3 mb-2">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl">Confirm Subscription</DialogTitle>
            <DialogDescription className="text-center">
              You are about to subscribe your restaurant to the Dine&More partner package.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
            <p>Your subscription will include:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Set up and manage campaigns</li>
              <li>Manage reservations</li>
              <li>Deeper data insights on the insights dashboard</li>
            </ul>
            {selectedScope === "specific" && selectedBranchIds.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-foreground mb-1">Selected branches:</p>
                <div className="flex flex-wrap gap-1">
                  {allBranches.filter(b => selectedBranchIds.includes(b.id)).map(branch => (
                    <Badge key={branch.id} variant="outline" className="text-xs">{branch.name}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-3 border-t mt-3 space-y-1">
              <p className="font-medium text-foreground">
                {selectedBillingCycle === "annual" ? (
                  <>R{pricePerBranch.toLocaleString()} per branch/month &times; {selectedCount} {selectedCount === 1 ? 'branch' : 'branches'} &times; 12 months = R{displayTotal.toLocaleString()}/year</>
                ) : (
                  <>R{pricePerBranch.toLocaleString()} per branch/month &times; {selectedCount} {selectedCount === 1 ? 'branch' : 'branches'} = R{displayTotal.toLocaleString()}/month</>
                )}
              </p>
              <p className="text-xs">You will be invoiced {selectedBillingCycle === "annual" ? "annually" : "monthly"}. Payment is due within 7 days of the invoice date.</p>
            </div>
            <div className="pt-2 border-t mt-2">
              <p className="text-xs text-muted-foreground">By subscribing, you agree to the following terms: No refunds will be issued upon cancellation. If you cancel, your subscription will remain active until the end of the current {selectedBillingCycle === "annual" ? "annual" : "monthly"} billing period.</p>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
              className="w-full gap-2"
              data-testid="button-confirm-subscribe"
            >
              {subscribeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  Confirm & Subscribe
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowConfirmDialog(false)}
              className="w-full text-muted-foreground"
              data-testid="button-cancel-subscribe"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-cancel-confirm">
          <DialogHeader className="text-center items-center">
            <div className="mx-auto bg-destructive/10 rounded-full p-3 mb-2">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Cancel Subscription</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
            <p className="font-medium text-foreground">Terms & Conditions</p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>Your subscription will remain active until the end of the current {currentBillingCycle === "annual" ? "annual" : "monthly"} billing period{expiresAt ? "" : ` (${currentBillingCycle === "annual" ? "end of subscription year" : "end of current month"})`}.</li>
              <li>No refunds will be issued for the remaining time of your {currentBillingCycle === "annual" ? "annual" : "monthly"} subscription.</li>
              <li>You will continue to have access to all premium features until the subscription expires.</li>
              <li>After expiry, your restaurant will revert to the free plan and premium features will no longer be available.</li>
              <li>You may re-subscribe at any time.</li>
            </ul>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              onClick={() => unsubscribeMutation.mutate()}
              disabled={unsubscribeMutation.isPending}
              className="w-full"
              data-testid="button-confirm-cancel"
            >
              {unsubscribeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowCancelDialog(false)}
              className="w-full text-muted-foreground"
              data-testid="button-keep-subscription"
            >
              Keep Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdminSettingsContent() {
  const [voucherValue, setVoucherValue] = useState("R100 Loyalty Voucher");
  const [voucherValidityDays, setVoucherValidityDays] = useState<number | string>(30);
  const [pointsPerCurrency, setPointsPerCurrency] = useState<number | string>(1);
  const [pointsThreshold, setPointsThreshold] = useState<number | string>(1000);
  const [voucherEarningMode, setVoucherEarningMode] = useState<"points" | "visits">("points");
  const [visitThreshold, setVisitThreshold] = useState<number | string>(10);
  const [loyaltyScope, setLoyaltyScope] = useState<"organization" | "branch">("organization");
  const [voucherScope, setVoucherScope] = useState<"organization" | "branch">("organization");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { portalRole, restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  
  const canManageUsers = portalRole === 'owner';
  const { branches, hasMultipleBranches } = useBranch();
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"manager" | "staff">("staff");
  const [newUserHasAllAccess, setNewUserHasAllAccess] = useState(true);
  const [newUserBranchIds, setNewUserBranchIds] = useState<string[]>([]);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [editBranchDialogOpen, setEditBranchDialogOpen] = useState(false);
  const [editingPortalUser, setEditingPortalUser] = useState<any>(null);
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [editHasAllAccess, setEditHasAllAccess] = useState(true);
  
  const registrationUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/register${restaurantId ? `?restaurantId=${restaurantId}` : ''}` 
    : '/register';
  
  const downloadQRCode = () => {
    const canvas = document.querySelector('#registration-qr-code canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'dine-and-more-registration-qr.png';
      link.href = url;
      link.click();
      toast({
        title: "QR Code Downloaded",
        description: "The registration QR code has been saved as a PNG file."
      });
    }
  };

  const portalUsersQuery = useQuery({
    queryKey: ['/api/admin/staff'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/staff`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch portal users');
      return res.json();
    },
    enabled: !!restaurantId
  });
  
  const addPortalUser = useMutation({
    mutationFn: async ({ email, name, role, hasAllBranchAccess, branchIds }: { email: string; name: string; role: string; hasAllBranchAccess: boolean; branchIds: string[] }) => {
      const res = await fetch(`/api/admin/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ email, name, role, hasAllBranchAccess, branchIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add user");
      }
      return res.json();
    },
    onSuccess: () => {
      portalUsersQuery.refetch();
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("staff");
      setNewUserHasAllAccess(true);
      setNewUserBranchIds([]);
      setAddUserDialogOpen(false);
      toast({
        title: "User Added",
        description: "The user has been added to your portal."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add User",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateBranchAccess = useMutation({
    mutationFn: async ({ portalUserId, hasAllBranchAccess, branchIds }: { portalUserId: string; hasAllBranchAccess: boolean; branchIds: string[] }) => {
      const res = await fetch(`/api/admin/staff/${portalUserId}/branch-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ hasAllBranchAccess, branchIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update branch access");
      }
      return res.json();
    },
    onSuccess: () => {
      portalUsersQuery.refetch();
      setEditBranchDialogOpen(false);
      setEditingPortalUser(null);
      toast({
        title: "Branch Access Updated",
        description: "The user's branch access has been updated."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const removePortalUser = useMutation({
    mutationFn: async (portalUserId: string) => {
      const res = await fetch(`/api/admin/staff/${portalUserId}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to remove user");
      return res.json();
    },
    onSuccess: () => {
      portalUsersQuery.refetch();
      toast({
        title: "User Removed",
        description: "The user has been removed from your portal."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove User",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    fetch(`/api/admin/restaurant`, { credentials: "include", headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setVoucherValue(data.voucherValue || "R100 Loyalty Voucher");
          setVoucherValidityDays(data.voucherValidityDays || 30);
          setPointsPerCurrency(data.pointsPerCurrency || 1);
          setPointsThreshold(data.pointsThreshold || 1000);
          setVoucherEarningMode(data.voucherEarningMode || "points");
          setVisitThreshold(data.visitThreshold || 10);
          setLoyaltyScope(data.loyaltyScope || "organization");
          setVoucherScope(data.voucherScope || "organization");
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/restaurant/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          voucherValue,
          voucherValidityDays,
          pointsPerCurrency,
          pointsThreshold,
          voucherEarningMode,
          visitThreshold,
          loyaltyScope,
          voucherScope
        })
      });
      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your reward settings have been updated successfully."
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-sans font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your restaurant's loyalty program and manage team access.</p>
      </div>

      <Tabs defaultValue="voucher" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-[800px]">
            <TabsTrigger value="voucher">Voucher Config</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="discovery">Discovery</TabsTrigger>
            <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>
            <TabsTrigger value="qr">QR Codes</TabsTrigger>
          </TabsList>

          {/* VOUCHER CONFIGURATION TAB */}
          <TabsContent value="voucher" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Loyalty Voucher Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure the voucher that diners receive when they reach the points threshold.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="voucher-value">Voucher Value / Title</Label>
                    <Input
                      id="voucher-value"
                      data-testid="input-voucher-value"
                      value={voucherValue}
                      onChange={(e) => setVoucherValue(e.target.value)}
                      placeholder="e.g., R100 Loyalty Voucher"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is what diners will see on their voucher (e.g., "R100 Off Your Bill")
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="validity-days">Voucher Validity (Days)</Label>
                    <Input
                      id="validity-days"
                      data-testid="input-validity-days"
                      type="number"
                      min={1}
                      max={365}
                      value={voucherValidityDays}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVoucherValidityDays(val === '' ? '' : parseInt(val) || '');
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Voucher expires this many days after it is created
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Voucher Earning Rules
                  </CardTitle>
                  <CardDescription>
                    Configure how diners earn vouchers - based on spending (points) or number of visits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="voucher-earning-mode">Voucher Earning Mode</Label>
                    <Select
                      value={voucherEarningMode}
                      onValueChange={(value: "points" | "visits") => setVoucherEarningMode(value)}
                    >
                      <SelectTrigger id="voucher-earning-mode" data-testid="select-voucher-earning-mode">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="points">Points-based (spending)</SelectItem>
                        <SelectItem value="visits">Visits-based (visits)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {voucherEarningMode === "points" 
                        ? "Diners earn points based on how much they spend" 
                        : "Diners earn vouchers after a set number of visits"}
                    </p>
                  </div>

                  {voucherEarningMode === "points" ? (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="points-per-currency">Points per R1 Spent</Label>
                        <Input
                          id="points-per-currency"
                          data-testid="input-points-per-currency"
                          type="number"
                          min={1}
                          max={100}
                          value={pointsPerCurrency}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPointsPerCurrency(val === '' ? '' : parseInt(val) || '');
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Number of points diners earn for each R1 spent
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="points-threshold">Points Threshold for Voucher</Label>
                        <Input
                          id="points-threshold"
                          data-testid="input-points-threshold"
                          type="number"
                          min={100}
                          max={10000}
                          value={pointsThreshold}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPointsThreshold(val === '' ? '' : parseInt(val) || '');
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Points required to earn a voucher
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-2">
                      <Label htmlFor="visit-threshold">Visits Required for Voucher</Label>
                      <Input
                        id="visit-threshold"
                        data-testid="input-visit-threshold"
                        type="number"
                        min={1}
                        max={100}
                        value={visitThreshold}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVisitThreshold(val === '' ? '' : parseInt(val) || '');
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of visits required to earn a voucher (e.g., "Buy 10, get 1 free")
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2 pt-2 border-t">
                    <Label htmlFor="loyalty-scope">Points Accumulation</Label>
                    <Select
                      value={loyaltyScope}
                      onValueChange={(value: "organization" | "branch") => setLoyaltyScope(value)}
                    >
                      <SelectTrigger id="loyalty-scope" data-testid="select-loyalty-scope">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Across all branches</SelectItem>
                        <SelectItem value="branch">Per branch only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {loyaltyScope === "organization" 
                        ? "Points earned at any branch count towards the same balance" 
                        : "Each branch tracks its own separate points balance"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="voucher-scope">Voucher Redemption</Label>
                    <Select
                      value={voucherScope}
                      onValueChange={(value: "organization" | "branch") => setVoucherScope(value)}
                    >
                      <SelectTrigger id="voucher-scope" data-testid="select-voucher-scope">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Redeemable at all branches</SelectItem>
                        <SelectItem value="branch">Only at issuing branch</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {voucherScope === "organization" 
                        ? "Vouchers can be redeemed at any of your branches" 
                        : "Vouchers can only be redeemed at the branch where they were earned"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                data-testid="button-save-settings"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full gap-2 md:col-span-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </TabsContent>

          {/* USER MANAGEMENT TAB */}
          <TabsContent value="users" className="space-y-6">
            {canManageUsers ? (
              <>
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Portal User Management
                  </CardTitle>
                  <CardDescription>
                    Add or remove users who can access this restaurant's admin portal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2" data-testid="button-add-user">
                        <UserPlus className="h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Portal User</DialogTitle>
                        <DialogDescription>
                          Add a new user who can access this restaurant's admin portal.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="new-user-name">Name</Label>
                          <Input
                            id="new-user-name"
                            placeholder="e.g., John Smith"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            data-testid="input-new-user-name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="new-user-email">Email</Label>
                          <Input
                            id="new-user-email"
                            type="email"
                            placeholder="e.g., john@example.com"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            data-testid="input-new-user-email"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="new-user-role">Role</Label>
                          <Select value={newUserRole} onValueChange={(val: "manager" | "staff") => setNewUserRole(val)}>
                            <SelectTrigger data-testid="select-new-user-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Managers have full access; Staff can only record transactions and redeem vouchers.
                          </p>
                        </div>
                        {hasMultipleBranches && (
                          <div className="grid gap-2">
                            <Label>Branch Access</Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="new-user-all-branches"
                                checked={newUserHasAllAccess}
                                onCheckedChange={(checked) => {
                                  setNewUserHasAllAccess(!!checked);
                                  if (checked) setNewUserBranchIds([]);
                                }}
                                data-testid="checkbox-all-branches"
                              />
                              <Label htmlFor="new-user-all-branches" className="text-sm font-normal">
                                Access to all branches
                              </Label>
                            </div>
                            {!newUserHasAllAccess && (
                              <div className="space-y-2 pl-6 mt-2">
                                {branches.map((branch) => (
                                  <div key={branch.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`new-branch-${branch.id}`}
                                      checked={newUserBranchIds.includes(branch.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setNewUserBranchIds([...newUserBranchIds, branch.id]);
                                        } else {
                                          setNewUserBranchIds(newUserBranchIds.filter(id => id !== branch.id));
                                        }
                                      }}
                                      data-testid={`checkbox-branch-${branch.id}`}
                                    />
                                    <Label htmlFor={`new-branch-${branch.id}`} className="text-sm font-normal">
                                      {branch.name}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => addPortalUser.mutate({ 
                            email: newUserEmail, 
                            name: newUserName, 
                            role: newUserRole,
                            hasAllBranchAccess: newUserHasAllAccess,
                            branchIds: newUserBranchIds
                          })}
                          disabled={!newUserEmail.trim() || !newUserName.trim() || addPortalUser.isPending || (!newUserHasAllAccess && newUserBranchIds.length === 0)}
                          className="gap-2"
                          data-testid="button-confirm-add-user"
                        >
                          {addPortalUser.isPending ? "Adding..." : "Add User"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <div className="space-y-2">
                    {portalUsersQuery.isLoading && (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading users...</p>
                    )}
                    {portalUsersQuery.data?.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No additional users added yet.</p>
                    )}
                    {portalUsersQuery.data?.map((pu: any) => (
                      <div 
                        key={pu.id} 
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                        data-testid={`portal-user-${pu.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {pu.user?.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{pu.user?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {pu.user?.email || 'No email'}
                            </p>
                            {hasMultipleBranches && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Building2 className="h-3 w-3" />
                                {pu.hasAllBranchAccess ? 'All branches' : 
                                  (pu.branchNames?.length > 0 ? pu.branchNames.join(', ') : 'No branches assigned')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">{pu.role}</Badge>
                          {hasMultipleBranches && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingPortalUser(pu);
                                setEditHasAllAccess(pu.hasAllBranchAccess ?? true);
                                setEditBranchIds(pu.branchIds ?? []);
                                setEditBranchDialogOpen(true);
                              }}
                              data-testid={`button-edit-branches-${pu.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removePortalUser.mutate(pu.id)}
                            disabled={removePortalUser.isPending}
                            data-testid={`button-remove-user-${pu.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Edit Branch Access Dialog */}
              <Dialog open={editBranchDialogOpen} onOpenChange={setEditBranchDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Branch Access</DialogTitle>
                    <DialogDescription>
                      Update branch access for {editingPortalUser?.user?.name || 'this user'}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="edit-all-branches"
                        checked={editHasAllAccess}
                        onCheckedChange={(checked) => {
                          setEditHasAllAccess(!!checked);
                          if (checked) setEditBranchIds([]);
                        }}
                        data-testid="checkbox-edit-all-branches"
                      />
                      <Label htmlFor="edit-all-branches" className="text-sm font-normal">
                        Access to all branches
                      </Label>
                    </div>
                    {!editHasAllAccess && (
                      <div className="space-y-2 pl-6">
                        {branches.map((branch) => (
                          <div key={branch.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-branch-${branch.id}`}
                              checked={editBranchIds.includes(branch.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setEditBranchIds([...editBranchIds, branch.id]);
                                } else {
                                  setEditBranchIds(editBranchIds.filter(id => id !== branch.id));
                                }
                              }}
                              data-testid={`checkbox-edit-branch-${branch.id}`}
                            />
                            <Label htmlFor={`edit-branch-${branch.id}`} className="text-sm font-normal">
                              {branch.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditBranchDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingPortalUser) {
                          updateBranchAccess.mutate({
                            portalUserId: editingPortalUser.id,
                            hasAllBranchAccess: editHasAllAccess,
                            branchIds: editBranchIds
                          });
                        }
                      }}
                      disabled={updateBranchAccess.isPending || (!editHasAllAccess && editBranchIds.length === 0)}
                      data-testid="button-save-branch-access"
                    >
                      {updateBranchAccess.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </>
            ) : (
              <Card className="max-w-2xl">
                <CardHeader className="text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <CardTitle>Access Restricted</CardTitle>
                  <CardDescription>
                    Only the restaurant owner can manage portal users. Please contact your administrator.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          {/* DINER DISCOVERY TAB */}
          <TabsContent value="discovery" className="space-y-6">
            <DinerDiscoverySection />
          </TabsContent>

          {/* SUBSCRIPTION TAB */}
          <TabsContent value="subscription" className="space-y-6">
            <SubscriptionSection />
          </TabsContent>

          {/* QR CODES TAB */}
          <TabsContent value="qr" className="space-y-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Registration QR Code
                </CardTitle>
                <CardDescription>
                  Display this QR code at your restaurant so customers can scan and register for your loyalty program.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div id="registration-qr-code" className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeCanvas
                    value={registrationUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground break-all">
                  {registrationUrl}
                </p>
                <Button
                  onClick={downloadQRCode}
                  variant="outline"
                  className="w-full gap-2"
                  data-testid="button-download-qr"
                >
                  <Download className="h-4 w-4" />
                  Download QR Code (PNG)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}

export default function AdminSettings() {
  return (
    <AdminLayout>
      <AdminSettingsContent />
    </AdminLayout>
  );
}
