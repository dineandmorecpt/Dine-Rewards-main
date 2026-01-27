import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Types: 'diner' or 'restaurant_admin'
// A person can be both a diner AND a restaurant staff member with the same email/phone,
// but cannot have duplicate records within the same user type.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analyticsId: text("analytics_id").unique(), // Anonymous ID for analytics (no PII exposure)
  email: text("email").notNull(), // Unique per userType (composite constraint below)
  password: text("password").notNull(),
  name: text("name").notNull(),
  lastName: text("last_name"), // Surname for diners
  phone: text("phone"), // Unique per userType (composite constraint below)
  userType: text("user_type").notNull(), // 'diner' | 'restaurant_admin'
  gender: text("gender"), // 'male' | 'female' | 'other' | 'prefer_not_to_say'
  ageRange: text("age_range"), // '18-29' | '30-39' | '40-49' | '50-59' | '60+'
  province: text("province"), // South African province
  accessToken: text("access_token").unique(), // Persistent token for auto-login (valid for 90 days)
  accessTokenExpiresAt: timestamp("access_token_expires_at"), // When the access token expires
  activeVoucherCode: text("active_voucher_code"), // Temporary presentation code for redemption (generated on tap)
  activeVoucherId: text("active_voucher_id"), // ID of voucher being presented for redemption
  activeVoucherCodeSetAt: timestamp("active_voucher_code_set_at"), // When the code was presented (valid for 15 mins)
  termsAcceptedAt: timestamp("terms_accepted_at"), // When T&Cs were accepted
  privacyAcceptedAt: timestamp("privacy_accepted_at"), // When privacy policy was accepted
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_email_user_type_idx").on(table.email, table.userType),
  uniqueIndex("users_phone_user_type_idx").on(table.phone, table.userType),
]);

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
  // Voucher earning mode: 'points' = earn based on spend, 'visits' = earn based on visit count
  voucherEarningMode: text("voucher_earning_mode").notNull().default("points"), // 'points' | 'visits'
  visitThreshold: integer("visit_threshold").notNull().default(10), // Visits needed to generate a voucher (when mode='visits')
  // Loyalty scope: 'organization' = points work across all branches, 'branch' = branch-specific
  loyaltyScope: text("loyalty_scope").notNull().default("organization"), // 'organization' | 'branch'
  // Voucher scope: 'organization' = vouchers redeemable at all branches, 'branch' = branch-specific redemption
  voucherScope: text("voucher_scope").notNull().default("organization"), // 'organization' | 'branch'
  // Onboarding fields
  onboardingStatus: text("onboarding_status").notNull().default("draft"), // 'draft' | 'submitted' | 'active'
  registrationNumber: text("registration_number"),
  streetAddress: text("street_address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  country: text("country").default("South Africa"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  hasAdditionalBranches: boolean("has_additional_branches").default(false),
  logoUrl: text("logo_url"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  // Business profile fields
  tradingName: text("trading_name"), // Trading name if different from legal name
  description: text("description"), // About the business
  cuisineType: text("cuisine_type"), // Type of cuisine/food
  websiteUrl: text("website_url"),
  vatNumber: text("vat_number"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  businessHours: text("business_hours"), // JSON string with hours per day
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
});
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

// Restaurant branches - different locations under one organization
export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(), // e.g., "Sandton City", "V&A Waterfront"
  address: text("address"), // Physical address
  phone: text("phone"), // Branch contact number
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // Default branch for the restaurant
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
});
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;

