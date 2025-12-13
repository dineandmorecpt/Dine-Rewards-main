import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ticket, Megaphone, Plus, Calendar, Users, Percent, DollarSign, Gift, Clock, Send, Settings, Save, ScanLine, Check, FileUp, FileCheck, FileX, ChevronRight, Upload, Camera, X, Phone, Receipt, Coins, UserPlus, Copy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";

// Mock Data
const initialVouchers = [
  { id: 1, title: "Welcome Drink", type: "item", value: "Free Cocktail", expiry: "30 days", active: true, redeemed: 45 },
  { id: 2, title: "Birthday Treat", type: "discount", value: "20% Off", expiry: "7 days", active: true, redeemed: 128 },
  { id: 3, title: "Loyalty Reward", type: "currency", value: "$15 Credit", expiry: "60 days", active: true, redeemed: 312 },
  { id: 4, title: "Summer Special", type: "discount", value: "10% Off", expiry: "30 days", active: false, redeemed: 890 },
];

const initialCampaigns = [
  { id: 1, name: "Summer Kickoff", status: "Active", voucher: "Summer Special", audience: "All Diners", sent: 1250, openRate: "45%" },
  { id: 2, name: "We Miss You", status: "Scheduled", voucher: "Loyalty Reward", audience: "Lapsed (>30 days)", sent: 0, openRate: "-" },
  { id: 3, name: "VIP Gala Invite", status: "Completed", voucher: "Welcome Drink", audience: "VIP", sent: 150, openRate: "82%" },
];

