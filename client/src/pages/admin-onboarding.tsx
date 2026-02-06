import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Building2, MapPin, User, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Globe, GitBranch, Clock } from "lucide-react";
import { getStoredAuth } from "@/lib/queryClient";

function getAuthHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (auth) {
    return { "X-User-Id": auth.userId, "X-User-Type": auth.userType };
  }
  return {};
}

type OnboardingStep = "business" | "contact" | "address" | "online" | "branches" | "review";

const steps: { id: OnboardingStep; title: string; icon: React.ReactNode }[] = [
  { id: "business", title: "Business Details", icon: <Building2 className="h-5 w-5" /> },
  { id: "contact", title: "Contact Info", icon: <User className="h-5 w-5" /> },
  { id: "address", title: "Address", icon: <MapPin className="h-5 w-5" /> },
  { id: "online", title: "Online Presence", icon: <Globe className="h-5 w-5" /> },
  { id: "branches", title: "Branch Locations", icon: <GitBranch className="h-5 w-5" /> },
  { id: "review", title: "Review & Submit", icon: <CheckCircle2 className="h-5 w-5" /> },
];

interface OnboardingData {
  tradingName: string;
  description: string;
  cuisineType: string;
  registrationNumber: string;
  vatNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessHours: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  hasAdditionalBranches: boolean;
  logoUrl: string;
}

interface BranchData {
  name: string;
  address: string;
  phone: string;
  isDefault: boolean;
}