// Points balance per diner per restaurant (or per branch when loyaltyScope='branch')
// Rule: Points do not fall away, but reset to 0 after reaching threshold and earning a voucher credit
// Credits are tracked separately for points-based and visits-based vouchers
export const pointsBalances = pgTable("points_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dinerId: varchar("diner_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  branchId: varchar("branch_id").references(() => branches.id), // null = org-wide, set when loyaltyScope='branch'
  currentPoints: integer("current_points").notNull().default(0),
  totalPointsEarned: integer("total_points_earned").notNull().default(0),
  currentVisits: integer("current_visits").notNull().default(0), // Visits since last voucher (resets on credit earn)
  totalVisits: integer("total_visits").notNull().default(0), // Total visits ever
  totalVouchersGenerated: integer("total_vouchers_generated").notNull().default(0),
  // Mode-specific credits
  pointsCredits: integer("points_credits").notNull().default(0), // Credits earned from points threshold
  visitCredits: integer("visit_credits").notNull().default(0), // Credits earned from visit threshold
  availableVoucherCredits: integer("available_voucher_credits").notNull().default(0), // Legacy/aggregate credits (deprecated)
  totalVoucherCreditsEarned: integer("total_voucher_credits_earned").notNull().default(0), // Total credits ever earned
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
  branchId: varchar("branch_id").references(() => branches.id), // Which branch the transaction occurred at
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

// Voucher types - templates created by restaurant owners that diners can choose from
// Voucher categories: 'rand_value' | 'percentage' | 'free_item' | 'registration'
// Registration vouchers: issued once per diner per restaurant on first visit, rand value off bill
// Each voucher type specifies whether it's earned through points or visits
export const voucherTypes = pgTable("voucher_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  branchId: varchar("branch_id").references(() => branches.id), // Branch-specific voucher type (null = org-wide)
  category: text("category").notNull().default("rand_value"), // 'rand_value' | 'percentage' | 'free_item' | 'registration'
  earningMode: text("earning_mode").notNull().default("points"), // 'points' | 'visits' - which credits to consume
  pointsPerCurrencyOverride: integer("points_per_currency_override"), // Override restaurant default (null = use restaurant setting)
  name: text("name").notNull(), // e.g., "R100 Off Your Bill"
  description: text("description"), // Optional details about the voucher
  rewardDetails: text("reward_details"), // Fine print, terms, etc.
  value: integer("value"), // Rand amount or percentage value (null for free_item)
  freeItemType: text("free_item_type"), // 'beverage' | 'starter' | 'main' | 'dessert' | 'side' | 'other' (only for free_item category)
  freeItemDescription: text("free_item_description"), // Specific item description for free_item category
  redemptionScope: text("redemption_scope").notNull().default("all_branches"), // 'all_branches' | 'specific_branches'
  redeemableBranchIds: text("redeemable_branch_ids").array(), // Array of branch IDs where voucher can be redeemed (only used when redemptionScope = 'specific_branches')
  creditsCost: integer("credits_cost").notNull().default(1), // How many credits to redeem this voucher
  validityDays: integer("validity_days").notNull().default(30), // Days until individual voucher expires after issue
  expiresAt: timestamp("expires_at"), // When this voucher type expires (minimum 6 months from creation, cannot be edited or deleted)
  isActive: boolean("is_active").notNull().default(true), // Can diners select this?
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoucherTypeSchema = createInsertSchema(voucherTypes).omit({
  id: true,
  createdAt: true,
});
export type InsertVoucherType = z.infer<typeof insertVoucherTypeSchema>;
export type VoucherType = typeof voucherTypes.$inferSelect;

// Vouchers generated and their redemption status
export const vouchers = pgTable("vouchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dinerId: varchar("diner_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  branchId: varchar("branch_id").references(() => branches.id), // Branch where voucher was redeemed
  voucherTypeId: varchar("voucher_type_id").references(() => voucherTypes.id), // Which type was selected
  title: text("title").notNull(),
  code: text("code"), // Deprecated - no longer used, codes are generated on-the-fly
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

// Registration voucher tracking - ensures one registration voucher per diner per restaurant
export const registrationVoucherStatus = pgTable("registration_voucher_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dinerId: varchar("diner_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  voucherId: varchar("voucher_id").references(() => vouchers.id), // The registration voucher issued
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  redeemedAt: timestamp("redeemed_at"), // When the voucher was used (first visit)
});

export const insertRegistrationVoucherStatusSchema = createInsertSchema(registrationVoucherStatus).omit({
  id: true,
  issuedAt: true,
});
export type InsertRegistrationVoucherStatus = z.infer<typeof insertRegistrationVoucherStatusSchema>;
export type RegistrationVoucherStatus = typeof registrationVoucherStatus.$inferSelect;

// Campaign for pushing vouchers to diners
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  branchId: varchar("branch_id").references(() => branches.id), // Branch-specific campaign (null = org-wide)
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
  branchId: varchar("branch_id").references(() => branches.id), // Branch this batch belongs to
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

// Diner invitations - tracks SMS registration links sent to potential diners
export const dinerInvitations = pgTable("diner_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  branchId: varchar("branch_id").references(() => branches.id), // Branch that sent the invitation
  phone: text("phone").notNull(), // Phone number the SMS was sent to
  token: text("token").notNull().unique(), // Unique token for registration link
  status: text("status").notNull().default("pending"), // 'pending' | 'registered' | 'expired'
  invitedBy: varchar("invited_by").references(() => users.id), // Admin who sent the invite
  dinerId: varchar("diner_id").references(() => users.id), // User created after registration
  expiresAt: timestamp("expires_at").notNull(), // Link expiration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumedAt: timestamp("consumed_at"), // When the user completed registration
});

export const insertDinerInvitationSchema = createInsertSchema(dinerInvitations).omit({
  id: true,
  createdAt: true,
});
export type InsertDinerInvitation = z.infer<typeof insertDinerInvitationSchema>;
export type DinerInvitation = typeof dinerInvitations.$inferSelect;

// Portal users - additional users who can access a restaurant's admin portal
export const portalUsers = pgTable("portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("staff"), // 'owner' | 'manager' | 'staff'
  hasAllBranchAccess: boolean("has_all_branch_access").notNull().default(false), // Owners typically have all access
  addedBy: varchar("added_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortalUserSchema = createInsertSchema(portalUsers).omit({
  id: true,
  createdAt: true,
});
export type InsertPortalUser = z.infer<typeof insertPortalUserSchema>;
export type PortalUser = typeof portalUsers.$inferSelect;

// Portal user branch assignments - which branches a portal user can access
export const portalUserBranches = pgTable("portal_user_branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalUserId: varchar("portal_user_id").notNull().references(() => portalUsers.id, { onDelete: 'cascade' }),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortalUserBranchSchema = createInsertSchema(portalUserBranches).omit({
  id: true,
  createdAt: true,
});
export type InsertPortalUserBranch = z.infer<typeof insertPortalUserBranchSchema>;
export type PortalUserBranch = typeof portalUserBranches.$inferSelect;