const RESTAURANT_ID = "b563a4ad-6dcc-4b42-8c49-5da98fb8d6ad";

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [voucherValue, setVoucherValue] = useState("R100 Loyalty Voucher");
  const [voucherValidityDays, setVoucherValidityDays] = useState(30);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(1);
  const [pointsThreshold, setPointsThreshold] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [billId, setBillId] = useState("");
  const [redemptionSuccess, setRedemptionSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();
  
  // Transaction capture state
  const [capturePhone, setCapturePhone] = useState("");
  const [captureBillId, setCaptureBillId] = useState("");
  const [captureAmount, setCaptureAmount] = useState("");
  const [captureScannerOpen, setCaptureScannerOpen] = useState(false);
  const [captureIsScanning, setCaptureIsScanning] = useState(false);
  const captureScannerRef = useRef<Html5Qrcode | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<{dinerName: string; pointsEarned: number; currentPoints: number} | null>(null);

  // Invite diner state
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<{phone: string; registrationLink: string; smsSent: boolean} | null>(null);

  const startScanner = async () => {
    try {
      setIsScanning(true);
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setRedeemCode(decodedText.toUpperCase());
          stopScanner();
          toast({
            title: "QR Code Scanned",
            description: `Code: ${decodedText.toUpperCase()}`
          });
        },
        () => {}
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setIsScanning(false);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please enter code manually.",
        variant: "destructive"
      });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
    setScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      if (captureScannerRef.current) {
        captureScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startCaptureScanner = async () => {
    try {
      setCaptureIsScanning(true);
      const scanner = new Html5Qrcode("capture-qr-reader");
      captureScannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setCaptureBillId(decodedText);
          stopCaptureScanner();
          toast({
            title: "Bill QR Scanned",
            description: `Bill ID: ${decodedText}`
          });
        },
        () => {}
      );
    } catch (err) {
      console.error("Capture scanner error:", err);
      setCaptureIsScanning(false);
      setCaptureScannerOpen(false);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please enter bill ID manually.",
        variant: "destructive"
      });
    }
  };

  const stopCaptureScanner = async () => {
    if (captureScannerRef.current) {
      try {
        await captureScannerRef.current.stop();
        captureScannerRef.current = null;
      } catch (err) {
        console.error("Error stopping capture scanner:", err);
      }
    }
    setCaptureIsScanning(false);
    setCaptureScannerOpen(false);
  };

  const recordTransaction = useMutation({
    mutationFn: async ({ phone, billId, amountSpent }: { phone: string; billId?: string; amountSpent: number }) => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/transactions/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, billId: billId || undefined, amountSpent })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record transaction");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCaptureSuccess({
        dinerName: data.dinerName,
        pointsEarned: data.transaction.pointsEarned,
        currentPoints: data.balance.currentPoints
      });
      setCapturePhone("");
      setCaptureBillId("");
      setCaptureAmount("");
      toast({
        title: "Transaction Recorded!",
        description: `${data.dinerName} earned ${data.transaction.pointsEarned} points`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Record Transaction",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const inviteDiner = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/diners/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invitation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const fullLink = window.location.origin + data.invitation.registrationLink;
      setInviteSuccess({
        phone: data.invitation.phone,
        registrationLink: fullLink,
        smsSent: data.smsSent
      });
      setInvitePhone("");
      toast({
        title: data.smsSent ? "SMS Sent!" : "Invitation Created!",
        description: data.smsSent 
          ? `Registration link sent via SMS to ${data.invitation.phone}` 
          : "Share the registration link with the customer."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Invitation",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard."
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  };

  const reconciliationBatches = useQuery({
    queryKey: ['reconciliation-batches', RESTAURANT_ID],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/reconciliation/batches`);
      if (!res.ok) throw new Error('Failed to fetch batches');
      return res.json();
    }
  });

  const batchDetails = useQuery({
    queryKey: ['batch-details', selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return null;
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/reconciliation/batches/${selectedBatchId}`);
      if (!res.ok) throw new Error('Failed to fetch batch details');
      return res.json();
    },
    enabled: !!selectedBatchId
  });

  const uploadCSV = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/reconciliation/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, csvContent: content })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload CSV');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedFile(null);
      reconciliationBatches.refetch();
      toast({
        title: 'CSV Processed',
        description: `Found ${data.summary.matched} matches out of ${data.summary.total} records.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const redeemVoucher = useMutation({
    mutationFn: async ({ code, billId }: { code: string; billId?: string }) => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/vouchers/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, billId: billId || undefined })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to redeem voucher");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setRedemptionSuccess(data.message);
      setRedeemCode("");
      setBillId("");
      toast({
        title: "Voucher Redeemed!",
        description: data.message
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    fetch(`/api/restaurants/${RESTAURANT_ID}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setVoucherValue(data.voucherValue || "R100 Loyalty Voucher");
          setVoucherValidityDays(data.voucherValidityDays || 30);
          setPointsPerCurrency(data.pointsPerCurrency || 1);
          setPointsThreshold(data.pointsThreshold || 1000);
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/restaurants/${RESTAURANT_ID}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherValue,
          voucherValidityDays,
          pointsPerCurrency,
          pointsThreshold
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
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Rewards & Campaigns</h1>
            <p className="text-muted-foreground mt-1">Manage your loyalty rewards and marketing campaigns.</p>
          </div>
        </div>

        <Tabs defaultValue="capture" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-6 max-w-[850px]">
            <TabsTrigger value="capture">Capture</TabsTrigger>
            <TabsTrigger value="invite">Invite</TabsTrigger>
            <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* CAPTURE TRANSACTION TAB */}
          <TabsContent value="capture" className="space-y-6">
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-emerald-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Record Customer Transaction
                </CardTitle>
                <CardDescription>
                  Enter customer phone number and bill details to award loyalty points.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  {/* Phone Number Input */}
                  <div className="space-y-2">
                    <Label htmlFor="capture-phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Customer Phone Number
                    </Label>
                    <Input
                      id="capture-phone"
                      placeholder="e.g., 0821234567"
                      value={capturePhone}
                      onChange={(e) => {
                        setCapturePhone(e.target.value);
                        setCaptureSuccess(null);
                      }}
                      className="font-mono"
                      data-testid="input-capture-phone"
                    />
                  </div>

                  {/* Bill ID Scanner */}
                  {captureScannerOpen ? (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <ScanLine className="h-4 w-4" />
                        Scan Bill QR Code
                      </Label>
                      <div className="relative">
                        <div id="capture-qr-reader" className="w-full rounded-lg overflow-hidden"></div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2 gap-1"
                          onClick={stopCaptureScanner}
                          data-testid="button-capture-close-scanner"
                        >
                          <X className="h-4 w-4" /> Close
                        </Button>
                      </div>
                      {!captureIsScanning && (
                        <Button 
                          onClick={startCaptureScanner} 
                          className="w-full gap-2"
                          data-testid="button-capture-start-camera"
                        >
                          <Camera className="h-4 w-4" /> Start Camera
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <ScanLine className="h-4 w-4" />
                        Bill / Invoice ID
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter or scan bill ID"
                          value={captureBillId}
                          onChange={(e) => setCaptureBillId(e.target.value)}
                          className="font-mono"
                          data-testid="input-capture-bill-id"
                        />
                        <Button
                          variant="outline"
                          onClick={() => setCaptureScannerOpen(true)}
                          className="gap-2 shrink-0"
                          data-testid="button-capture-scan"
                        >
                          <Camera className="h-4 w-4" />
                          Scan
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <Label htmlFor="capture-amount" className="flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      Amount Spent (R)
                    </Label>
                    <Input
                      id="capture-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 250.00"
                      value={captureAmount}
                      onChange={(e) => setCaptureAmount(e.target.value)}
                      className="font-mono"
                      data-testid="input-capture-amount"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={() => recordTransaction.mutate({
                      phone: capturePhone,
                      billId: captureBillId || undefined,
                      amountSpent: parseFloat(captureAmount)
                    })}
                    disabled={!capturePhone.trim() || !captureAmount || recordTransaction.isPending}
                    className="w-full gap-2"
                    data-testid="button-record-transaction"
                  >
                    {recordTransaction.isPending ? (
                      "Recording..."
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Record Transaction
                      </>
                    )}
                  </Button>
                </div>

                {/* Success Message */}
                {captureSuccess && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Transaction recorded for {captureSuccess.dinerName}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Points Earned</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">+{captureSuccess.pointsEarned}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">New Balance</p>
                        <p className="font-semibold">{captureSuccess.currentPoints} points</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVITE DINER TAB */}
          <TabsContent value="invite" className="space-y-6">
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-blue-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Invite New Customer
                </CardTitle>
                <CardDescription>
                  Enter a customer's phone number to create a registration link. Share the link with them to join your rewards program.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="invite-phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Customer Phone Number
                    </Label>
                    <Input
                      id="invite-phone"
                      placeholder="e.g., 0821234567"
                      value={invitePhone}
                      onChange={(e) => {
                        setInvitePhone(e.target.value);
                        setInviteSuccess(null);
                      }}
                      className="font-mono"
                      data-testid="input-invite-phone"
                    />
                  </div>

                  <Button
                    onClick={() => inviteDiner.mutate({ phone: invitePhone })}
                    disabled={!invitePhone.trim() || inviteDiner.isPending}
                    className="w-full gap-2"
                    data-testid="button-invite-diner"
                  >
                    {inviteDiner.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Invitation...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Create Invitation
                      </>
                    )}
                  </Button>
                </div>

                {inviteSuccess && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2 mb-3">
                      <Check className="h-4 w-4" />
                      {inviteSuccess.smsSent 
                        ? `SMS sent to ${inviteSuccess.phone}` 
                        : `Invitation created for ${inviteSuccess.phone}`}
                    </p>
                    {inviteSuccess.smsSent && (
                      <p className="text-sm text-green-600 dark:text-green-400 mb-3">
                        The customer will receive an SMS with the registration link.
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {inviteSuccess.smsSent ? "Registration Link (also sent via SMS)" : "Registration Link"}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={inviteSuccess.registrationLink}
                          readOnly
                          className="font-mono text-xs bg-muted"
                          data-testid="input-registration-link"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(inviteSuccess.registrationLink)}
                          data-testid="button-copy-link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(inviteSuccess.registrationLink, '_blank')}
                          data-testid="button-open-link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {inviteSuccess.smsSent 
                          ? "Link expires in 7 days." 
                          : "Share this link with the customer. It expires in 7 days."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VOUCHERS TAB */}
          <TabsContent value="vouchers" className="space-y-6">
            {/* Redeem Voucher Card */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-primary" />
                  Redeem Customer Voucher
                </CardTitle>
                <CardDescription>
                  Enter the voucher code shown on the customer's phone to redeem their voucher.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  {/* Scanner UI */}
                  {scannerOpen ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <div id="qr-reader" className="w-full rounded-lg overflow-hidden"></div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2 gap-1"
                          onClick={stopScanner}
                        >
                          <X className="h-4 w-4" /> Close
                        </Button>
                      </div>
                      {!isScanning && (
                        <Button onClick={startScanner} className="w-full gap-2">
                          <Camera className="h-4 w-4" /> Start Camera
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setScannerOpen(true)}
                      className="w-full gap-2 h-12 border-dashed"
                      data-testid="button-open-scanner"
                    >
                      <Camera className="h-5 w-5" />
                      Scan QR Code
                    </Button>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">or enter manually</span>
                    <Separator className="flex-1" />
                  </div>

                  <div className="flex gap-3">
                    <Input
                      placeholder="Enter voucher code (e.g., BURG-1234)"
                      value={redeemCode}
                      onChange={(e) => {
                        setRedeemCode(e.target.value.toUpperCase());
                        setRedemptionSuccess(null);
                      }}
                      className="font-mono tracking-wider uppercase"
                      data-testid="input-redeem-code"
                    />
                    <Button
                      onClick={() => redeemVoucher.mutate({ code: redeemCode, billId: billId || undefined })}
                      disabled={!redeemCode.trim() || redeemVoucher.isPending}
                      className="gap-2"
                      data-testid="button-redeem-voucher"
                    >
                      {redeemVoucher.isPending ? (
                        "Processing..."
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Redeem
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-3 items-center">
                    <Input
                      placeholder="Bill/Invoice ID (for reconciliation)"
                      value={billId}
                      onChange={(e) => setBillId(e.target.value)}
                      className="font-mono"
                      data-testid="input-bill-id"
                    />
                  </div>
                </div>
                {redemptionSuccess && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      {redemptionSuccess}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium font-serif">Active Vouchers</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Create Voucher
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Voucher</DialogTitle>
                    <DialogDescription>
                      Define the reward details. This will be added to your voucher library.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="v-title">Voucher Title</Label>
                      <Input id="v-title" placeholder="e.g., Free Dessert" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="v-type">Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discount">Percentage (%)</SelectItem>
                            <SelectItem value="currency">Fixed Amount ($)</SelectItem>
                            <SelectItem value="item">Free Item</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="v-value">Value</Label>
                        <Input id="v-value" placeholder="e.g., 20% or $10" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="v-desc">Description</Label>
                      <Textarea id="v-desc" placeholder="Terms and conditions..." />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="v-expiry">Validity (Days)</Label>
                      <Input id="v-expiry" type="number" placeholder="30" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create Voucher</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vouchers.map((voucher) => (
                <Card key={voucher.id} className={cn("transition-all hover:shadow-md", !voucher.active && "opacity-60")}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">{voucher.title}</CardTitle>
                      <CardDescription>{voucher.value} • {voucher.expiry}</CardDescription>
                    </div>
                    <div className={cn("p-2 rounded-full", 
                      voucher.type === 'discount' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : 
                      voucher.type === 'currency' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    )}>
                      {voucher.type === 'discount' && <Percent className="h-4 w-4" />}
                      {voucher.type === 'currency' && <DollarSign className="h-4 w-4" />}
                      {voucher.type === 'item' && <Gift className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-2 flex items-center text-sm text-muted-foreground">
                      <Ticket className="mr-2 h-4 w-4" />
                      {voucher.redeemed} redeemed
                    </div>
                  </CardContent>
                  <CardFooter className="border-t bg-muted/10 p-3">
                    <div className="flex w-full items-center justify-between">
                      <Badge variant={voucher.active ? "default" : "secondary"}>
                        {voucher.active ? "Active" : "Archived"}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* RECONCILIATION TAB */}
          <TabsContent value="reconciliation" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload POS Export
                  </CardTitle>
                  <CardDescription>
                    Upload a CSV file from your POS system to match redeemed vouchers with bills.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      id="csv-upload"
                      data-testid="input-csv-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {selectedFile ? selectedFile.name : "Click to select CSV file"}
                      </p>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CSV must contain a column with Bill IDs (bill_id, invoice_id, etc.)
                  </p>
                  <Button
                    onClick={() => selectedFile && uploadCSV.mutate(selectedFile)}
                    disabled={!selectedFile || uploadCSV.isPending}
                    className="w-full gap-2"
                    data-testid="button-upload-csv"
                  >
                    {uploadCSV.isPending ? "Processing..." : "Upload & Process"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Batches</CardTitle>
                  <CardDescription>View previous reconciliation results</CardDescription>
                </CardHeader>
                <CardContent>
                  {reconciliationBatches.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : reconciliationBatches.data?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No batches yet</p>
                  ) : (
                    <div className="space-y-2">
                      {reconciliationBatches.data?.slice(0, 5).map((batch: any) => (
                        <div
                          key={batch.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedBatchId(batch.id)}
                          data-testid={`batch-${batch.id}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{batch.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(batch.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={batch.matchedRecords > 0 ? "default" : "secondary"}>
                              {batch.matchedRecords}/{batch.totalRecords} matched
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedBatchId && batchDetails.data && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Batch Details: {batchDetails.data.batch.fileName}</span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedBatchId(null)}>Close</Button>
                  </CardTitle>
                  <CardDescription>
                    {batchDetails.data.summary.matched} matched, {batchDetails.data.summary.unmatched} unmatched
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-4 border-b bg-muted/40 p-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <div>Bill ID</div>
                      <div>Amount</div>
                      <div>Status</div>
                      <div>Voucher</div>
                    </div>
                    <div className="divide-y max-h-[300px] overflow-y-auto">
                      {batchDetails.data.records.map((record: any) => (
                        <div key={record.id} className="grid grid-cols-4 items-center p-3 text-sm">
                          <div className="font-mono">{record.billId}</div>
                          <div>{record.csvAmount || '-'}</div>
                          <div>
                            {record.isMatched ? (
                              <Badge variant="default" className="gap-1">
                                <FileCheck className="h-3 w-3" /> Matched
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <FileX className="h-3 w-3" /> Unmatched
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {record.voucherCode || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CAMPAIGNS TAB */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium font-serif">Marketing Campaigns</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Megaphone className="h-4 w-4" /> New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create Campaign</DialogTitle>
                    <DialogDescription>
                      Push a voucher to a specific segment of your diners.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="c-name">Campaign Name</Label>
                      <Input id="c-name" placeholder="e.g., Summer Weekend Flash Sale" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="c-voucher">Select Voucher</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a reward to send" />
                        </SelectTrigger>
                        <SelectContent>
                          {vouchers.filter(v => v.active).map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>{v.title} ({v.value})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="c-audience">Target Audience</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Who should receive this?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Diners</SelectItem>
                          <SelectItem value="vip">VIP Members Only</SelectItem>
                          <SelectItem value="new">New Signups (Last 30 days)</SelectItem>
                          <SelectItem value="lapsed">Lapsed (No visit &gt; 30 days)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="c-message">Push Notification Message</Label>
                      <Textarea id="c-message" placeholder="Hey [Name], come in this weekend for a treat!" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Schedule</Label>
                        <Select defaultValue="now">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="now">Send Immediately</SelectItem>
                            <SelectItem value="later">Schedule for Later</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="gap-2"><Send className="h-4 w-4" /> Launch Campaign</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border bg-card">
              <div className="grid grid-cols-6 border-b bg-muted/40 p-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">Campaign</div>
                <div>Status</div>
                <div>Audience</div>
                <div>Sent</div>
                <div className="text-right">Open Rate</div>
              </div>
              <div className="divide-y">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="grid grid-cols-6 items-center p-4 text-sm hover:bg-muted/10 transition-colors">
                    <div className="col-span-2">
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Gift className="h-3 w-3" /> {campaign.voucher}
                      </div>
                    </div>
                    <div>
                      <Badge variant={
                        campaign.status === 'Active' ? 'default' : 
                        campaign.status === 'Scheduled' ? 'secondary' : 'outline'
                      } className="font-normal">
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-3 w-3" /> {campaign.audience}
                    </div>
                    <div className="font-mono text-muted-foreground">
                      {campaign.sent > 0 ? campaign.sent.toLocaleString() : '-'}
                    </div>
                    <div className="text-right font-medium">
                      {campaign.openRate}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium font-serif">Reward Settings</h2>
            </div>

            <div className="grid gap-6 max-w-2xl">
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
                      onChange={(e) => setVoucherValidityDays(parseInt(e.target.value) || 30)}
                    />
                    <p className="text-xs text-muted-foreground">
                      How many days the voucher is valid after being generated
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Points Calculation Rules
                  </CardTitle>
                  <CardDescription>
                    Configure how diners earn points and when vouchers are generated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="points-per-currency">Points per R1 Spent</Label>
                    <Input
                      id="points-per-currency"
                      data-testid="input-points-per-currency"
                      type="number"
                      min={1}
                      max={100}
                      value={pointsPerCurrency}
                      onChange={(e) => setPointsPerCurrency(parseInt(e.target.value) || 1)}
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
                      onChange={(e) => setPointsThreshold(parseInt(e.target.value) || 1000)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Points required to automatically generate a voucher
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                data-testid="button-save-settings"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
