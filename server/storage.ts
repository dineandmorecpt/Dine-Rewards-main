import { 
  type User, 
  type InsertUser,
  type Restaurant,
  type InsertRestaurant,
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
  users,
  restaurants,
  pointsBalances,
  transactions,
  vouchers,
  voucherTypes,
  campaigns,
  reconciliationBatches,
  reconciliationRecords,
  dinerInvitations,
  portalUsers,
  activityLogs
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc, sql, gte } from "drizzle-orm";

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
  
  // Points Management
  getPointsBalance(dinerId: string, restaurantId: string): Promise<PointsBalance | undefined>;
  createPointsBalance(balance: InsertPointsBalance): Promise<PointsBalance>;
  updatePointsBalance(id: string, updates: { 
    currentPoints?: number; 
    totalPointsEarned?: number; 
    totalVouchersGenerated?: number;
    availableVoucherCredits?: number;
    totalVoucherCreditsEarned?: number;
  }): Promise<PointsBalance>;
  getPointsBalancesByDiner(dinerId: string): Promise<PointsBalance[]>;
  
  // Transaction Management
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByDiner(dinerId: string): Promise<Transaction[]>;
  getTransactionsByDinerAndRestaurant(dinerId: string, restaurantId: string): Promise<Transaction[]>;
  getTransactionsByRestaurant(restaurantId: string, last30Days?: boolean): Promise<Transaction[]>;
  
  // Voucher Management
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  getVouchersByDiner(dinerId: string): Promise<Voucher[]>;
  getVouchersByRestaurant(restaurantId: string): Promise<Voucher[]>;
  redeemVoucher(voucherId: string, billId?: string): Promise<Voucher>;
  getVoucherByBillId(restaurantId: string, billId: string): Promise<Voucher | undefined>;
  
  // Voucher Type Management
  createVoucherType(voucherType: InsertVoucherType): Promise<VoucherType>;
  getVoucherTypesByRestaurant(restaurantId: string): Promise<VoucherType[]>;
  getActiveVoucherTypesByRestaurant(restaurantId: string): Promise<VoucherType[]>;
  getVoucherType(id: string): Promise<VoucherType | undefined>;
  updateVoucherType(id: string, updates: Partial<InsertVoucherType>): Promise<VoucherType>;
  deleteVoucherType(id: string): Promise<void>;
  
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
      pointsThreshold?: number 
    }
  ): Promise<Restaurant>;
  
  // Voucher Code Management
  getVoucherByCode(code: string): Promise<Voucher | undefined>;
  getVoucherById(id: string): Promise<Voucher | undefined>;
  updateUserActiveVoucherCode(userId: string, code: string | null): Promise<User>;
  getUserByActiveVoucherCode(code: string): Promise<User | undefined>;
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
  
  // Portal User Management
  getPortalUsersByRestaurant(restaurantId: string): Promise<(PortalUser & { user: User })[]>;
  addPortalUser(portalUser: InsertPortalUser): Promise<PortalUser>;
  removePortalUser(id: string): Promise<void>;
  getPortalUserByUserAndRestaurant(userId: string, restaurantId: string): Promise<PortalUser | undefined>;
  
  // Activity Log Management
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByRestaurant(restaurantId: string, limit?: number): Promise<(ActivityLog & { user?: User })[]>;
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
    const result = await db.insert(users).values(insertUser).returning();
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

  // Points Balance Methods
  async getPointsBalance(dinerId: string, restaurantId: string): Promise<PointsBalance | undefined> {
    const result = await db.select().from(pointsBalances)
      .where(and(
        eq(pointsBalances.dinerId, dinerId),
        eq(pointsBalances.restaurantId, restaurantId)
      ));
    return result[0];
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
      totalVouchersGenerated?: number;
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

  async getTransactionsByRestaurant(restaurantId: string, last30Days = false): Promise<Transaction[]> {
    if (last30Days) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return await db.select().from(transactions)
        .where(and(
          eq(transactions.restaurantId, restaurantId),
          gte(transactions.transactionDate, thirtyDaysAgo)
        ))
        .orderBy(desc(transactions.transactionDate));
    }
    
    return await db.select().from(transactions)
      .where(eq(transactions.restaurantId, restaurantId))
      .orderBy(desc(transactions.transactionDate));
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

  async getVouchersByRestaurant(restaurantId: string): Promise<Voucher[]> {
    return await db.select().from(vouchers)
      .where(eq(vouchers.restaurantId, restaurantId))
      .orderBy(desc(vouchers.generatedAt));
  }

  async redeemVoucher(voucherId: string, billId?: string): Promise<Voucher> {
    const result = await db.update(vouchers)
      .set({ 
        isRedeemed: true,
        redeemedAt: new Date(),
        billId: billId || null
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
      pointsThreshold?: number 
    }
  ): Promise<Restaurant> {
    const result = await db.update(restaurants)
      .set(settings)
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

  async getPortalUsersByRestaurant(restaurantId: string): Promise<(PortalUser & { user: User })[]> {
    const results = await db.select()
      .from(portalUsers)
      .innerJoin(users, eq(portalUsers.userId, users.id))
      .where(eq(portalUsers.restaurantId, restaurantId))
      .orderBy(desc(portalUsers.createdAt));
    
    return results.map(r => ({
      ...r.portal_users,
      user: r.users
    }));
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
}

export const storage = new DbStorage();