// Activity logs - audit trail for important actions
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  branchId: varchar("branch_id").references(() => branches.id), // Branch where action occurred (null = org-level)
  userId: varchar("user_id").references(() => users.id), // Who performed the action (null for system actions)
  action: text("action").notNull(), // Action type: 'voucher_created', 'voucher_redeemed', 'settings_updated', etc.
  details: text("details"), // JSON string with additional context
  targetType: text("target_type"), // Entity type affected: 'voucher', 'transaction', 'settings', 'user'
  targetId: text("target_id"), // ID of the affected entity
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Password reset tokens for forgot password functionality
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Account deletion requests - two-step confirmation via email
export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(), // Link valid for 24 hours
  confirmedAt: timestamp("confirmed_at"), // When user clicked email link
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountDeletionRequestSchema = createInsertSchema(accountDeletionRequests).omit({
  id: true,
  createdAt: true,
});
export type InsertAccountDeletionRequest = z.infer<typeof insertAccountDeletionRequestSchema>;
export type AccountDeletionRequest = typeof accountDeletionRequests.$inferSelect;

// Archived users - data retention before permanent deletion
export const archivedUsers = pgTable("archived_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalUserId: text("original_user_id").notNull(), // Original user ID for reference
  email: text("email").notNull(),
  name: text("name").notNull(),
  lastName: text("last_name"),
  phone: text("phone"),
  userType: text("user_type").notNull(),
  originalCreatedAt: timestamp("original_created_at").notNull(), // When user originally signed up
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
  deletionReason: text("deletion_reason"), // Optional reason provided by user
  retentionExpiresAt: timestamp("retention_expires_at").notNull(), // When data can be permanently deleted (e.g., 90 days)
});

export const insertArchivedUserSchema = createInsertSchema(archivedUsers).omit({
  id: true,
  archivedAt: true,
});
export type InsertArchivedUser = z.infer<typeof insertArchivedUserSchema>;
export type ArchivedUser = typeof archivedUsers.$inferSelect;

// Phone change requests - OTP verification for phone number changes
export const phoneChangeRequests = pgTable("phone_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  newPhone: text("new_phone").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  status: text("status").notNull().default("pending"), // 'pending' | 'verified' | 'expired' | 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPhoneChangeRequestSchema = createInsertSchema(phoneChangeRequests).omit({
  id: true,
  createdAt: true,
});
export type InsertPhoneChangeRequest = z.infer<typeof insertPhoneChangeRequestSchema>;
export type PhoneChangeRequest = typeof phoneChangeRequests.$inferSelect;
