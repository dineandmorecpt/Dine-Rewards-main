import { 
  type User, 
  type InsertUser,
  type Restaurant,
  type InsertRestaurant,
  type Branch,
  type InsertBranch,
  type PointsBalance,
  type InsertPointsBalance,
  type Transaction,
  type InsertTransaction,
  type Voucher,
  type InsertVoucher,
  type VoucherType,
  type InsertVoucherType,
  type Campaign,
  type InsertCampaign,
  type ReconciliationBatch,
  type InsertReconciliationBatch,
  type ReconciliationRecord,
  type InsertReconciliationRecord,
  type DinerInvitation,
  type InsertDinerInvitation,
  type PortalUser,
  type InsertPortalUser,
  type ActivityLog,
  type InsertActivityLog,
  type AccountDeletionRequest,
  type InsertAccountDeletionRequest,
  type ArchivedUser,
  type InsertArchivedUser,
  users,
  restaurants,
  branches,
  pointsBalances,
  transactions,
  vouchers,
  voucherTypes,
  campaigns,
  reconciliationBatches,
  reconciliationRecords,
  dinerInvitations,
  portalUsers,
  portalUserBranches,
  activityLogs,
  accountDeletionRequests,
  archivedUsers,
  registrationVoucherStatus,
  phoneChangeRequests,
  type InsertRegistrationVoucherStatus,
  type RegistrationVoucherStatus,
  type InsertPhoneChangeRequest,
  type PhoneChangeRequest
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import crypto from "crypto";

// Generate a unique analytics ID (base62, 12 chars) for anonymized user tracking
function generateAnalyticsId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // User Management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByAccessToken(accessToken: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Restaurant Management
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  getRestaurantsByAdmin(adminUserId: string): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  getAllRestaurants(): Promise<Restaurant[]>;
  
  // Branch Management
  getBranch(id: string): Promise<Branch | undefined>;
  getBranchesByRestaurant(restaurantId: string): Promise<Branch[]>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: string, updates: Partial<InsertBranch>): Promise<Branch>;
  deleteBranch(id: string): Promise<void>;
  getDefaultBranch(restaurantId: string): Promise<Branch | undefined>;
  setDefaultBranch(restaurantId: string, branchId: string): Promise<void>;
  
  // Points Management
  getPointsBalance(dinerId: string, restaurantId: string, branchId?: string | null): Promise<PointsBalance | undefined>;
  createPointsBalance(balance: InsertPointsBalance): Promise<PointsBalance>;
  updatePointsBalance(id: string, updates: { 
    currentPoints?: number; 
    totalPointsEarned?: number; 
    currentVisits?: number;
    totalVisits?: number;
    totalVouchersGenerated?: number;
    pointsCredits?: number;
    visitCredits?: number;
    availableVoucherCredits?: number;
    totalVoucherCreditsEarned?: number;
  }): Promise<PointsBalance>;
  getPointsBalancesByDiner(dinerId: string): Promise<PointsBalance[]>;
  getPointsBalancesByDinerAndRestaurant(dinerId: string, restaurantId: string): Promise<PointsBalance[]>;
  
  // Transaction Management
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByDiner(dinerId: string): Promise<Transaction[]>;
  getTransactionsByDinerAndRestaurant(dinerId: string, restaurantId: string): Promise<Transaction[]>;
  getTransactionsByRestaurant(restaurantId: string, last30Days?: boolean, branchId?: string | null): Promise<Transaction[]>;
  getTransactionByBillId(restaurantId: string, billId: string): Promise<Transaction | undefined>;
  
  // Voucher Management
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  getVouchersByDiner(dinerId: string): Promise<Voucher[]>;
  getVouchersByRestaurant(restaurantId: string, branchId?: string | null): Promise<Voucher[]>;
  redeemVoucher(voucherId: string, billId?: string, branchId?: string): Promise<Voucher>;
  getVoucherByBillId(restaurantId: string, billId: string): Promise<Voucher | undefined>;
  
  // Voucher Type Management
  createVoucherType(voucherType: InsertVoucherType): Promise<VoucherType>;
  getVoucherTypesByRestaurant(restaurantId: string): Promise<VoucherType[]>;
  getActiveVoucherTypesByRestaurant(restaurantId: string): Promise<VoucherType[]>;
  getVoucherType(id: string): Promise<VoucherType | undefined>;
  updateVoucherType(id: string, updates: Partial<InsertVoucherType>): Promise<VoucherType>;
  deleteVoucherType(id: string): Promise<void>;
  
  // Registration Voucher Status (one per diner per restaurant lifetime)
  getRegistrationVoucherStatus(dinerId: string, restaurantId: string): Promise<RegistrationVoucherStatus | undefined>;
  createRegistrationVoucherStatus(status: InsertRegistrationVoucherStatus): Promise<RegistrationVoucherStatus>;
  markRegistrationVoucherRedeemed(dinerId: string, restaurantId: string): Promise<void>;
  getRegistrationVoucherType(restaurantId: string): Promise<VoucherType | undefined>;
  
  // Campaign Management
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaignsByRestaurant(restaurantId: string): Promise<Campaign[]>;
  
  // Restaurant Settings
  updateRestaurantSettings(
    id: string, 
    settings: { 
      voucherValue?: string; 
      voucherValidityDays?: number; 
      pointsPerCurrency?: number; 
      pointsThreshold?: number;
      voucherEarningMode?: string; // 'points' | 'visits'
      visitThreshold?: number;
      loyaltyScope?: string; // 'organization' | 'branch'
      voucherScope?: string; // 'organization' | 'branch'
    }
  ): Promise<Restaurant>;
  
  // Restaurant Onboarding
  updateRestaurantOnboarding(
    id: string,
    data: {
      registrationNumber?: string;
      streetAddress?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      hasAdditionalBranches?: boolean;
      logoUrl?: string;
      onboardingStatus?: string;
      onboardingCompletedAt?: Date | null;
    }
  ): Promise<Restaurant>;
  
  // Restaurant Profile
  updateRestaurantProfile(
    id: string,
    data: {
      name?: string;
      tradingName?: string;
      description?: string;
      cuisineType?: string;
      websiteUrl?: string;
      vatNumber?: string;
      registrationNumber?: string;
      streetAddress?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      twitterUrl?: string;
      businessHours?: string;
      logoUrl?: string;
    }
  ): Promise<Restaurant>;
  
  // Voucher Code Management
  getVoucherByCode(code: string): Promise<Voucher | undefined>;
  getVoucherById(id: string): Promise<Voucher | undefined>;
  updateUserActiveVoucherCode(userId: string, code: string | null): Promise<User>;
  updateUserActiveVoucherPresentation(userId: string, voucherId: string | null, code: string | null): Promise<User>;
  getUserByActiveVoucherCode(code: string): Promise<User | undefined>;
  getUserWithActiveVoucher(code: string): Promise<{ user: User; voucher: Voucher } | undefined>;
  updateUserProfile(userId: string, profile: { name?: string; lastName?: string; email?: string; phone?: string }): Promise<User>;
  
  // Reconciliation Management
  createReconciliationBatch(batch: InsertReconciliationBatch): Promise<ReconciliationBatch>;
  getReconciliationBatchesByRestaurant(restaurantId: string): Promise<ReconciliationBatch[]>;
  getReconciliationBatch(batchId: string): Promise<ReconciliationBatch | undefined>;
  updateReconciliationBatch(batchId: string, updates: Partial<ReconciliationBatch>): Promise<ReconciliationBatch>;
  createReconciliationRecord(record: InsertReconciliationRecord): Promise<ReconciliationRecord>;
  getReconciliationRecordsByBatch(batchId: string): Promise<ReconciliationRecord[]>;
  updateReconciliationRecord(recordId: string, updates: Partial<ReconciliationRecord>): Promise<ReconciliationRecord>;
  
  // Diner Invitation Management
  createDinerInvitation(invitation: InsertDinerInvitation): Promise<DinerInvitation>;
  getDinerInvitationByToken(token: string): Promise<DinerInvitation | undefined>;
  updateDinerInvitation(id: string, updates: Partial<DinerInvitation>): Promise<DinerInvitation>;
  getDinerInvitationsByRestaurant(restaurantId: string): Promise<DinerInvitation[]>;
  
  // Stats
  countAllDiners(): Promise<number>;
  
  // Registered Diners for Restaurant
  getRegisteredDinersByRestaurant(restaurantId: string): Promise<{
    id: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    currentPoints: number;
    totalVouchersGenerated: number;
    availableVoucherCredits: number;
    lastTransactionDate: Date | null;
    createdAt: Date;
  }[]>;
  
  // Portal User Management
  getPortalUsersByRestaurant(restaurantId: string): Promise<(PortalUser & { user: User; branchIds: string[]; branchNames: string[] })[]>;
  addPortalUser(portalUser: InsertPortalUser): Promise<PortalUser>;
  removePortalUser(id: string): Promise<void>;
  getPortalUserByUserAndRestaurant(userId: string, restaurantId: string): Promise<PortalUser | undefined>;
  updatePortalUser(id: string, updates: { hasAllBranchAccess?: boolean; role?: string }): Promise<PortalUser>;
  
  // Portal User Branch Access Management
  getPortalUserBranches(portalUserId: string): Promise<string[]>;
  setPortalUserBranches(portalUserId: string, branchIds: string[]): Promise<void>;
  getAccessibleBranchIds(userId: string, restaurantId: string): Promise<{ branchIds: string[]; hasAllAccess: boolean }>;
  updatePortalUserBranchAccess(portalUserId: string, hasAllBranchAccess: boolean, branchIds: string[]): Promise<void>;
  
  // Activity Log Management
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByRestaurant(restaurantId: string, limit?: number): Promise<(ActivityLog & { user?: User })[]>;
  
  // Diner Registration Stats
  getDinerRegistrationsByDateRange(restaurantId: string, startDate: Date, endDate: Date, branchId?: string | null): Promise<{ date: string; count: number }[]>;
  getVoucherRedemptionsByType(restaurantId: string, startDate?: Date, endDate?: Date, branchId?: string | null): Promise<{ voucherTypeName: string; count: number }[]>;
  getRevenueByDateRange(restaurantId: string, startDate: Date, endDate: Date, branchId?: string | null): Promise<{ date: string; amount: number }[]>;
  
  // Password Reset
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Account Deletion
  createAccountDeletionRequest(userId: string, token: string, expiresAt: Date): Promise<AccountDeletionRequest>;
  getAccountDeletionRequestByToken(token: string): Promise<AccountDeletionRequest | undefined>;
  confirmAccountDeletionRequest(token: string): Promise<void>;
  archiveUser(user: User, reason?: string): Promise<ArchivedUser>;
  deleteUser(userId: string): Promise<void>;
  
  // Phone Change Requests (OTP verification)
  createPhoneChangeRequest(request: { userId: string; newPhone: string; otpHash: string; expiresAt: Date }): Promise<PhoneChangeRequest>;
  getActivePhoneChangeRequest(userId: string): Promise<PhoneChangeRequest | undefined>;
  incrementPhoneChangeAttempts(id: string): Promise<PhoneChangeRequest>;
  markPhoneChangeVerified(id: string): Promise<void>;
  expirePhoneChangeRequest(id: string): Promise<void>;
  updateUserPhone(userId: string, phone: string): Promise<User>;
}

