import { z } from "zod";

export const userTypeEnum = z.enum(["customer", "business_admin"]);
export type UserType = z.infer<typeof userTypeEnum>;

export const voucherEarningModeEnum = z.enum(["points", "visits"]);
export type VoucherEarningMode = z.infer<typeof voucherEarningModeEnum>;

export const loyaltyScopeEnum = z.enum(["organization", "branch"]);
export type LoyaltyScope = z.infer<typeof loyaltyScopeEnum>;

export const voucherStatusEnum = z.enum(["active", "redeemed", "expired"]);
export type VoucherStatus = z.infer<typeof voucherStatusEnum>;

export interface BaseUser {
  id: string;
  analyticsId: string | null;
  email: string;
  password: string;
  name: string;
  lastName: string | null;
  phone: string | null;
  userType: string;
  createdAt: Date;
}

export interface BaseBusiness {
  id: string;
  name: string;
  adminUserId: string;
  voucherValue: string;
  voucherValidityDays: number;
  pointsPerCurrency: number;
  pointsThreshold: number;
  voucherEarningMode: string;
  visitThreshold: number;
  loyaltyScope: string;
  voucherScope: string;
  createdAt: Date;
}

export interface BaseBranch {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export interface BasePointsBalance {
  id: string;
  customerId: string;
  businessId: string;
  branchId: string | null;
  totalPoints: number;
  currentPoints: number;
  totalCredits: number;
  currentCredits: number;
  visitCount: number;
  lastVisitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseTransaction {
  id: string;
  customerId: string;
  businessId: string;
  branchId: string | null;
  billId: string | null;
  amountSpent: string;
  pointsEarned: number;
  transactionDate: Date;
}

export interface BaseVoucherType {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  category: string;
  creditsCost: number;
  validityDays: number;
  isActive: boolean;
  createdAt: Date;
}

export interface BaseVoucher {
  id: string;
  customerId: string;
  businessId: string;
  voucherTypeId: string;
  code: string;
  status: string;
  earnedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedBillId: string | null;
}

export interface BaseInvitation {
  id: string;
  businessId: string;
  branchId: string | null;
  phone: string;
  invitedBy: string;
  status: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}
