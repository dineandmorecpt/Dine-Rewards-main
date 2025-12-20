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
import { Ticket, Megaphone, Plus, Calendar, Users, Percent, DollarSign, Gift, Clock, Send, Settings, Save, ScanLine, Check, FileUp, FileCheck, FileX, ChevronRight, Upload, Camera, X, Phone, Receipt, Coins, UserPlus, Trash2, Mail, Lock, Download, QrCode, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/hooks/use-auth";
import { QRCodeCanvas } from "qrcode.react";

// Mock Data

const initialCampaigns = [
  { id: 1, name: "Summer Kickoff", status: "Active", voucher: "Summer Special", audience: "All Diners", sent: 1250, openRate: "45%" },
  { id: 2, name: "We Miss You", status: "Scheduled", voucher: "Loyalty Reward", audience: "Lapsed (>30 days)", sent: 0, openRate: "-" },
  { id: 3, name: "VIP Gala Invite", status: "Completed", voucher: "Welcome Drink", audience: "VIP", sent: 150, openRate: "82%" },
];

export default function AdminVouchers() {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [voucherValue, setVoucherValue] = useState("R100 Loyalty Voucher");
  const [voucherValidityDays, setVoucherValidityDays] = useState<number | string>(30);
  const [pointsPerCurrency, setPointsPerCurrency] = useState<number | string>(1);
  const [pointsThreshold, setPointsThreshold] = useState<number | string>(1000);
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
  const { portalRole, isOwnerOrManager, restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  
  const canUploadReconciliation = isOwnerOrManager;
  const canCreateVoucher = isOwnerOrManager;
  const canManageUsers = portalRole === 'owner';
  
  // Transaction capture state
  const [capturePhone, setCapturePhone] = useState("");
  const [captureBillId, setCaptureBillId] = useState("");
  const [captureAmount, setCaptureAmount] = useState("");
  const [captureScannerOpen, setCaptureScannerOpen] = useState(false);
  const [captureIsScanning, setCaptureIsScanning] = useState(false);
  const captureScannerRef = useRef<Html5Qrcode | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<{dinerName: string; pointsEarned: number; currentPoints: number} | null>(null);
  
  // Portal users state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"manager" | "staff">("staff");
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  
  // Voucher types state
  const [voucherTypeDialogOpen, setVoucherTypeDialogOpen] = useState(false);
  const [editingVoucherType, setEditingVoucherType] = useState<any>(null);
  const [voucherTypeName, setVoucherTypeName] = useState("");
  const [voucherTypeDescription, setVoucherTypeDescription] = useState("");
  const [voucherTypeRewardDetails, setVoucherTypeRewardDetails] = useState("");
  const [voucherTypeCreditsCost, setVoucherTypeCreditsCost] = useState<number | string>(1);
  const [voucherTypeValidityDays, setVoucherTypeValidityDays] = useState<number | string>(30);
  const [voucherTypeIsActive, setVoucherTypeIsActive] = useState(true);
  
  // QR code ref for download
  const qrCodeRef = useRef<HTMLCanvasElement>(null);
  
  // Get registration URL
  const registrationUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/register` 
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
  
  // Fetch portal users
  const portalUsersQuery = useQuery({
    queryKey: ['portal-users', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users`);
      if (!res.ok) throw new Error('Failed to fetch portal users');
      return res.json();
    },
    enabled: !!restaurantId
  });
  
  const addPortalUser = useMutation({
    mutationFn: async ({ email, name, role }: { email: string; name: string; role: string }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role })
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
  
  const removePortalUser = useMutation({
    mutationFn: async (portalUserId: string) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users/${portalUserId}`, {
        method: "DELETE"
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
  
  // Voucher types queries
  const voucherTypesQuery = useQuery({
    queryKey: ['voucher-types', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/voucher-types`);
      if (!res.ok) throw new Error('Failed to fetch voucher types');
      return res.json();
    },
    enabled: !!restaurantId
  });
  
  const resetVoucherTypeForm = () => {
    setVoucherTypeName("");
    setVoucherTypeDescription("");
    setVoucherTypeRewardDetails("");
    setVoucherTypeCreditsCost(1);
    setVoucherTypeValidityDays(30);
    setVoucherTypeIsActive(true);
    setEditingVoucherType(null);
  };
  
  const openEditVoucherType = (vt: any) => {
    setEditingVoucherType(vt);
    setVoucherTypeName(vt.name);
    setVoucherTypeDescription(vt.description || "");
    setVoucherTypeRewardDetails(vt.rewardDetails || "");
    setVoucherTypeCreditsCost(vt.creditsCost);
    setVoucherTypeValidityDays(vt.validityDays);
    setVoucherTypeIsActive(vt.isActive);
    setVoucherTypeDialogOpen(true);
  };
  
  const createVoucherType = useMutation({
    mutationFn: async (data: { name: string; description?: string; rewardDetails?: string; creditsCost: number; validityDays: number; isActive: boolean }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/voucher-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create voucher type");
      }
      return res.json();
    },
    onSuccess: () => {
      voucherTypesQuery.refetch();
      setVoucherTypeDialogOpen(false);
      resetVoucherTypeForm();
      toast({
        title: "Voucher Type Created",
        description: "The voucher type has been created successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Voucher Type",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const updateVoucherType = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; rewardDetails?: string; creditsCost?: number; validityDays?: number; isActive?: boolean } }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/voucher-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update voucher type");
      }
      return res.json();
    },
    onSuccess: () => {
      voucherTypesQuery.refetch();
      setVoucherTypeDialogOpen(false);
      resetVoucherTypeForm();
      toast({
        title: "Voucher Type Updated",
        description: "The voucher type has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Voucher Type",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const deleteVoucherType = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/voucher-types/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete voucher type");
      }
      return res.json();
    },
    onSuccess: () => {
      voucherTypesQuery.refetch();
      toast({
        title: "Voucher Type Deleted",
        description: "The voucher type has been deleted."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Voucher Type",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleSaveVoucherType = () => {
    const data = {
      name: voucherTypeName,
      description: voucherTypeDescription || undefined,
      rewardDetails: voucherTypeRewardDetails || undefined,
      creditsCost: Number(voucherTypeCreditsCost),
      validityDays: Number(voucherTypeValidityDays),
      isActive: voucherTypeIsActive
    };
    
    if (editingVoucherType) {
      updateVoucherType.mutate({ id: editingVoucherType.id, data });
    } else {
      createVoucherType.mutate(data);
    }
  };


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
      const res = await fetch(`/api/restaurants/${restaurantId}/transactions/record`, {
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

  const reconciliationBatches = useQuery({
    queryKey: ['reconciliation-batches', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/reconciliation/batches`);
      if (!res.ok) throw new Error('Failed to fetch batches');
      return res.json();
    },
    enabled: !!restaurantId
  });

  const batchDetails = useQuery({
    queryKey: ['batch-details', selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return null;
      const res = await fetch(`/api/restaurants/${restaurantId}/reconciliation/batches/${selectedBatchId}`);
      if (!res.ok) throw new Error('Failed to fetch batch details');
      return res.json();
    },
    enabled: !!restaurantId && !!selectedBatchId
  });

  const uploadCSV = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const res = await fetch(`/api/restaurants/${restaurantId}/reconciliation/upload`, {
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
      const res = await fetch(`/api/restaurants/${restaurantId}/vouchers/redeem`, {
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
    fetch(`/api/restaurants/${restaurantId}`)
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
      const response = await fetch(`/api/restaurants/${restaurantId}/settings`, {
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
          <TabsList className="grid w-full grid-cols-2 sm:max-w-[300px]">
            <TabsTrigger value="capture">Capture</TabsTrigger>
            <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
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

            {/* Voucher Types Management Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-medium font-serif">Voucher Types</h2>
                  <p className="text-sm text-muted-foreground">Define the reward options diners can choose when they earn voucher credits.</p>
                </div>
                {canCreateVoucher ? (
                  <Button 
                    className="gap-2" 
                    onClick={() => {
                      resetVoucherTypeForm();
                      setVoucherTypeDialogOpen(true);
                    }}
                    data-testid="button-create-voucher-type"
                  >
                    <Plus className="h-4 w-4" /> Create Voucher Type
                  </Button>
                ) : (
                  <Button className="gap-2" variant="outline" disabled>
                    <Lock className="h-4 w-4" /> Create Voucher Type
                  </Button>
                )}
              </div>
              
              {/* Voucher Types List */}
              {voucherTypesQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !voucherTypesQuery.data || voucherTypesQuery.data.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground font-medium">No voucher types created yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create voucher types so diners can choose their rewards when they earn credits.</p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {voucherTypesQuery.data.map((vt: any) => (
                    <Card key={vt.id} className={cn("relative overflow-hidden", !vt.isActive && "opacity-60")} data-testid={`card-voucher-type-${vt.id}`}>
                      <div className={cn("absolute top-0 left-0 right-0 h-1", vt.isActive ? "bg-primary" : "bg-muted")} />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-lg font-serif">{vt.name}</CardTitle>
                          <Badge variant={vt.isActive ? "default" : "secondary"}>
                            {vt.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {vt.description && (
                          <CardDescription className="line-clamp-2">{vt.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pb-2 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Credits Required</span>
                          <span className="font-medium">{vt.creditsCost}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Valid For</span>
                          <span className="font-medium">{vt.validityDays} days</span>
                        </div>
                        {vt.rewardDetails && (
                          <p className="text-xs text-muted-foreground pt-2 border-t">{vt.rewardDetails}</p>
                        )}
                      </CardContent>
                      <CardFooter className="pt-2 border-t bg-muted/20 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-1"
                          onClick={() => openEditVoucherType(vt)}
                          data-testid={`button-edit-voucher-type-${vt.id}`}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="gap-1"
                          onClick={() => updateVoucherType.mutate({ id: vt.id, data: { isActive: !vt.isActive } })}
                          data-testid={`button-toggle-voucher-type-${vt.id}`}
                        >
                          {vt.isActive ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this voucher type?")) {
                              deleteVoucherType.mutate(vt.id);
                            }
                          }}
                          data-testid={`button-delete-voucher-type-${vt.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {/* Voucher Type Dialog */}
            <Dialog open={voucherTypeDialogOpen} onOpenChange={(open) => {
              setVoucherTypeDialogOpen(open);
              if (!open) resetVoucherTypeForm();
            }}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingVoucherType ? "Edit Voucher Type" : "Create Voucher Type"}</DialogTitle>
                  <DialogDescription>
                    {editingVoucherType ? "Update the voucher type details." : "Define a new reward option that diners can choose."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vt-name">Name *</Label>
                    <Input 
                      id="vt-name" 
                      placeholder="e.g., R100 Off Your Bill"
                      value={voucherTypeName}
                      onChange={(e) => setVoucherTypeName(e.target.value)}
                      data-testid="input-voucher-type-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vt-description">Description</Label>
                    <Textarea 
                      id="vt-description" 
                      placeholder="Brief description of the reward..."
                      value={voucherTypeDescription}
                      onChange={(e) => setVoucherTypeDescription(e.target.value)}
                      data-testid="input-voucher-type-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vt-credits">Credits Required</Label>
                      <Input 
                        id="vt-credits" 
                        type="number" 
                        min="1"
                        value={voucherTypeCreditsCost}
                        onChange={(e) => setVoucherTypeCreditsCost(e.target.value)}
                        data-testid="input-voucher-type-credits"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vt-validity">Validity (Days)</Label>
                      <Input 
                        id="vt-validity" 
                        type="number" 
                        min="1"
                        value={voucherTypeValidityDays}
                        onChange={(e) => setVoucherTypeValidityDays(e.target.value)}
                        data-testid="input-voucher-type-validity"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vt-reward-details">Terms & Conditions</Label>
                    <Textarea 
                      id="vt-reward-details" 
                      placeholder="Fine print, exclusions, terms..."
                      value={voucherTypeRewardDetails}
                      onChange={(e) => setVoucherTypeRewardDetails(e.target.value)}
                      data-testid="input-voucher-type-reward-details"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="vt-active">Active (visible to diners)</Label>
                    <Button
                      type="button"
                      variant={voucherTypeIsActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoucherTypeIsActive(!voucherTypeIsActive)}
                      className="gap-2"
                      data-testid="button-voucher-type-active"
                    >
                      {voucherTypeIsActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      {voucherTypeIsActive ? "Active" : "Inactive"}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setVoucherTypeDialogOpen(false);
                      resetVoucherTypeForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveVoucherType}
                    disabled={!voucherTypeName.trim() || createVoucherType.isPending || updateVoucherType.isPending}
                    data-testid="button-save-voucher-type"
                  >
                    {(createVoucherType.isPending || updateVoucherType.isPending) ? "Saving..." : (editingVoucherType ? "Update" : "Create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