export default function AdminOnboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("business");
  const [formData, setFormData] = useState<OnboardingData>({
    tradingName: "",
    description: "",
    cuisineType: "",
    registrationNumber: "",
    vatNumber: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    businessHours: "",
    streetAddress: "",
    city: "",
    province: "",
    postalCode: "",
    country: "South Africa",
    websiteUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    hasAdditionalBranches: false,
    logoUrl: "",
  });

  const [newBranches, setNewBranches] = useState<BranchData[]>([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");
  const [newBranchPhone, setNewBranchPhone] = useState("");

  const { toast } = useToast();
  const { restaurant } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const restaurantId = restaurant?.id;

  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/admin/restaurant"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/restaurant`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch restaurant");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const { data: existingBranches } = useQuery({
    queryKey: ["/api/admin/branches"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/branches`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (restaurantData) {
      setFormData({
        tradingName: restaurantData.tradingName || "",
        description: restaurantData.description || "",
        cuisineType: restaurantData.cuisineType || "",
        registrationNumber: restaurantData.registrationNumber || "",
        vatNumber: restaurantData.vatNumber || "",
        contactName: restaurantData.contactName || "",
        contactEmail: restaurantData.contactEmail || "",
        contactPhone: restaurantData.contactPhone || "",
        businessHours: restaurantData.businessHours || "",
        streetAddress: restaurantData.streetAddress || "",
        city: restaurantData.city || "",
        province: restaurantData.province || "",
        postalCode: restaurantData.postalCode || "",
        country: restaurantData.country || "South Africa",
        websiteUrl: restaurantData.websiteUrl || "",
        facebookUrl: restaurantData.facebookUrl || "",
        instagramUrl: restaurantData.instagramUrl || "",
        twitterUrl: restaurantData.twitterUrl || "",
        hasAdditionalBranches: restaurantData.hasAdditionalBranches || false,
        logoUrl: restaurantData.logoUrl || "",
      });
    }
  }, [restaurantData]);

  const saveOnboarding = useMutation({
    mutationFn: async (data: Partial<OnboardingData>) => {
      const res = await fetch(`/api/admin/restaurant/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurant"] });
    },
  });

  const createBranch = useMutation({
    mutationFn: async (branch: BranchData) => {
      const res = await fetch(`/api/admin/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(branch),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create branch");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/branches"] });
    },
  });

  const submitOnboarding = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/restaurant/onboarding/submit`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurant"] });
      toast({
        title: "Onboarding Submitted",
        description: "Your restaurant details have been submitted for review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateRestaurant = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/restaurant/onboarding/activate`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to activate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurant"] });
      toast({
        title: "Restaurant Activated!",
        description: "Your restaurant is now live. Diners can register using your link.",
      });
      setLocation("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Activation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleSkipOnboarding = () => {
    sessionStorage.setItem('dinemore_onboarding_skipped', 'true');
    setLocation("/admin/dashboard");
  };

  const handleNext = async () => {
    await saveOnboarding.mutateAsync(formData);
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    await saveOnboarding.mutateAsync(formData);
    for (const branch of newBranches) {
      await createBranch.mutateAsync(branch);
    }
    await submitOnboarding.mutateAsync();
  };

  const handleActivate = async () => {
    await activateRestaurant.mutateAsync();
  };

  const handleAddBranch = () => {
    if (newBranchName.trim()) {
      setNewBranches([...newBranches, {
        name: newBranchName.trim(),
        address: newBranchAddress.trim(),
        phone: newBranchPhone.trim(),
        isDefault: false,
      }]);
      setNewBranchName("");
      setNewBranchAddress("");
      setNewBranchPhone("");
    }
  };

  const handleRemoveBranch = (index: number) => {
    setNewBranches(newBranches.filter((_, i) => i !== index));
  };

  const isBusinessValid = formData.registrationNumber.trim() !== "";
  const isContactValid = formData.contactName.trim() !== "" && formData.contactEmail.trim() !== "" && formData.contactPhone.trim() !== "";
  const isAddressValid = formData.streetAddress.trim() !== "" && formData.city.trim() !== "";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (restaurantData?.onboardingStatus === "active") {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-serif">Restaurant is Live!</CardTitle>
              <CardDescription>
                Your restaurant has been set up and is ready to accept diners.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => setLocation("/admin")} data-testid="button-go-to-dashboard">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipOnboarding}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-skip-onboarding"
            >
              Complete Later &rarr;
            </Button>
          </div>
          <h1 className="text-3xl font-serif font-bold">Restaurant Onboarding</h1>
          <p className="text-muted-foreground">Complete your restaurant profile to get started</p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    index <= currentStepIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step.icon}
                </div>
                <span className={`text-xs hidden sm:block ${index <= currentStepIndex ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
                    index < currentStepIndex ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Progress value={progress} className="h-2" />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{steps[currentStepIndex].title}</CardTitle>
                <CardDescription>
                  Step {currentStepIndex + 1} of {steps.length}
                </CardDescription>
              </div>
              {restaurantData?.onboardingStatus === "submitted" && (
                <Badge variant="secondary">Submitted - Pending Activation</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === "business" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    data-testid="input-business-name"
                    value={restaurantData?.name || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Business name is set during restaurant creation</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tradingName">Trading Name</Label>
                  <Input
                    id="tradingName"
                    data-testid="input-trading-name"
                    value={formData.tradingName}
                    onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                    placeholder="Trading name (if different from business name)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">About Your Business</Label>
                  <Textarea
                    id="description"
                    data-testid="input-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Tell diners about your restaurant..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuisineType">Cuisine Type</Label>
                  <Input
                    id="cuisineType"
                    data-testid="input-cuisine-type"
                    value={formData.cuisineType}
                    onChange={(e) => setFormData({ ...formData, cuisineType: e.target.value })}
                    placeholder="e.g., Italian, Seafood, Fine Dining"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Company Registration Number *</Label>
                    <Input
                      id="registrationNumber"
                      data-testid="input-registration-number"
                      value={formData.registrationNumber}
                      onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      placeholder="e.g., 2024/123456/07"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      data-testid="input-vat-number"
                      value={formData.vatNumber}
                      onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                      placeholder="e.g., 4123456789"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "contact" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person *</Label>
                  <Input
                    id="contactName"
                    data-testid="input-contact-name"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Full name of primary contact"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email Address *</Label>
                    <Input
                      id="contactEmail"
                      data-testid="input-contact-email"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="contact@restaurant.co.za"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone Number *</Label>
                    <Input
                      id="contactPhone"
                      data-testid="input-contact-phone"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="+27 21 123 4567"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessHours">Business Hours</Label>
                  <Textarea
                    id="businessHours"
                    data-testid="input-business-hours"
                    value={formData.businessHours}
                    onChange={(e) => setFormData({ ...formData, businessHours: e.target.value })}
                    placeholder={"Mon-Fri: 11:00 - 22:00\nSat: 10:00 - 23:00\nSun: 10:00 - 21:00"}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {currentStep === "address" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="streetAddress">Street Address *</Label>
                  <Input
                    id="streetAddress"
                    data-testid="input-street-address"
                    value={formData.streetAddress}
                    onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      data-testid="input-city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Cape Town"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      data-testid="input-postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="7441"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">Province</Label>
                    <Input
                      id="province"
                      data-testid="input-province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="Western Cape"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      data-testid="input-country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="South Africa"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "online" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Add your online presence so diners can find you. All fields are optional.</p>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website</Label>
                  <Input
                    id="websiteUrl"
                    data-testid="input-website-url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://www.yourrestaurant.co.za"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebookUrl">Facebook</Label>
                  <Input
                    id="facebookUrl"
                    data-testid="input-facebook-url"
                    value={formData.facebookUrl}
                    onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                    placeholder="https://facebook.com/yourrestaurant"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">Instagram</Label>
                  <Input
                    id="instagramUrl"
                    data-testid="input-instagram-url"
                    value={formData.instagramUrl}
                    onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/yourrestaurant"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterUrl">Twitter / X</Label>
                  <Input
                    id="twitterUrl"
                    data-testid="input-twitter-url"
                    value={formData.twitterUrl}
                    onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                    placeholder="https://twitter.com/yourrestaurant"
                  />
                </div>
              </div>
            )}

            {currentStep === "branches" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your main branch is created automatically. Add any additional branch locations below.
                </p>

                {existingBranches && existingBranches.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Existing Branches</Label>
                    {existingBranches.map((branch: any) => (
                      <div key={branch.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{branch.name}</p>
                          {branch.address && <p className="text-xs text-muted-foreground">{branch.address}</p>}
                        </div>
                        {branch.isDefault && <Badge variant="outline">Default</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {newBranches.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">New Branches to Add</Label>
                    {newBranches.map((branch, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{branch.name}</p>
                          {branch.address && <p className="text-xs text-muted-foreground">{branch.address}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBranch(index)}
                          data-testid={`button-remove-branch-${index}`}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
                  <Label className="text-sm font-medium">Add a Branch</Label>
                  <div className="space-y-2">
                    <Input
                      data-testid="input-new-branch-name"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Branch name (e.g., Sunset Beach)"
                    />
                    <Input
                      data-testid="input-new-branch-address"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      placeholder="Branch address (optional)"
                    />
                    <Input
                      data-testid="input-new-branch-phone"
                      value={newBranchPhone}
                      onChange={(e) => setNewBranchPhone(e.target.value)}
                      placeholder="Branch phone (optional)"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddBranch}
                      disabled={!newBranchName.trim()}
                      data-testid="button-add-branch"
                    >
                      + Add Branch
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Business Details
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <p>Business Name: {restaurantData?.name || "—"}</p>
                      <p>Trading Name: {formData.tradingName || "—"}</p>
                      <p>Cuisine: {formData.cuisineType || "—"}</p>
                      <p>Registration: {formData.registrationNumber || "Not provided"}</p>
                      <p>VAT: {formData.vatNumber || "—"}</p>
                    </div>
                    {formData.description && (
                      <p className="text-sm text-muted-foreground mt-2">About: {formData.description}</p>
                    )}
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" /> Contact Information
                    </h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Contact: {formData.contactName || "—"}</p>
                      <p>Email: {formData.contactEmail || "—"}</p>
                      <p>Phone: {formData.contactPhone || "—"}</p>
                      {formData.businessHours && <p className="whitespace-pre-line">Hours: {formData.businessHours}</p>}
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Business Address
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formData.streetAddress || "—"}, {formData.city || "—"}
                      {formData.province && `, ${formData.province}`}
                      {formData.postalCode && ` ${formData.postalCode}`}
                      {formData.country && `, ${formData.country}`}
                    </p>
                  </div>

                  {(formData.websiteUrl || formData.facebookUrl || formData.instagramUrl || formData.twitterUrl) && (
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <Globe className="h-4 w-4" /> Online Presence
                      </h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {formData.websiteUrl && <p>Website: {formData.websiteUrl}</p>}
                        {formData.facebookUrl && <p>Facebook: {formData.facebookUrl}</p>}
                        {formData.instagramUrl && <p>Instagram: {formData.instagramUrl}</p>}
                        {formData.twitterUrl && <p>Twitter: {formData.twitterUrl}</p>}
                      </div>
                    </div>
                  )}

                  {(existingBranches?.length > 0 || newBranches.length > 0) && (
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <GitBranch className="h-4 w-4" /> Branch Locations
                      </h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {existingBranches?.map((b: any) => (
                          <p key={b.id}>{b.name} {b.isDefault ? "(Default)" : ""} {b.address ? `- ${b.address}` : ""}</p>
                        ))}
                        {newBranches.map((b, i) => (
                          <p key={i} className="text-primary">{b.name} (new) {b.address ? `- ${b.address}` : ""}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {restaurantData?.onboardingStatus === "submitted" ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium">
                      Your onboarding has been submitted. Click below to activate your restaurant and go live.
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      Please review your details above. Once submitted, you can activate your restaurant to make it live.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {currentStep === "review" ? (
                restaurantData?.onboardingStatus === "submitted" ? (
                  <Button
                    onClick={handleActivate}
                    disabled={activateRestaurant.isPending}
                    className="gap-2"
                    data-testid="button-activate"
                  >
                    {activateRestaurant.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Activate & Go Live
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!isBusinessValid || !isAddressValid || !isContactValid || submitOnboarding.isPending}
                    className="gap-2"
                    data-testid="button-submit"
                  >
                    {submitOnboarding.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Submit for Review
                  </Button>
                )
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={
                    (currentStep === "business" && !isBusinessValid) ||
                    (currentStep === "contact" && !isContactValid) ||
                    (currentStep === "address" && !isAddressValid) ||
                    saveOnboarding.isPending
                  }
                  className="gap-2"
                  data-testid="button-next"
                >
                  {saveOnboarding.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
