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
import { Ticket, Megaphone, Plus, Calendar, Users, Percent, DollarSign, Gift, Clock, Send, Settings, Save, ScanLine, Check, FileUp, FileCheck, FileX, ChevronRight, Upload, Camera, X, Phone, Receipt, Coins, UserPlus, Trash2, Mail, Lock, Download, QrCode, Pencil, ToggleLeft, ToggleRight, Search, FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
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
  const queryClient = useQueryClient();
  const { portalRole, isOwnerOrManager, restaurant } = useAuth();
  const { selectedBranchId } = useBranch();
  const restaurantId = restaurant?.id;
  
  const canUploadReconciliation = isOwnerOrManager;
  const canCreateVoucher = isOwnerOrManager;
  const canManageUsers = portalRole === 'owner';
  
  // Transaction capture state
  const [capturePhone, setCapturePhone] = useState("");
  const [captureBillId, setCaptureBillId] = useState("");
  const [captureAmount, setCaptureAmount] = useState("");
  const [transactionFilter, setTransactionFilter] = useState("");
  const [captureScannerOpen, setCaptureScannerOpen] = useState(false);
  const [captureIsScanning, setCaptureIsScanning] = useState(false);
  const captureScannerRef = useRef<Html5Qrcode | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<{dinerName: string; pointsEarned: number; currentPoints: number} | null>(null);
  
  // Phone QR scanner state
  const [phoneScannerOpen, setPhoneScannerOpen] = useState(false);
  const [phoneIsScanning, setPhoneIsScanning] = useState(false);
  const phoneScannerRef = useRef<Html5Qrcode | null>(null);
  
  // Portal users state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"manager" | "staff">("staff");
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  
  // Voucher types state
  const [voucherTypeDialogOpen, setVoucherTypeDialogOpen] = useState(false);
  const [editingVoucherType, setEditingVoucherType] = useState<any>(null);
  const [voucherTypeCategory, setVoucherTypeCategory] = useState<"rand_value" | "percentage" | "free_item" | "registration" | "">("");
  const [voucherTypeName, setVoucherTypeName] = useState("");
  const [voucherTypeDescription, setVoucherTypeDescription] = useState("");
  const [voucherTypeRewardDetails, setVoucherTypeRewardDetails] = useState("");
  const [voucherTypeValue, setVoucherTypeValue] = useState<number | string>("");
  const [voucherTypeFreeItemType, setVoucherTypeFreeItemType] = useState("");
  const [voucherTypeFreeItemDescription, setVoucherTypeFreeItemDescription] = useState("");
  const [voucherTypeCreditsCost, setVoucherTypeCreditsCost] = useState<number | string>(1);
  const [voucherTypeValidityDays, setVoucherTypeValidityDays] = useState<number | string>(30);
  const [voucherTypeIsActive, setVoucherTypeIsActive] = useState(true);
  const [voucherTypeRedemptionScope, setVoucherTypeRedemptionScope] = useState<"all_branches" | "specific_branches">("all_branches");
  const [voucherTypeRedeemableBranchIds, setVoucherTypeRedeemableBranchIds] = useState<string[]>([]);
  const [voucherTypeEarningMode, setVoucherTypeEarningMode] = useState<"points" | "visits">("points");
  const [voucherTypePointsPerCurrency, setVoucherTypePointsPerCurrency] = useState<number | string>("");
  const [categorySelectionStep, setCategorySelectionStep] = useState(true); // Show category selection first
  
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
  
  // Fetch recent transactions
  const transactionsQuery = useQuery({
    queryKey: ['restaurant-transactions', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/transactions`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
    enabled: !!restaurantId
  });

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
  
  // Fetch branches for redemption scope selection
  const branchesQuery = useQuery({
    queryKey: ['branches', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/branches`);
      if (!res.ok) throw new Error('Failed to fetch branches');
      return res.json();
    },
    enabled: !!restaurantId
  });
  
  const branches = branchesQuery.data || [];
  const hasMultipleBranches = branches.length > 1;
  
  const resetVoucherTypeForm = () => {
    setVoucherTypeCategory("");
    setVoucherTypeName("");
    setVoucherTypeDescription("");
    setVoucherTypeRewardDetails("");
    setVoucherTypeValue("");
    setVoucherTypeFreeItemType("");
    setVoucherTypeFreeItemDescription("");
    setVoucherTypeCreditsCost(1);
    setVoucherTypeValidityDays(30);
    setVoucherTypeIsActive(true);
    setVoucherTypeRedemptionScope("all_branches");
    setVoucherTypeRedeemableBranchIds([]);
    setVoucherTypeEarningMode("points");
    setVoucherTypePointsPerCurrency("");
    setEditingVoucherType(null);
    setCategorySelectionStep(true);
  };
  
  const openEditVoucherType = (vt: any) => {
    setEditingVoucherType(vt);
    setVoucherTypeCategory(vt.category || "rand_value");
    setVoucherTypeName(vt.name);
    setVoucherTypeDescription(vt.description || "");
    setVoucherTypeRewardDetails(vt.rewardDetails || "");
    setVoucherTypeValue(vt.value || "");
    setVoucherTypeFreeItemType(vt.freeItemType || "");
    setVoucherTypeFreeItemDescription(vt.freeItemDescription || "");
    setVoucherTypeCreditsCost(vt.creditsCost);
    setVoucherTypeValidityDays(vt.validityDays);
    setVoucherTypeIsActive(vt.isActive);
    setVoucherTypeRedemptionScope(vt.redemptionScope || "all_branches");
    setVoucherTypeRedeemableBranchIds(vt.redeemableBranchIds || []);
    setVoucherTypeEarningMode(vt.earningMode || "points");
    setVoucherTypePointsPerCurrency(vt.pointsPerCurrencyOverride || "");
    setCategorySelectionStep(false); // Go straight to details when editing
    setVoucherTypeDialogOpen(true);
  };
  
  const selectCategory = (category: "rand_value" | "percentage" | "free_item" | "registration") => {
    setVoucherTypeCategory(category);
    setCategorySelectionStep(false);
    // Reset mutually exclusive fields when switching categories
    if (category === "free_item") {
      setVoucherTypeValue("");
    } else {
      setVoucherTypeFreeItemType("");
      setVoucherTypeFreeItemDescription("");
    }
    // Set default name based on category
    if (!voucherTypeName) {
      if (category === "rand_value") setVoucherTypeName("R__ Off Your Bill");
      else if (category === "percentage") setVoucherTypeName("__% Off Your Bill");
      else if (category === "free_item") setVoucherTypeName("Free Item");
      else if (category === "registration") setVoucherTypeName("Welcome Voucher - R__ Off Your First Visit");
    }
  };
  
  // Check if registration voucher type already exists
  const existingRegistrationVoucherType = voucherTypesQuery.data?.find((vt: any) => vt.category === "registration");
  
  const isSaveDisabled = () => {
    if (!voucherTypeName.trim() || !voucherTypeCategory) return true;
    if (voucherTypeCategory === "rand_value" && !voucherTypeValue) return true;
    if (voucherTypeCategory === "percentage" && !voucherTypeValue) return true;
    if (voucherTypeCategory === "free_item" && !voucherTypeFreeItemType) return true;
    if (voucherTypeCategory === "registration" && !voucherTypeValue) return true;
    if (voucherTypeRedemptionScope === "specific_branches" && voucherTypeRedeemableBranchIds.length === 0) return true;
    return createVoucherType.isPending || updateVoucherType.isPending;
  };
  
  const createVoucherType = useMutation({
    mutationFn: async (data: { category: string; name: string; description?: string; rewardDetails?: string; value?: number; freeItemType?: string; freeItemDescription?: string; creditsCost: number; validityDays: number; isActive: boolean }) => {
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
    mutationFn: async ({ id, data }: { id: string; data: { category?: string; name?: string; description?: string; rewardDetails?: string; value?: number; freeItemType?: string; freeItemDescription?: string; creditsCost?: number; validityDays?: number; isActive?: boolean } }) => {
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
      category: voucherTypeCategory,
      earningMode: voucherTypeEarningMode,
      pointsPerCurrencyOverride: voucherTypeEarningMode === "points" && voucherTypePointsPerCurrency ? Number(voucherTypePointsPerCurrency) : undefined,
      name: voucherTypeName,
      description: voucherTypeDescription || undefined,
      rewardDetails: voucherTypeRewardDetails || undefined,
      value: voucherTypeValue ? Number(voucherTypeValue) : undefined,
      freeItemType: voucherTypeFreeItemType || undefined,
      freeItemDescription: voucherTypeFreeItemDescription || undefined,
      redemptionScope: voucherTypeRedemptionScope,
      redeemableBranchIds: voucherTypeRedemptionScope === "specific_branches" ? voucherTypeRedeemableBranchIds : undefined,
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
      if (phoneScannerRef.current) {
        phoneScannerRef.current.stop().catch(() => {});
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

  const startPhoneScanner = async () => {
    try {
      setPhoneIsScanning(true);
      const scanner = new Html5Qrcode("phone-qr-reader");
      phoneScannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract phone number from QR code - support formats like "tel:0821234567" or just the number
          let phone = decodedText;
          if (decodedText.startsWith('tel:')) {
            phone = decodedText.replace('tel:', '');
          }
          // Clean up the phone number (remove spaces, dashes)
          phone = phone.replace(/[\s-]/g, '');
          setCapturePhone(phone);
          setCaptureSuccess(null);
          stopPhoneScanner();
          toast({
            title: "Customer QR Scanned",
            description: `Phone: ${phone}`
          });
        },
        () => {}
      );
    } catch (err) {
      console.error("Phone scanner error:", err);
      setPhoneIsScanning(false);
      setPhoneScannerOpen(false);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please enter phone number manually.",
        variant: "destructive"
      });
    }
  };

  const stopPhoneScanner = async () => {
    if (phoneScannerRef.current) {
      try {
        await phoneScannerRef.current.stop();
        phoneScannerRef.current = null;
      } catch (err) {
        console.error("Error stopping phone scanner:", err);
      }
    }
    setPhoneIsScanning(false);
    setPhoneScannerOpen(false);
  };

  // Auto-start phone scanner when dialog opens
  useEffect(() => {
    if (phoneScannerOpen && !phoneIsScanning) {
      const timer = setTimeout(() => {
        startPhoneScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phoneScannerOpen]);

  // Auto-start capture scanner when dialog opens
  useEffect(() => {
    if (captureScannerOpen && !captureIsScanning) {
      const timer = setTimeout(() => {
        startCaptureScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [captureScannerOpen]);

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
      queryClient.invalidateQueries({ queryKey: ['restaurant-transactions', restaurantId] });
      transactionsQuery.refetch();
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
        body: JSON.stringify({ code, billId: billId || undefined, branchId: selectedBranchId || undefined })
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
                  {/* Phone Number Input with QR Scanner */}
                  {phoneScannerOpen ? (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        Scan Customer QR Code
                      </Label>
                      <div className="relative">
                        <div id="phone-qr-reader" className="w-full rounded-lg overflow-hidden"></div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2 gap-1"
                          onClick={stopPhoneScanner}
                          data-testid="button-phone-close-scanner"
                        >
                          <X className="h-4 w-4" /> Close
                        </Button>
                      </div>
                      {!phoneIsScanning && (
                        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Starting camera...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="capture-phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Customer Phone Number
                      </Label>
                      <div className="flex gap-2">
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
                        <Button
                          variant="outline"
                          onClick={() => setPhoneScannerOpen(true)}
                          className="gap-2 shrink-0"
                          data-testid="button-scan-customer-qr"
                        >
                          <QrCode className="h-4 w-4" />
                          Scan
                        </Button>
                      </div>
                    </div>
                  )}

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
                        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Starting camera...
                        </div>
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

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Receipt className="h-5 w-5" />
                      Recent Transactions
                    </CardTitle>
                    <CardDescription>
                      Transactions captured in the last 30 days
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full sm:w-auto"
                    onClick={() => {
                      const transactions = transactionsQuery.data || [];
                      const filtered = transactions.filter((tx: any) => {
                        if (!transactionFilter) return true;
                        const search = transactionFilter.toLowerCase();
                        return tx.dinerName?.toLowerCase().includes(search) ||
                               tx.dinerPhone?.includes(search);
                      });
                      const csvContent = [
                        ['Customer Name', 'Phone', 'Amount (R)', 'Points Earned', 'Date'].join(','),
                        ...filtered.map((tx: any) => [
                          `"${tx.dinerName || ''}"`,
                          tx.dinerPhone || '',
                          parseFloat(tx.amountSpent).toFixed(2),
                          tx.pointsEarned,
                          new Date(tx.transactionDate).toLocaleDateString()
                        ].join(','))
                      ].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Export Complete", description: "Transactions exported to CSV" });
                    }}
                    disabled={!transactionsQuery.data?.length}
                    data-testid="button-export-transactions"
                  >
                    <FileDown className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filter Input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name or phone..."
                    value={transactionFilter}
                    onChange={(e) => setTransactionFilter(e.target.value)}
                    className="pl-9"
                    data-testid="input-transaction-filter"
                  />
                </div>

                {transactionsQuery.isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
                ) : transactionsQuery.data?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No transactions captured yet</p>
                  </div>
                ) : (() => {
                  const filteredTransactions = (transactionsQuery.data || []).filter((tx: any) => {
                    if (!transactionFilter) return true;
                    const search = transactionFilter.toLowerCase();
                    return tx.dinerName?.toLowerCase().includes(search) ||
                           tx.dinerPhone?.includes(search);
                  });
                  
                  if (filteredTransactions.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No transactions match your search</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                        <div>Customer</div>
                        <div>Amount</div>
                        <div>Points</div>
                        <div>Date</div>
                      </div>
                      {filteredTransactions.slice(0, 50).map((tx: any) => (
                        <div key={tx.id} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-dashed last:border-0">
                          <div className="truncate">
                            <p className="font-medium truncate">{tx.dinerName}</p>
                            <p className="text-xs text-muted-foreground truncate">{tx.dinerPhone}</p>
                          </div>
                          <div className="font-mono">R{parseFloat(tx.amountSpent).toFixed(2)}</div>
                          <div className="text-green-600 dark:text-green-400 font-medium">+{tx.pointsEarned}</div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(tx.transactionDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                      {filteredTransactions.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          Showing 50 of {filteredTransactions.length} transactions. Export to see all.
                        </p>
                      )}
                    </div>
                  );
                })()}
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
                          <span className="text-muted-foreground">Earned By</span>
                          <Badge variant="outline" className="font-normal">
                            {vt.earningMode === "visits" ? "Visits" : "Points"}
                          </Badge>
                        </div>
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
              <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                {categorySelectionStep && !editingVoucherType ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Choose Voucher Type</DialogTitle>
                      <DialogDescription>
                        Select the type of reward you want to offer your diners.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                      <Button
                        variant="outline"
                        className="h-auto p-4 justify-start text-left flex-col items-start gap-1"
                        onClick={() => selectCategory("rand_value")}
                        data-testid="button-category-rand-value"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          Rand Value Off Your Bill
                        </div>
                        <p className="text-sm text-muted-foreground font-normal">
                          A fixed Rand amount discount (e.g., R50 off, R100 off)
                        </p>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-4 justify-start text-left flex-col items-start gap-1"
                        onClick={() => selectCategory("percentage")}
                        data-testid="button-category-percentage"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <Percent className="h-5 w-5 text-blue-600" />
                          Percentage Off Your Bill
                        </div>
                        <p className="text-sm text-muted-foreground font-normal">
                          A percentage discount (e.g., 10% off, 20% off)
                        </p>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-4 justify-start text-left flex-col items-start gap-1"
                        onClick={() => selectCategory("free_item")}
                        data-testid="button-category-free-item"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <Gift className="h-5 w-5 text-purple-600" />
                          Free Item on Your Next Visit
                        </div>
                        <p className="text-sm text-muted-foreground font-normal">
                          A complimentary item (e.g., free beverage, starter, dessert)
                        </p>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-auto p-4 justify-start text-left flex-col items-start gap-1",
                          existingRegistrationVoucherType && "opacity-50"
                        )}
                        onClick={() => selectCategory("registration")}
                        disabled={!!existingRegistrationVoucherType}
                        data-testid="button-category-registration"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <UserPlus className="h-5 w-5 text-orange-600" />
                          Registration Voucher (First Visit)
                        </div>
                        <p className="text-sm text-muted-foreground font-normal">
                          {existingRegistrationVoucherType 
                            ? "Already configured - only one registration voucher per restaurant" 
                            : "One-time welcome discount for new diners on their first visit"}
                        </p>
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setVoucherTypeDialogOpen(false)}>
                        Cancel
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>{editingVoucherType ? "Edit Voucher Type" : "Create Voucher Type"}</DialogTitle>
                      <DialogDescription>
                        {voucherTypeCategory === "rand_value" && "Rand value off the customer's bill"}
                        {voucherTypeCategory === "percentage" && "Percentage off the customer's bill"}
                        {voucherTypeCategory === "free_item" && "Free item on next visit"}
                        {voucherTypeCategory === "registration" && "One-time welcome voucher for new diners (first visit only)"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {/* Category-specific fields */}
                      {voucherTypeCategory === "rand_value" && (
                        <div className="grid gap-2">
                          <Label htmlFor="vt-value">Rand Value *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R</span>
                            <Input 
                              id="vt-value" 
                              type="number"
                              min="1"
                              className="pl-7"
                              placeholder="e.g., 50"
                              value={voucherTypeValue}
                              onChange={(e) => setVoucherTypeValue(e.target.value)}
                              data-testid="input-voucher-type-value"
                            />
                          </div>
                        </div>
                      )}
                      {voucherTypeCategory === "percentage" && (
                        <div className="grid gap-2">
                          <Label htmlFor="vt-value">Percentage *</Label>
                          <div className="relative">
                            <Input 
                              id="vt-value" 
                              type="number"
                              min="1"
                              max="100"
                              className="pr-7"
                              placeholder="e.g., 10"
                              value={voucherTypeValue}
                              onChange={(e) => setVoucherTypeValue(e.target.value)}
                              data-testid="input-voucher-type-value"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                          </div>
                        </div>
                      )}
                      {voucherTypeCategory === "free_item" && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="vt-free-item-type">Item Type *</Label>
                            <Select
                              value={voucherTypeFreeItemType}
                              onValueChange={setVoucherTypeFreeItemType}
                            >
                              <SelectTrigger data-testid="select-free-item-type">
                                <SelectValue placeholder="Select item type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beverage">Beverage</SelectItem>
                                <SelectItem value="starter">Starter</SelectItem>
                                <SelectItem value="main">Main Course</SelectItem>
                                <SelectItem value="dessert">Dessert</SelectItem>
                                <SelectItem value="side">Side Dish</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="vt-free-item-desc">Item Description</Label>
                            <Input 
                              id="vt-free-item-desc" 
                              placeholder="e.g., Any soft drink, House wine, etc."
                              value={voucherTypeFreeItemDescription}
                              onChange={(e) => setVoucherTypeFreeItemDescription(e.target.value)}
                              data-testid="input-free-item-description"
                            />
                          </div>
                        </>
                      )}
                      {voucherTypeCategory === "registration" && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="vt-value">Welcome Discount Value (Rand) *</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R</span>
                              <Input 
                                id="vt-value" 
                                type="number"
                                min="1"
                                className="pl-7"
                                placeholder="e.g., 50"
                                value={voucherTypeValue}
                                onChange={(e) => setVoucherTypeValue(e.target.value)}
                                data-testid="input-voucher-type-value"
                              />
                            </div>
                          </div>
                          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                            <p className="text-sm text-orange-800">
                              <strong>Note:</strong> This voucher is automatically issued to new diners when they register. 
                              Each diner can only receive one registration voucher per restaurant in their lifetime, 
                              redeemable only on their first visit.
                            </p>
                          </div>
                        </>
                      )}
                      
                      <Separator />
                      
                      <div className="grid gap-2">
                        <Label htmlFor="vt-name">Voucher Name *</Label>
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
                      {/* Earning Mode Selection */}
                      {voucherTypeCategory !== "registration" && (
                        <div className="grid gap-3">
                          <Label>How is this voucher earned?</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={voucherTypeEarningMode === "points" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setVoucherTypeEarningMode("points")}
                              data-testid="button-earning-points"
                            >
                              Points
                            </Button>
                            <Button
                              type="button"
                              variant={voucherTypeEarningMode === "visits" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setVoucherTypeEarningMode("visits")}
                              data-testid="button-earning-visits"
                            >
                              Visits
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {voucherTypeEarningMode === "points" 
                              ? "Diners earn this voucher by accumulating points from their spending."
                              : "Diners earn this voucher by reaching a visit count threshold."}
                          </p>
                          {voucherTypeEarningMode === "points" && (
                            <div className="grid gap-2 mt-2">
                              <Label htmlFor="vt-points-per-currency">Points per R1 Spent</Label>
                              <Input 
                                id="vt-points-per-currency" 
                                type="number" 
                                min="1"
                                placeholder="Default: 1"
                                value={voucherTypePointsPerCurrency}
                                onChange={(e) => setVoucherTypePointsPerCurrency(e.target.value)}
                                data-testid="input-voucher-type-points-per-currency"
                              />
                              <p className="text-xs text-muted-foreground">
                                Leave empty to use the restaurant default (1 point per R1)
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="vt-credits">
                            {voucherTypeCategory === "registration" 
                              ? "Value"
                              : voucherTypeEarningMode === "points" 
                                ? "Points Required" 
                                : "Visits Required"}
                          </Label>
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
                      
                      {/* Branch Redemption Scope */}
                      {hasMultipleBranches && (
                        <div className="grid gap-3">
                          <Label>Where can this voucher be redeemed?</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={voucherTypeRedemptionScope === "all_branches" ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setVoucherTypeRedemptionScope("all_branches");
                                setVoucherTypeRedeemableBranchIds([]);
                              }}
                              data-testid="button-redemption-all-branches"
                            >
                              All Branches
                            </Button>
                            <Button
                              type="button"
                              variant={voucherTypeRedemptionScope === "specific_branches" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setVoucherTypeRedemptionScope("specific_branches")}
                              data-testid="button-redemption-specific-branches"
                            >
                              Specific Branches
                            </Button>
                          </div>
                          {voucherTypeRedemptionScope === "specific_branches" && (
                            <div className="grid gap-2 pl-2 border-l-2 border-muted">
                              <p className="text-sm text-muted-foreground">Select branches where this voucher can be redeemed:</p>
                              {branches.map((branch: any) => (
                                <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={voucherTypeRedeemableBranchIds.includes(branch.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setVoucherTypeRedeemableBranchIds([...voucherTypeRedeemableBranchIds, branch.id]);
                                      } else {
                                        setVoucherTypeRedeemableBranchIds(voucherTypeRedeemableBranchIds.filter((id: string) => id !== branch.id));
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300"
                                    data-testid={`checkbox-branch-${branch.id}`}
                                  />
                                  <span className="text-sm">{branch.name}</span>
                                  {branch.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
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
                      {!editingVoucherType && (
                        <Button 
                          variant="ghost" 
                          onClick={() => setCategorySelectionStep(true)}
                        >
                          Back
                        </Button>
                      )}
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
                        disabled={isSaveDisabled()}
                        data-testid="button-save-voucher-type"
                      >
                        {(createVoucherType.isPending || updateVoucherType.isPending) ? "Saving..." : (editingVoucherType ? "Update" : "Create")}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
