import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Types: 'diner' or 'restaurant_admin'
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone").unique(), // Phone number for diner identification
  userType: text("user_type").notNull(), // 'diner' | 'restaurant_admin'
  activeVoucherCode: text("active_voucher_code"), // Currently selected voucher code for redemption
  activeVoucherCodeSetAt: timestamp("active_voucher_code_set_at"), // When the code was presented (valid for 15 mins)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Restaurants managed by restaurant admins
export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  voucherValue: text("voucher_value").notNull(), // e.g., "R100 Loyalty Voucher"
  voucherValidityDays: integer("voucher_validity_days").notNull().default(30),
  color: text("color").notNull().default("bg-primary"),
  // Configurable points calculation rules per restaurant
  pointsPerCurrency: integer("points_per_currency").notNull().default(1), // Points earned per R1 spent
  pointsThreshold: integer("points_threshold").notNull().default(1000), // Points needed to generate a voucher
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
});
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

// Points balance per diner per restaurant
// Rule: Points do not fall away, but reset to 0 after 1000 points generate a voucher
export const pointsBalances = pgTable("points_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dinerId: varchar("diner_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  currentPoints: integer("current_points").notNull().default(0),
  totalPointsEarned: integer("total_points_earned").notNull().default(0),
  totalVouchersGenerated: integer("total_vouchers_generated").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPointsBalanceSchema = createInsertSchema(pointsBalances).omit({
  id: true,
  updatedAt: true,
});
export type InsertPointsBalance = z.infer<typeof insertPointsBalanceSchema>;
export type PointsBalance = typeof pointsBalances.$inferSelect;

// Transaction log: Every R1 spent = 1 point
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dinerId: varchar("diner_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  billId: text("bill_id"), // Bill/Invoice ID from POS
  amountSpent: decimal("amount_spent", { precision: 10, scale: 2 }).notNull(),
  pointsEarned: integer("points_earned").notNull(),
  transactionDate: timestamp("transaction_date").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  transactionDate: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Vouchers generated and their redemption status
export const vouchers = pgTable("vouchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dinerId: varchar("diner_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  title: text("title").notNull(),
  code: text("code").notNull().unique(),
  expiryDate: timestamp("expiry_date").notNull(),
  isRedeemed: boolean("is_redeemed").notNull().default(false),
  redeemedAt: timestamp("redeemed_at"),
  billId: text("bill_id"), // Bill ID from POS system for reconciliation
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const insertVoucherSchema = createInsertSchema(vouchers).omit({
  id: true,
  generatedAt: true,
});
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchers.$inferSelect;

// Campaign for pushing vouchers to diners
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(),
  voucherTitle: text("voucher_title").notNull(),
  targetAudience: text("target_audience").notNull(), // 'all' | 'vip' | 'new' | 'lapsed'
  message: text("message").notNull(),
  status: text("status").notNull().default("scheduled"), // 'scheduled' | 'active' | 'completed'
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Reconciliation batch - represents a single CSV upload
export const reconciliationBatches = pgTable("reconciliation_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  fileName: text("file_name").notNull(),
  totalRecords: integer("total_records").notNull().default(0),
  matchedRecords: integer("matched_records").notNull().default(0),
  unmatchedRecords: integer("unmatched_records").notNull().default(0),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertReconciliationBatchSchema = createInsertSchema(reconciliationBatches).omit({
  id: true,
  uploadedAt: true,
});
export type InsertReconciliationBatch = z.infer<typeof insertReconciliationBatchSchema>;
export type ReconciliationBatch = typeof reconciliationBatches.$inferSelect;

// Reconciliation records - individual rows from CSV with match status
export const reconciliationRecords = pgTable("reconciliation_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => reconciliationBatches.id),
  billId: text("bill_id").notNull(),
  csvAmount: text("csv_amount"), // Amount from CSV (optional)
  csvDate: text("csv_date"), // Date from CSV (optional)
  isMatched: boolean("is_matched").notNull().default(false),
  matchedVoucherId: varchar("matched_voucher_id").references(() => vouchers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReconciliationRecordSchema = createInsertSchema(reconciliationRecords).omit({
  id: true,
  createdAt: true,
});
export type InsertReconciliationRecord = z.infer<typeof insertReconciliationRecordSchema>;
export type ReconciliationRecord = typeof reconciliationRecords.$inferSelect;
