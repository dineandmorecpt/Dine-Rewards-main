import { z } from "zod";

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  captchaToken: z.string().min(1, "Security verification required"),
  portal: z.enum(["diner", "restaurant"]).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const forgotPasswordSmsSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

export const requestDeletionSchema = z.object({
  reason: z.string().optional(),
});

export const selfRegisterDinerSchema = z.object({
  name: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Surname is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  password: passwordSchema,
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  province: z.string().min(1, "Province is required"),
  restaurantId: z.string().optional(),
  verificationToken: z.string().optional(),
});

export const tokenLoginSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
});

export const checkTokenLoginSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
});

export const requestOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
});

export const verifyOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const invitationOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  token: z.string().min(1, "Invitation token is required"),
});

export const verifyInvitationOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  otp: z.string().length(6, "Verification code must be 6 digits"),
  token: z.string().min(1, "Invitation token is required"),
});

export const recordTransactionSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  billId: z.string().optional(),
  branchId: z.string().optional(),
  amountSpent: z.coerce.number()
    .refine(val => !isNaN(val), { message: "Amount must be a valid number" })
    .refine(val => val > 0, { message: "Amount must be greater than zero" }),
});

export const createVoucherTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  value: z.number().min(0, "Value must be non-negative").optional(),
  validityDays: z.number().min(1, "Validity must be at least 1 day").max(365, "Validity cannot exceed 365 days"),
  earningMode: z.enum(["points", "visits"]),
  creditsCost: z.number().min(1, "Credits cost must be at least 1"),
  redemptionScope: z.enum(["all_branches", "specific_branches"]),
  redeemableBranchIds: z.array(z.string()).optional(),
});
