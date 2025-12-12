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
  type Campaign,
  type InsertCampaign,
  users,
  restaurants,
  pointsBalances,
  transactions,
  vouchers,
  campaigns
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
  createUser(user: InsertUser): Promise<User>;
  
  // Restaurant Management
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  getRestaurantsByAdmin(adminUserId: string): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  getAllRestaurants(): Promise<Restaurant[]>;
  
  // Points Management
  getPointsBalance(dinerId: string, restaurantId: string): Promise<PointsBalance | undefined>;
  createPointsBalance(balance: InsertPointsBalance): Promise<PointsBalance>;
  updatePointsBalance(id: string, currentPoints: number, totalPointsEarned: number, totalVouchersGenerated: number): Promise<PointsBalance>;
  getPointsBalancesByDiner(dinerId: string): Promise<PointsBalance[]>;
  
  // Transaction Management
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByDiner(dinerId: string): Promise<Transaction[]>;
  getTransactionsByRestaurant(restaurantId: string, last30Days?: boolean): Promise<Transaction[]>;
  
  // Voucher Management
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  getVouchersByDiner(dinerId: string): Promise<Voucher[]>;
  getVouchersByRestaurant(restaurantId: string): Promise<Voucher[]>;
  redeemVoucher(voucherId: string): Promise<Voucher>;
  
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
    currentPoints: number, 
    totalPointsEarned: number, 
    totalVouchersGenerated: number
  ): Promise<PointsBalance> {
    const result = await db.update(pointsBalances)
      .set({ 
        currentPoints, 
        totalPointsEarned, 
        totalVouchersGenerated,
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

  async redeemVoucher(voucherId: string): Promise<Voucher> {
    const result = await db.update(vouchers)
      .set({ 
        isRedeemed: true,
        redeemedAt: new Date()
      })
      .where(eq(vouchers.id, voucherId))
      .returning();
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
      pointsThreshold?: number 
    }
  ): Promise<Restaurant> {
    const result = await db.update(restaurants)
      .set(settings)
      .where(eq(restaurants.id, id))
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