export class DbStorage implements IStorage {
  // User Methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone));
    return result[0];
  }

  async getUserByAccessToken(accessToken: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.accessToken, accessToken));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Auto-generate analytics ID for new users (anonymized ID for trend reporting)
    const userWithAnalyticsId = {
      ...insertUser,
      analyticsId: insertUser.analyticsId || generateAnalyticsId(),
    };
    const result = await db.insert(users).values(userWithAnalyticsId).returning();
    return result[0];
  }

  // Restaurant Methods
  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    const result = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return result[0];
  }

  async getRestaurantsByAdmin(adminUserId: string): Promise<Restaurant[]> {
    return await db.select().from(restaurants).where(eq(restaurants.adminUserId, adminUserId));
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const result = await db.insert(restaurants).values(restaurant).returning();
    return result[0];
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants);
  }

  // Branch Methods
  async getBranch(id: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.id, id));
    return result[0];
  }

  async getBranchesByRestaurant(restaurantId: string): Promise<Branch[]> {
    return await db.select().from(branches)
      .where(eq(branches.restaurantId, restaurantId))
      .orderBy(desc(branches.isDefault), branches.name);
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const result = await db.insert(branches).values(branch).returning();
    return result[0];
  }

  async updateBranch(id: string, updates: Partial<InsertBranch>): Promise<Branch> {
    const result = await db.update(branches)
      .set(updates)
      .where(eq(branches.id, id))
      .returning();
    return result[0];
  }

  async deleteBranch(id: string): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
  }

  async getDefaultBranch(restaurantId: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches)
      .where(and(eq(branches.restaurantId, restaurantId), eq(branches.isDefault, true)));
    return result[0];
  }

  async setDefaultBranch(restaurantId: string, branchId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(branches)
        .set({ isDefault: false })
        .where(eq(branches.restaurantId, restaurantId));
      await tx.update(branches)
        .set({ isDefault: true })
        .where(and(eq(branches.id, branchId), eq(branches.restaurantId, restaurantId)));
    });
  }

  // Points Balance Methods
  async getPointsBalance(dinerId: string, restaurantId: string, branchId?: string | null): Promise<PointsBalance | undefined> {
    // If branchId is explicitly provided (including null for org-wide), filter by it
    if (branchId === undefined) {
      // Legacy behavior: get org-wide balance (branchId is null)
      const result = await db.select().from(pointsBalances)
        .where(and(
          eq(pointsBalances.dinerId, dinerId),
          eq(pointsBalances.restaurantId, restaurantId),
          sql`${pointsBalances.branchId} IS NULL`
        ));
      return result[0];
    } else if (branchId === null) {
      // Explicitly looking for org-wide balance
      const result = await db.select().from(pointsBalances)
        .where(and(
          eq(pointsBalances.dinerId, dinerId),
          eq(pointsBalances.restaurantId, restaurantId),
          sql`${pointsBalances.branchId} IS NULL`
        ));
      return result[0];
    } else {
      // Looking for branch-specific balance
      const result = await db.select().from(pointsBalances)
        .where(and(
          eq(pointsBalances.dinerId, dinerId),
          eq(pointsBalances.restaurantId, restaurantId),
          eq(pointsBalances.branchId, branchId)
        ));
      return result[0];
    }
  }

  async createPointsBalance(balance: InsertPointsBalance): Promise<PointsBalance> {
    const result = await db.insert(pointsBalances).values(balance).returning();
    return result[0];
  }

  async updatePointsBalance(
    id: string, 
    updates: { 
      currentPoints?: number; 
      totalPointsEarned?: number; 
      currentVisits?: number;
      totalVisits?: number;
      totalVouchersGenerated?: number;
      pointsCredits?: number;
      visitCredits?: number;
      availableVoucherCredits?: number;
      totalVoucherCreditsEarned?: number;
    }
  ): Promise<PointsBalance> {
    const result = await db.update(pointsBalances)
      .set({ 
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(pointsBalances.id, id))
      .returning();
    return result[0];
  }

  async getPointsBalancesByDiner(dinerId: string): Promise<PointsBalance[]> {
    return await db.select().from(pointsBalances).where(eq(pointsBalances.dinerId, dinerId));
  }

  async getPointsBalancesByDinerAndRestaurant(dinerId: string, restaurantId: string): Promise<PointsBalance[]> {
    return await db.select().from(pointsBalances)
      .where(and(
        eq(pointsBalances.dinerId, dinerId),
        eq(pointsBalances.restaurantId, restaurantId)
      ));
  }

  // Transaction Methods
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async getTransactionsByDiner(dinerId: string): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.dinerId, dinerId))
      .orderBy(desc(transactions.transactionDate));
  }

  async getTransactionsByDinerAndRestaurant(dinerId: string, restaurantId: string): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(and(
        eq(transactions.dinerId, dinerId),
        eq(transactions.restaurantId, restaurantId)
      ))
      .orderBy(desc(transactions.transactionDate));
  }

  async getTransactionsByRestaurant(restaurantId: string, last30Days = false, branchId?: string | null): Promise<Transaction[]> {
    const conditions = [eq(transactions.restaurantId, restaurantId)];
    
    if (branchId) {
      conditions.push(eq(transactions.branchId, branchId));
    }
    
    if (last30Days) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      conditions.push(gte(transactions.transactionDate, thirtyDaysAgo));
    }
    
    return await db.select().from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.transactionDate));
  }

  async getTransactionByBillId(restaurantId: string, billId: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions)
      .where(and(
        eq(transactions.restaurantId, restaurantId),
        eq(transactions.billId, billId)
      ))
      .limit(1);
    return result[0];
  }

  // Voucher Methods
  async createVoucher(voucher: InsertVoucher): Promise<Voucher> {
    const result = await db.insert(vouchers).values(voucher).returning();
    return result[0];
  }

  async getVouchersByDiner(dinerId: string): Promise<Voucher[]> {
    return await db.select().from(vouchers)
      .where(eq(vouchers.dinerId, dinerId))
      .orderBy(desc(vouchers.generatedAt));
  }

  async getVouchersByRestaurant(restaurantId: string, branchId?: string | null): Promise<Voucher[]> {
    if (branchId) {
      return await db.select().from(vouchers)
        .where(and(
          eq(vouchers.restaurantId, restaurantId),
          eq(vouchers.branchId, branchId)
        ))
        .orderBy(desc(vouchers.generatedAt));
    }
    return await db.select().from(vouchers)
      .where(eq(vouchers.restaurantId, restaurantId))
      .orderBy(desc(vouchers.generatedAt));
  }

  async redeemVoucher(voucherId: string, billId?: string, branchId?: string): Promise<Voucher> {
    const result = await db.update(vouchers)
      .set({ 
        isRedeemed: true,
        redeemedAt: new Date(),
        billId: billId || null,
        branchId: branchId || null
      })
      .where(eq(vouchers.id, voucherId))
      .returning();
    return result[0];
  }

  async getVoucherByBillId(restaurantId: string, billId: string): Promise<Voucher | undefined> {
    const result = await db.select().from(vouchers)
      .where(and(
        eq(vouchers.restaurantId, restaurantId),
        eq(vouchers.billId, billId)
      ));
    return result[0];
  }

  // Voucher Type Methods
  async createVoucherType(voucherType: InsertVoucherType): Promise<VoucherType> {
    const result = await db.insert(voucherTypes).values(voucherType).returning();
    return result[0];
  }

  async getVoucherTypesByRestaurant(restaurantId: string): Promise<VoucherType[]> {
    return await db.select().from(voucherTypes)
      .where(eq(voucherTypes.restaurantId, restaurantId))
      .orderBy(desc(voucherTypes.createdAt));
  }

  async getActiveVoucherTypesByRestaurant(restaurantId: string): Promise<VoucherType[]> {
    return await db.select().from(voucherTypes)
      .where(and(
        eq(voucherTypes.restaurantId, restaurantId),
        eq(voucherTypes.isActive, true)
      ))
      .orderBy(desc(voucherTypes.createdAt));
  }

  async getVoucherType(id: string): Promise<VoucherType | undefined> {
    const result = await db.select().from(voucherTypes).where(eq(voucherTypes.id, id));
    return result[0];
  }

  async updateVoucherType(id: string, updates: Partial<InsertVoucherType>): Promise<VoucherType> {
    const result = await db.update(voucherTypes)
      .set(updates)
      .where(eq(voucherTypes.id, id))
      .returning();
    return result[0];
  }

  async deleteVoucherType(id: string): Promise<void> {
    await db.delete(voucherTypes).where(eq(voucherTypes.id, id));
  }

  // Registration Voucher Status Methods
  async getRegistrationVoucherStatus(dinerId: string, restaurantId: string): Promise<RegistrationVoucherStatus | undefined> {
    const result = await db.select().from(registrationVoucherStatus)
      .where(and(
        eq(registrationVoucherStatus.dinerId, dinerId),
        eq(registrationVoucherStatus.restaurantId, restaurantId)
      ));
    return result[0];
  }

  async createRegistrationVoucherStatus(status: InsertRegistrationVoucherStatus): Promise<RegistrationVoucherStatus> {
    // Check if already exists first (enforced by unique constraint on diner_id, restaurant_id)
    const existing = await this.getRegistrationVoucherStatus(status.dinerId, status.restaurantId);
    if (existing) {
      throw new Error("Registration voucher already issued for this diner at this restaurant");
    }
    const result = await db.insert(registrationVoucherStatus).values(status).returning();
    return result[0];
  }

  async markRegistrationVoucherRedeemed(dinerId: string, restaurantId: string): Promise<void> {
    await db.update(registrationVoucherStatus)
      .set({ redeemedAt: new Date() })
      .where(and(
        eq(registrationVoucherStatus.dinerId, dinerId),
        eq(registrationVoucherStatus.restaurantId, restaurantId)
      ));
  }

  async getRegistrationVoucherType(restaurantId: string): Promise<VoucherType | undefined> {
    const result = await db.select().from(voucherTypes)
      .where(and(
        eq(voucherTypes.restaurantId, restaurantId),
        eq(voucherTypes.category, "registration"),
        eq(voucherTypes.isActive, true)
      ));
    return result[0];
  }

  // Campaign Methods
  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const result = await db.insert(campaigns).values(campaign).returning();
    return result[0];
  }

  async getCampaignsByRestaurant(restaurantId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.restaurantId, restaurantId))
      .orderBy(desc(campaigns.createdAt));
  }

  async updateRestaurantSettings(
    id: string, 
    settings: { 
      voucherValue?: string; 
      voucherValidityDays?: number; 
      pointsPerCurrency?: number; 
      pointsThreshold?: number;
      voucherEarningMode?: string; // 'points' | 'visits'
      visitThreshold?: number;
      loyaltyScope?: string; // 'organization' | 'branch'
      voucherScope?: string; // 'organization' | 'branch'
    }
  ): Promise<Restaurant> {
    const result = await db.update(restaurants)
      .set(settings)
      .where(eq(restaurants.id, id))
      .returning();
    return result[0];
  }

  async updateRestaurantOnboarding(
    id: string,
    data: {
      registrationNumber?: string;
      streetAddress?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      hasAdditionalBranches?: boolean;
      logoUrl?: string;
      onboardingStatus?: string;
      onboardingCompletedAt?: Date | null;
    }
  ): Promise<Restaurant> {
    const result = await db.update(restaurants)
      .set(data)
      .where(eq(restaurants.id, id))
      .returning();
    return result[0];
  }

  async updateRestaurantProfile(
    id: string,
    data: {
      name?: string;
      tradingName?: string;
      description?: string;
      cuisineType?: string;
      websiteUrl?: string;
      vatNumber?: string;
      registrationNumber?: string;
      streetAddress?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      twitterUrl?: string;
      businessHours?: string;
      logoUrl?: string;
    }
  ): Promise<Restaurant> {
    const result = await db.update(restaurants)
      .set(data)
      .where(eq(restaurants.id, id))
      .returning();
    return result[0];
  }

  async getVoucherByCode(code: string): Promise<Voucher | undefined> {
    const result = await db.select().from(vouchers).where(eq(vouchers.code, code));
    return result[0];
  }

  async getVoucherById(id: string): Promise<Voucher | undefined> {
    const result = await db.select().from(vouchers).where(eq(vouchers.id, id));
    return result[0];
  }

  async updateUserActiveVoucherCode(userId: string, code: string | null): Promise<User> {
    const result = await db.update(users)
      .set({ 
        activeVoucherCode: code,
        activeVoucherCodeSetAt: code ? new Date() : null
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserActiveVoucherPresentation(userId: string, voucherId: string | null, code: string | null): Promise<User> {
    const result = await db.update(users)
      .set({ 
        activeVoucherCode: code,
        activeVoucherId: voucherId,
        activeVoucherCodeSetAt: code ? new Date() : null
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getUserWithActiveVoucher(code: string): Promise<{ user: User; voucher: Voucher } | undefined> {
    const user = await this.getUserByActiveVoucherCode(code);
    if (!user || !user.activeVoucherId) return undefined;
    
    const voucher = await this.getVoucherById(user.activeVoucherId);
    if (!voucher) return undefined;
    
    return { user, voucher };
  }

  async getUserByActiveVoucherCode(code: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.activeVoucherCode, code));
    return result[0];
  }

  async updateUserProfile(userId: string, profile: { name?: string; lastName?: string; email?: string; phone?: string }): Promise<User> {
    const result = await db.update(users)
      .set(profile)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  // Reconciliation Methods
  async createReconciliationBatch(batch: InsertReconciliationBatch): Promise<ReconciliationBatch> {
    const result = await db.insert(reconciliationBatches).values(batch).returning();
    return result[0];
  }

  async getReconciliationBatchesByRestaurant(restaurantId: string): Promise<ReconciliationBatch[]> {
    return await db.select().from(reconciliationBatches)
      .where(eq(reconciliationBatches.restaurantId, restaurantId))
      .orderBy(desc(reconciliationBatches.uploadedAt));
  }

  async getReconciliationBatch(batchId: string): Promise<ReconciliationBatch | undefined> {
    const result = await db.select().from(reconciliationBatches)
      .where(eq(reconciliationBatches.id, batchId));
    return result[0];
  }

  async updateReconciliationBatch(batchId: string, updates: Partial<ReconciliationBatch>): Promise<ReconciliationBatch> {
    const result = await db.update(reconciliationBatches)
      .set(updates)
      .where(eq(reconciliationBatches.id, batchId))
      .returning();
    return result[0];
  }

  async createReconciliationRecord(record: InsertReconciliationRecord): Promise<ReconciliationRecord> {
    const result = await db.insert(reconciliationRecords).values(record).returning();
    return result[0];
  }

  async getReconciliationRecordsByBatch(batchId: string): Promise<ReconciliationRecord[]> {
    return await db.select().from(reconciliationRecords)
      .where(eq(reconciliationRecords.batchId, batchId))
      .orderBy(desc(reconciliationRecords.createdAt));
  }

  async updateReconciliationRecord(recordId: string, updates: Partial<ReconciliationRecord>): Promise<ReconciliationRecord> {
    const result = await db.update(reconciliationRecords)
      .set(updates)
      .where(eq(reconciliationRecords.id, recordId))
      .returning();
    return result[0];
  }

  // Diner Invitation Methods
  async createDinerInvitation(invitation: InsertDinerInvitation): Promise<DinerInvitation> {
    const result = await db.insert(dinerInvitations).values(invitation).returning();
    return result[0];
  }

  async getDinerInvitationByToken(token: string): Promise<DinerInvitation | undefined> {
    const result = await db.select().from(dinerInvitations).where(eq(dinerInvitations.token, token));
    return result[0];
  }

  async updateDinerInvitation(id: string, updates: Partial<DinerInvitation>): Promise<DinerInvitation> {
    const result = await db.update(dinerInvitations)
      .set(updates)
      .where(eq(dinerInvitations.id, id))
      .returning();
    return result[0];
  }

  async getDinerInvitationsByRestaurant(restaurantId: string): Promise<DinerInvitation[]> {
    return await db.select().from(dinerInvitations)
      .where(eq(dinerInvitations.restaurantId, restaurantId))
      .orderBy(desc(dinerInvitations.createdAt));
  }

  async countAllDiners(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.userType, 'diner'));
    return result[0]?.count || 0;
  }

  async getRegisteredDinersByRestaurant(restaurantId: string): Promise<{
    id: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    currentPoints: number;
    totalVouchersGenerated: number;
    availableVoucherCredits: number;
    lastTransactionDate: Date | null;
    createdAt: Date;
  }[]> {
    const results = await db.select({
      id: users.id,
      name: users.name,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      currentPoints: pointsBalances.currentPoints,
      totalVouchersGenerated: pointsBalances.totalVouchersGenerated,
      availableVoucherCredits: pointsBalances.availableVoucherCredits,
      createdAt: users.createdAt,
    })
      .from(pointsBalances)
      .innerJoin(users, eq(pointsBalances.dinerId, users.id))
      .where(eq(pointsBalances.restaurantId, restaurantId))
      .orderBy(desc(users.createdAt));
    
    const dinerIds = results.map(r => r.id);
    
    const lastTransactions = dinerIds.length > 0 
      ? await db.select({
          dinerId: transactions.dinerId,
          lastDate: sql<Date>`max(${transactions.transactionDate})`.as('last_date'),
        })
        .from(transactions)
        .where(and(
          eq(transactions.restaurantId, restaurantId),
          inArray(transactions.dinerId, dinerIds)
        ))
        .groupBy(transactions.dinerId)
      : [];
    
    const lastTxMap = new Map(lastTransactions.map(t => [t.dinerId, t.lastDate]));
    
    return results.map(r => ({
      ...r,
      lastTransactionDate: lastTxMap.get(r.id) || null,
    }));
  }

  async getPortalUsersByRestaurant(restaurantId: string): Promise<(PortalUser & { user: User; branchIds: string[]; branchNames: string[] })[]> {
    const results = await db.select()
      .from(portalUsers)
      .innerJoin(users, eq(portalUsers.userId, users.id))
      .where(eq(portalUsers.restaurantId, restaurantId))
      .orderBy(desc(portalUsers.createdAt));
    
    const allBranches = await this.getBranchesByRestaurant(restaurantId);
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));
    
    const enrichedResults = await Promise.all(results.map(async r => {
      const branchIds = await this.getPortalUserBranches(r.portal_users.id);
      const branchNames = branchIds.map(id => branchMap.get(id) || 'Unknown').filter(Boolean);
      return {
        ...r.portal_users,
        user: r.users,
        branchIds,
        branchNames
      };
    }));
    
    return enrichedResults;
  }

  async addPortalUser(portalUser: InsertPortalUser): Promise<PortalUser> {
    const result = await db.insert(portalUsers).values(portalUser).returning();
    return result[0];
  }

  async removePortalUser(id: string): Promise<void> {
    await db.delete(portalUsers).where(eq(portalUsers.id, id));
  }

  async getPortalUserByUserAndRestaurant(userId: string, restaurantId: string): Promise<PortalUser | undefined> {
    const result = await db.select().from(portalUsers)
      .where(and(eq(portalUsers.userId, userId), eq(portalUsers.restaurantId, restaurantId)));
    return result[0];
  }

  async updatePortalUser(id: string, updates: { hasAllBranchAccess?: boolean; role?: string }): Promise<PortalUser> {
    const result = await db.update(portalUsers)
      .set(updates)
      .where(eq(portalUsers.id, id))
      .returning();
    return result[0];
  }

  async getPortalUserBranches(portalUserId: string): Promise<string[]> {
    const results = await db.select({ branchId: portalUserBranches.branchId })
      .from(portalUserBranches)
      .where(eq(portalUserBranches.portalUserId, portalUserId));
    return results.map(r => r.branchId);
  }

  async setPortalUserBranches(portalUserId: string, branchIds: string[]): Promise<void> {
    await db.delete(portalUserBranches).where(eq(portalUserBranches.portalUserId, portalUserId));
    if (branchIds.length > 0) {
      await db.insert(portalUserBranches).values(
        branchIds.map(branchId => ({ portalUserId, branchId }))
      );
    }
  }

  async getAccessibleBranchIds(userId: string, restaurantId: string): Promise<{ branchIds: string[]; hasAllAccess: boolean }> {
    const restaurant = await this.getRestaurant(restaurantId);
    if (!restaurant) {
      return { branchIds: [], hasAllAccess: false };
    }
    
    if (restaurant.adminUserId === userId) {
      const allBranches = await this.getBranchesByRestaurant(restaurantId);
      return { branchIds: allBranches.map(b => b.id), hasAllAccess: true };
    }
    
    const portalUser = await this.getPortalUserByUserAndRestaurant(userId, restaurantId);
    if (!portalUser) {
      return { branchIds: [], hasAllAccess: false };
    }
    
    if (portalUser.hasAllBranchAccess) {
      const allBranches = await this.getBranchesByRestaurant(restaurantId);
      return { branchIds: allBranches.map(b => b.id), hasAllAccess: true };
    }
    
    const assignedBranchIds = await this.getPortalUserBranches(portalUser.id);
    return { branchIds: assignedBranchIds, hasAllAccess: false };
  }

  async updatePortalUserBranchAccess(portalUserId: string, hasAllBranchAccess: boolean, branchIds: string[]): Promise<void> {
    await db.update(portalUsers)
      .set({ hasAllBranchAccess })
      .where(eq(portalUsers.id, portalUserId));
    
    await this.setPortalUserBranches(portalUserId, hasAllBranchAccess ? [] : branchIds);
  }

  // Activity Log Methods
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(log).returning();
    return result[0];
  }

  async getActivityLogsByRestaurant(restaurantId: string, limit = 100): Promise<(ActivityLog & { user?: User })[]> {
    const results = await db.select()
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(eq(activityLogs.restaurantId, restaurantId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    
    return results.map(r => ({
      ...r.activity_logs,
      user: r.users || undefined
    }));
  }

  // Diner Registration Stats
  async getDinerRegistrationsByDateRange(restaurantId: string, startDate: Date, endDate: Date, branchId?: string | null): Promise<{ date: string; count: number }[]> {
    // Use SQL to get day-by-day counts of diner registrations (via invitations consumed)
    // Note: Registrations are at restaurant level, not branch level, so branchId is not used here
    const result = await db.execute(sql`
      WITH date_series AS (
        SELECT generate_series(
          ${startDate.toISOString()}::date,
          ${endDate.toISOString()}::date,
          '1 day'::interval
        )::date AS date
      )
      SELECT 
        ds.date::text as date,
        COALESCE(COUNT(di.id), 0)::int as count
      FROM date_series ds
      LEFT JOIN diner_invitations di ON 
        di.restaurant_id = ${restaurantId} AND
        di.consumed_at::date = ds.date AND
        di.status = 'registered'
      GROUP BY ds.date
      ORDER BY ds.date ASC
    `);
    
    return (result.rows as { date: string; count: number }[]);
  }

  async getVoucherRedemptionsByType(restaurantId: string, startDate?: Date, endDate?: Date, branchId?: string | null): Promise<{ voucherTypeName: string; count: number }[]> {
    let query;
    const branchCondition = branchId ? sql` AND v.branch_id = ${branchId}` : sql``;
    
    if (startDate && endDate) {
      query = sql`
        SELECT 
          COALESCE(vt.name, 'Unknown Type') as voucher_type_name,
          COUNT(v.id)::int as count
        FROM vouchers v
        LEFT JOIN voucher_types vt ON v.voucher_type_id = vt.id
        WHERE v.restaurant_id = ${restaurantId}
          AND v.is_redeemed = true
          AND v.redeemed_at >= ${startDate.toISOString()}::timestamp
          AND v.redeemed_at <= ${endDate.toISOString()}::timestamp
          ${branchCondition}
        GROUP BY vt.name
        ORDER BY count DESC
      `;
    } else {
      query = sql`
        SELECT 
          COALESCE(vt.name, 'Unknown Type') as voucher_type_name,
          COUNT(v.id)::int as count
        FROM vouchers v
        LEFT JOIN voucher_types vt ON v.voucher_type_id = vt.id
        WHERE v.restaurant_id = ${restaurantId}
          AND v.is_redeemed = true
          ${branchCondition}
        GROUP BY vt.name
        ORDER BY count DESC
      `;
    }
    const result = await db.execute(query);
    
    return (result.rows as { voucher_type_name: string; count: number }[]).map(row => ({
      voucherTypeName: row.voucher_type_name,
      count: row.count
    }));
  }

  async getRevenueByDateRange(restaurantId: string, startDate: Date, endDate: Date, branchId?: string | null): Promise<{ date: string; amount: number }[]> {
    const branchCondition = branchId ? sql` AND t.branch_id = ${branchId}` : sql``;
    
    const result = await db.execute(sql`
      WITH date_series AS (
        SELECT generate_series(
          ${startDate.toISOString()}::date,
          ${endDate.toISOString()}::date,
          '1 day'::interval
        )::date AS date
      )
      SELECT 
        ds.date::text as date,
        COALESCE(SUM(CASE WHEN t.restaurant_id = ${restaurantId} ${branchCondition} THEN t.amount_spent::numeric ELSE 0 END), 0)::float as amount
      FROM date_series ds
      LEFT JOIN transactions t ON t.transaction_date::date = ds.date
      GROUP BY ds.date
      ORDER BY ds.date ASC
    `);
    
    return (result.rows as { date: string; amount: number }[]);
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.execute(sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${userId}, ${token}, ${expiresAt.toISOString()}::timestamp)
    `);
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    const result = await db.execute(sql`
      SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ${token}
    `);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0] as { user_id: string; expires_at: Date; used_at: Date | null };
    return {
      userId: row.user_id,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
    };
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.execute(sql`
      UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ${token}
    `);
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  // Account Deletion Methods
  async createAccountDeletionRequest(userId: string, token: string, expiresAt: Date): Promise<AccountDeletionRequest> {
    const result = await db.insert(accountDeletionRequests).values({
      userId,
      token,
      expiresAt,
    }).returning();
    return result[0];
  }

  async getAccountDeletionRequestByToken(token: string): Promise<AccountDeletionRequest | undefined> {
    const result = await db.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.token, token));
    return result[0];
  }

  async confirmAccountDeletionRequest(token: string): Promise<void> {
    await db.update(accountDeletionRequests)
      .set({ confirmedAt: new Date() })
      .where(eq(accountDeletionRequests.token, token));
  }

  async archiveUser(user: User, reason?: string): Promise<ArchivedUser> {
    const retentionDays = 90; // 90-day retention policy
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setDate(retentionExpiresAt.getDate() + retentionDays);

    const result = await db.insert(archivedUsers).values({
      originalUserId: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      phone: user.phone,
      userType: user.userType,
      originalCreatedAt: user.createdAt,
      deletionReason: reason,
      retentionExpiresAt,
    }).returning();
    return result[0];
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete related data first (in order of dependencies)
    await db.delete(accountDeletionRequests).where(eq(accountDeletionRequests.userId, userId));
    await db.delete(phoneChangeRequests).where(eq(phoneChangeRequests.userId, userId));
    await db.delete(vouchers).where(eq(vouchers.dinerId, userId));
    await db.delete(transactions).where(eq(transactions.dinerId, userId));
    await db.delete(pointsBalances).where(eq(pointsBalances.dinerId, userId));
    await db.delete(portalUsers).where(eq(portalUsers.userId, userId));
    // Finally delete the user
    await db.delete(users).where(eq(users.id, userId));
  }

  // Phone Change Request Methods
  async createPhoneChangeRequest(request: { userId: string; newPhone: string; otpHash: string; expiresAt: Date }): Promise<PhoneChangeRequest> {
    // Expire any existing pending requests first
    await db.update(phoneChangeRequests)
      .set({ status: 'expired' })
      .where(and(
        eq(phoneChangeRequests.userId, request.userId),
        eq(phoneChangeRequests.status, 'pending')
      ));
    
    const result = await db.insert(phoneChangeRequests).values({
      userId: request.userId,
      newPhone: request.newPhone,
      otpHash: request.otpHash,
      expiresAt: request.expiresAt,
      attempts: 0,
      status: 'pending',
    }).returning();
    return result[0];
  }

  async getActivePhoneChangeRequest(userId: string): Promise<PhoneChangeRequest | undefined> {
    const result = await db.select().from(phoneChangeRequests)
      .where(and(
        eq(phoneChangeRequests.userId, userId),
        eq(phoneChangeRequests.status, 'pending')
      ))
      .orderBy(desc(phoneChangeRequests.createdAt))
      .limit(1);
    return result[0];
  }

  async incrementPhoneChangeAttempts(id: string): Promise<PhoneChangeRequest> {
    const result = await db.update(phoneChangeRequests)
      .set({ attempts: sql`attempts + 1` })
      .where(eq(phoneChangeRequests.id, id))
      .returning();
    return result[0];
  }

  async markPhoneChangeVerified(id: string): Promise<void> {
    await db.update(phoneChangeRequests)
      .set({ status: 'verified' })
      .where(eq(phoneChangeRequests.id, id));
  }

  async expirePhoneChangeRequest(id: string): Promise<void> {
    await db.update(phoneChangeRequests)
      .set({ status: 'expired' })
      .where(eq(phoneChangeRequests.id, id));
  }

  async updateUserPhone(userId: string, phone: string): Promise<User> {
    const result = await db.update(users)
      .set({ phone })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
