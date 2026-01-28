import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Captcha } from "@/components/ui/captcha";
import { Gift, Loader2, CheckCircle2, AlertCircle, Phone, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import logoImage from "@/assets/logo.png";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const AGE_RANGE_OPTIONS = [
  { value: "18-29", label: "18-29" },
  { value: "30-39", label: "30-39" },
  { value: "40-49", label: "40-49" },
  { value: "50-59", label: "50-59" },
  { value: "60+", label: "60+" },
];

const PROVINCE_OPTIONS = [
  { value: "Eastern Cape", label: "Eastern Cape" },
  { value: "Free State", label: "Free State" },
  { value: "Gauteng", label: "Gauteng" },
  { value: "KwaZulu-Natal", label: "KwaZulu-Natal" },
  { value: "Limpopo", label: "Limpopo" },
  { value: "Mpumalanga", label: "Mpumalanga" },
  { value: "Northern Cape", label: "Northern Cape" },
  { value: "North West", label: "North West" },
  { value: "Western Cape", label: "Western Cape" },
];

export default function Register() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(searchString);
  const token = searchParams.get('token') || '';
  const restaurantId = searchParams.get('restaurantId') || '';
  
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [province, setProvince] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  // Phone verification state for token-based registration
  const [verificationStep, setVerificationStep] = useState<"phone" | "otp" | "details">("phone");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  
  // Captcha token for bot protection
  const [captchaToken, setCaptchaToken] = useState("");

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

  // Request OTP for registration phone verification
  const requestOtp = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch('/api/auth/invitation-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, token }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send verification code");
      }
      return res.json();
    },
    onSuccess: () => {
      setVerificationStep("otp");
      setOtpError("");
    },
  });

  // Verify OTP
  const verifyOtp = useMutation({
    mutationFn: async ({ phoneNumber, otpCode }: { phoneNumber: string; otpCode: string }) => {
      const res = await fetch('/api/auth/verify-invitation-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, otp: otpCode, token }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Invalid verification code");
      }
      return res.json();
    },
    onSuccess: () => {
      setVerificationStep("details");
      setOtpError("");
    },
    onError: (error: Error) => {
      setOtpError(error.message);
    },
  });

  const registerWithToken = useMutation({
    mutationFn: async (data: { token: string; email: string; name: string; lastName: string; gender: string; ageRange: string; province: string; termsAccepted: boolean; privacyAccepted: boolean; captchaToken: string }) => {
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

  const selfRegister = useMutation({
    mutationFn: async (data: { name: string; lastName: string; email: string; phone: string; password: string; gender: string; ageRange: string; province: string; restaurantId?: string }) => {
      const res = await fetch('/api/auth/register-diner', {
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

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerWithToken.mutate({
      token,
      email,
      name,
      lastName,
      gender,
      ageRange,
      province,
      termsAccepted,
      privacyAccepted,
      captchaToken,
    });
  };

  const handleSelfRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    selfRegister.mutate({
      name,
      lastName,
      email,
      phone,
      password,
      gender,
      ageRange,
      province,
      restaurantId: restaurantId || undefined,
    });
  };

  const isTokenFormValid = name.trim() && lastName.trim() && email.trim() && gender && ageRange && province && termsAccepted && privacyAccepted && captchaToken;
  const isPasswordValid = password.length >= 8 && 
    /[A-Z]/.test(password) && 
    /[a-z]/.test(password) && 
    /[0-9]/.test(password) && 
    /[^A-Za-z0-9]/.test(password);
  const isSelfFormValid = name.trim() && lastName.trim() && email.trim() && phone.trim() && gender && ageRange && province && isPasswordValid && termsAccepted && privacyAccepted;

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logoImage} alt="Dine&More" className="h-20 w-auto mx-auto mb-2" />
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle className="text-2xl">Welcome to Dine&More!</CardTitle>
            <CardDescription className="text-base">
              Your registration is complete. Start earning points on your next visit!
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

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logoImage} alt="Dine&More" className="h-24 w-auto mx-auto mb-4" />
            <CardTitle className="text-2xl font-serif">Join Dine&More Rewards</CardTitle>
            <CardDescription>
              Create your account to start earning rewards at participating restaurants!
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSelfRegisterSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">First Name</Label>
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
                  type="tel"
                  placeholder="e.g., 0821234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  data-testid="input-register-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-register-password"
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender" data-testid="select-register-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ageRange">Age Range</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger id="ageRange" data-testid="select-register-age-range">
                    <SelectValue placeholder="Select age range" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger id="province" data-testid="select-register-province">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {selfRegister.isError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {(selfRegister.error as Error).message}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={!isSelfFormValid || selfRegister.isPending}
                data-testid="button-register"
              >
                {selfRegister.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </CardFooter>
          </form>
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
            <img src={logoImage} alt="Dine&More" className="h-20 w-auto mx-auto mb-4" />
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

  // Step 1: Phone verification
  if (verificationStep === "phone") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logoImage} alt="Dine&More" className="h-20 w-auto mx-auto mb-4" />
            <CardTitle className="text-2xl font-serif">Verify Your Number</CardTitle>
            <CardDescription>
              To join {invitation.data?.restaurantName}'s rewards program, please verify your mobile number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                value={invitation.data?.phone || ''}
                disabled
                className="bg-muted text-center text-lg font-mono"
                data-testid="input-verify-phone"
              />
              <p className="text-xs text-muted-foreground text-center">
                We'll send a verification code to this number
              </p>
            </div>

            {requestOtp.isError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
                {(requestOtp.error as Error).message}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className="w-full"
              disabled={requestOtp.isPending}
              onClick={() => requestOtp.mutate(invitation.data?.phone || '')}
              data-testid="button-send-otp"
            >
              {requestOtp.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Verification Code"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Step 2: OTP verification
  if (verificationStep === "otp") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logoImage} alt="Dine&More" className="h-20 w-auto mx-auto mb-4" />
            <CardTitle className="text-2xl font-serif">Enter Code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {invitation.data?.phone}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                data-testid="input-otp"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {otpError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
                {otpError}
              </div>
            )}

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={requestOtp.isPending}
                onClick={() => requestOtp.mutate(invitation.data?.phone || '')}
                data-testid="button-resend-otp"
              >
                {requestOtp.isPending ? "Sending..." : "Resend code"}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              disabled={otp.length !== 6 || verifyOtp.isPending}
              onClick={() => verifyOtp.mutate({ phoneNumber: invitation.data?.phone || '', otpCode: otp })}
              data-testid="button-verify-otp"
            >
              {verifyOtp.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setVerificationStep("phone");
                setOtp("");
                setOtpError("");
              }}
              data-testid="button-back-to-phone"
            >
              Back
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Step 3: Details form (after phone verified)
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logoImage} alt="Dine&More" className="h-20 w-auto mx-auto mb-4" />
          <CardTitle className="text-2xl font-serif">Complete Your Profile</CardTitle>
          <CardDescription>
            Phone verified! Now complete your profile to join {invitation.data?.restaurantName}.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleTokenSubmit}>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">All fields marked with <span className="text-destructive">*</span> are required</p>
            
            <div className="space-y-2">
              <Label htmlFor="name">First Name <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="lastName">Surname <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
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
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender <span className="text-destructive">*</span></Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender" data-testid="select-register-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ageRange">Age Range <span className="text-destructive">*</span></Label>
              <Select value={ageRange} onValueChange={setAgeRange}>
                <SelectTrigger id="ageRange" data-testid="select-register-age-range">
                  <SelectValue placeholder="Select age range" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="province">Province <span className="text-destructive">*</span></Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger id="province" data-testid="select-register-province">
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  I accept the <a href="#" className="text-primary underline">Terms & Conditions</a> <span className="text-destructive">*</span>
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
                  I accept the <a href="#" className="text-primary underline">Privacy Policy</a> <span className="text-destructive">*</span>
                </Label>
              </div>
            </div>

            <Captcha 
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken("")}
              className="flex justify-center"
            />

            {registerWithToken.isError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {(registerWithToken.error as Error).message}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={!isTokenFormValid || registerWithToken.isPending}
              data-testid="button-register"
            >
              {registerWithToken.isPending ? (
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
