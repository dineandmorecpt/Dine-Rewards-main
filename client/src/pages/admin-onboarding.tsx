import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Building2, MapPin, User, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

type OnboardingStep = "business" | "address" | "contact" | "review";

const steps: { id: OnboardingStep; title: string; icon: React.ReactNode }[] = [
  { id: "business", title: "Business Details", icon: <Building2 className="h-5 w-5" /> },
  { id: "address", title: "Address", icon: <MapPin className="h-5 w-5" /> },
  { id: "contact", title: "Contact Info", icon: <User className="h-5 w-5" /> },
  { id: "review", title: "Review & Submit", icon: <CheckCircle2 className="h-5 w-5" /> },
];

interface OnboardingData {
  registrationNumber: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  hasAdditionalBranches: boolean;
  logoUrl: string;
}

export default function AdminOnboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("business");
  const [formData, setFormData] = useState<OnboardingData>({
    registrationNumber: "",
    streetAddress: "",
    city: "",
    province: "",
    postalCode: "",
    country: "South Africa",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    hasAdditionalBranches: false,
    logoUrl: "",
  });

  const { toast } = useToast();
  const { restaurant } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const restaurantId = restaurant?.id;

  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/restaurants", restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}`);
      if (!res.ok) throw new Error("Failed to fetch restaurant");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (restaurantData) {
      setFormData({
        registrationNumber: restaurantData.registrationNumber || "",
        streetAddress: restaurantData.streetAddress || "",
        city: restaurantData.city || "",
        province: restaurantData.province || "",
        postalCode: restaurantData.postalCode || "",
        country: restaurantData.country || "South Africa",
        contactName: restaurantData.contactName || "",
        contactEmail: restaurantData.contactEmail || "",
        contactPhone: restaurantData.contactPhone || "",
        hasAdditionalBranches: restaurantData.hasAdditionalBranches || false,
        logoUrl: restaurantData.logoUrl || "",
      });
    }
  }, [restaurantData]);

  const saveOnboarding = useMutation({
    mutationFn: async (data: Partial<OnboardingData>) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants", restaurantId] });
    },
  });

  const submitOnboarding = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/onboarding/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants", restaurantId] });
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
      const res = await fetch(`/api/restaurants/${restaurantId}/onboarding/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to activate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants", restaurantId] });
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
    await submitOnboarding.mutateAsync();
  };

  const handleActivate = async () => {
    await activateRestaurant.mutateAsync();
  };

  const isBusinessValid = formData.registrationNumber.trim() !== "";
  const isAddressValid = formData.streetAddress.trim() !== "" && formData.city.trim() !== "";
  const isContactValid = formData.contactName.trim() !== "" && formData.contactEmail.trim() !== "" && formData.contactPhone.trim() !== "";

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
          <h1 className="text-3xl font-serif font-bold">Restaurant Onboarding</h1>
          <p className="text-muted-foreground">Complete your restaurant profile to get started</p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index <= currentStepIndex
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {step.icon}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
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
                  <Label htmlFor="registrationNumber">Business Registration Number *</Label>
                  <Input
                    id="registrationNumber"
                    data-testid="input-registration-number"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    placeholder="e.g., 2024/123456/07"
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="hasAdditionalBranches">Do you have other branches to onboard?</Label>
                    <p className="text-sm text-muted-foreground">
                      You can add more branches after completing onboarding
                    </p>
                  </div>
                  <Switch
                    id="hasAdditionalBranches"
                    data-testid="switch-has-branches"
                    checked={formData.hasAdditionalBranches}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasAdditionalBranches: checked })}
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
                      placeholder="Johannesburg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province">Province</Label>
                    <Input
                      id="province"
                      data-testid="input-province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="Gauteng"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      data-testid="input-postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="2000"
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

            {currentStep === "contact" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person Name *</Label>
                  <Input
                    id="contactName"
                    data-testid="input-contact-name"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    data-testid="input-contact-email"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="john@restaurant.co.za"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone *</Label>
                  <Input
                    id="contactPhone"
                    data-testid="input-contact-phone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+27 11 123 4567"
                  />
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
                    <p className="text-sm text-muted-foreground">
                      Registration: {formData.registrationNumber || "Not provided"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Additional Branches: {formData.hasAdditionalBranches ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Address
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formData.streetAddress}, {formData.city}
                      {formData.province && `, ${formData.province}`}
                      {formData.postalCode && ` ${formData.postalCode}`}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" /> Contact Info
                    </h3>
                    <p className="text-sm text-muted-foreground">{formData.contactName}</p>
                    <p className="text-sm text-muted-foreground">{formData.contactEmail}</p>
                    <p className="text-sm text-muted-foreground">{formData.contactPhone}</p>
                  </div>
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
                    (currentStep === "address" && !isAddressValid) ||
                    (currentStep === "contact" && !isContactValid) ||
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
