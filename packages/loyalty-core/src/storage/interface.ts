import type {
  BaseUser,
  BaseBusiness,
  BaseBranch,
  BasePointsBalance,
  BaseTransaction,
  BaseVoucherType,
  BaseVoucher,
  BaseInvitation,
} from "../types";

export interface ILoyaltyStorage {
  getUser(id: string): Promise<BaseUser | undefined>;
  getUserByEmail(email: string): Promise<BaseUser | undefined>;
  getUserByPhone(phone: string): Promise<BaseUser | undefined>;
  createUser(user: Omit<BaseUser, "id" | "createdAt">): Promise<BaseUser>;
  updateUser(id: string, data: Partial<BaseUser>): Promise<BaseUser | undefined>;

  getBusiness(id: string): Promise<BaseBusiness | undefined>;
  updateBusiness(id: string, data: Partial<BaseBusiness>): Promise<BaseBusiness | undefined>;

  getBranch(id: string): Promise<BaseBranch | undefined>;
  getBranchesByBusiness(businessId: string): Promise<BaseBranch[]>;
  createBranch(branch: Omit<BaseBranch, "id" | "createdAt">): Promise<BaseBranch>;

  getPointsBalance(customerId: string, businessId: string, branchId?: string | null): Promise<BasePointsBalance | undefined>;
  upsertPointsBalance(data: Omit<BasePointsBalance, "id" | "createdAt" | "updatedAt">): Promise<BasePointsBalance>;
  updatePointsBalance(id: string, data: Partial<BasePointsBalance>): Promise<BasePointsBalance | undefined>;

  createTransaction(transaction: Omit<BaseTransaction, "id">): Promise<BaseTransaction>;
  getTransactionsByCustomer(customerId: string, businessId: string, limit?: number): Promise<BaseTransaction[]>;
  getTransactionsByBusiness(businessId: string, startDate?: Date, endDate?: Date): Promise<BaseTransaction[]>;

  getVoucherType(id: string): Promise<BaseVoucherType | undefined>;
  getVoucherTypesByBusiness(businessId: string): Promise<BaseVoucherType[]>;
  createVoucherType(voucherType: Omit<BaseVoucherType, "id" | "createdAt">): Promise<BaseVoucherType>;
  updateVoucherType(id: string, data: Partial<BaseVoucherType>): Promise<BaseVoucherType | undefined>;

  getVoucher(id: string): Promise<BaseVoucher | undefined>;
  getVoucherByCode(code: string): Promise<BaseVoucher | undefined>;
  getVouchersByCustomer(customerId: string, businessId: string): Promise<BaseVoucher[]>;
  createVoucher(voucher: Omit<BaseVoucher, "id">): Promise<BaseVoucher>;
  updateVoucher(id: string, data: Partial<BaseVoucher>): Promise<BaseVoucher | undefined>;

  getInvitation(token: string): Promise<BaseInvitation | undefined>;
  createInvitation(invitation: Omit<BaseInvitation, "id" | "createdAt">): Promise<BaseInvitation>;
  updateInvitation(id: string, data: Partial<BaseInvitation>): Promise<BaseInvitation | undefined>;
}
