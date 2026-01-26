import { Router } from "express";
import { storage } from "../storage";
import { createLoyaltyServices } from "../services/loyalty";
import { sendRegistrationInvite } from "../services/sms";
import { checkSMSRateLimit, recordSMSSent } from "../services/smsRateLimiter";
import { getAuthUserId, getAuthUserType } from "./auth";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";

const services = createLoyaltyServices(storage);

const smsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many SMS requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  tradingName: z.string().optional(),
  description: z.string().optional(),
  cuisineType: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  businessHours: z.string().optional(),
  logoUrl: z.string().optional(),
});

const onboardingSchema = z.object({
  registrationNumber: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  hasAdditionalBranches: z.boolean().optional(),
  logoUrl: z.string().optional(),
});

const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

const addStaffUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(7, "Phone number must be at least 7 digits").optional(),
  role: z.enum(["manager", "staff"]).default("staff"),
  hasAllBranchAccess: z.boolean().default(true),
  branchIds: z.array(z.string()).default([]),
});

const updateBranchAccessSchema = z.object({
  hasAllBranchAccess: z.boolean(),
  branchIds: z.array(z.string()),
});

const createVoucherTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  rewardDetails: z.string().optional(),
  category: z.string().optional(),
  earningMode: z.string().optional(),
  pointsPerCurrencyOverride: z.number().optional(),
  value: z.number().optional(),
  freeItemType: z.string().optional(),
  freeItemDescription: z.string().optional(),
  redemptionScope: z.string().optional(),
  redeemableBranchIds: z.array(z.string()).optional(),
  creditsCost: z.number().int().min(1).default(1),
  validityDays: z.number().int().min(1).default(30),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

const recordTransactionSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  billId: z.string().optional(),
  branchId: z.string().optional(),
  amountSpent: z.coerce.number()
    .refine(val => !isNaN(val), { message: "Amount must be a valid number" })
    .refine(val => val > 0, { message: "Amount must be greater than zero" })
});

const inviteDinerSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
});

async function getAdminRestaurantId(req: any): Promise<{ restaurantId: string | null; error: { status: number; message: string } | null }> {
  const userId = getAuthUserId(req);
  const userType = getAuthUserType(req);
  
  if (!userId) {
    return { restaurantId: null, error: { status: 401, message: "Unauthorized" } };
  }
  
  if (userType !== 'restaurant_admin') {
    return { restaurantId: null, error: { status: 403, message: "Access denied. Admin access required." } };
  }
  
  const restaurants = await storage.getRestaurantsByAdmin(userId);
  if (restaurants.length === 0) {
    const portalAccess = await storage.getPortalUsersByUserId(userId);
    if (portalAccess.length > 0) {
      return { restaurantId: portalAccess[0].restaurantId, error: null };
    }
    return { restaurantId: null, error: { status: 404, message: "No restaurant found for this admin" } };
  }
  
  return { restaurantId: restaurants[0].id, error: null };
}

export function registerAdminApiRoutes(router: Router): void {
  router.get("/api/admin/restaurant", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error) {
      console.error("Get admin restaurant error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant" });
    }
  });

  router.patch("/api/admin/restaurant/settings", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const rawSettings = req.body;
      
      const settings: Record<string, any> = {};
      if (rawSettings.voucherValue !== undefined && rawSettings.voucherValue !== '') {
        settings.voucherValue = rawSettings.voucherValue;
      }
      if (rawSettings.voucherValidityDays !== undefined && rawSettings.voucherValidityDays !== '') {
        const val = Number(rawSettings.voucherValidityDays);
        if (!isNaN(val)) settings.voucherValidityDays = val;
      }
      if (rawSettings.pointsPerCurrency !== undefined && rawSettings.pointsPerCurrency !== '') {
        const val = Number(rawSettings.pointsPerCurrency);
        if (!isNaN(val)) settings.pointsPerCurrency = val;
      }
      if (rawSettings.pointsThreshold !== undefined && rawSettings.pointsThreshold !== '') {
        const val = Number(rawSettings.pointsThreshold);
        if (!isNaN(val)) settings.pointsThreshold = val;
      }
      if (rawSettings.voucherEarningMode !== undefined && rawSettings.voucherEarningMode !== '') {
        settings.voucherEarningMode = rawSettings.voucherEarningMode;
      }
      if (rawSettings.visitThreshold !== undefined && rawSettings.visitThreshold !== '') {
        const val = Number(rawSettings.visitThreshold);
        if (!isNaN(val)) settings.visitThreshold = val;
      }
      if (rawSettings.loyaltyScope !== undefined && rawSettings.loyaltyScope !== '') {
        settings.loyaltyScope = rawSettings.loyaltyScope;
      }
      if (rawSettings.voucherScope !== undefined && rawSettings.voucherScope !== '') {
        settings.voucherScope = rawSettings.voucherScope;
      }
      
      const updatedRestaurant = await services.config.updateRestaurantSettings(restaurantId!, settings);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId || null,
        action: 'settings_updated',
        targetType: 'settings',
        targetId: restaurantId!,
        details: JSON.stringify(settings),
      });
      
      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update restaurant settings error:", error);
      res.status(400).json({ error: error.message || "Failed to update settings" });
    }
  });

  router.patch("/api/admin/restaurant/profile", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const parseResult = profileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }

      const updatedRestaurant = await storage.updateRestaurantProfile(restaurantId!, parseResult.data);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'profile_updated',
        targetType: 'restaurant',
        targetId: restaurantId!,
        details: JSON.stringify({ fields: Object.keys(parseResult.data) }),
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update restaurant profile error:", error);
      res.status(400).json({ error: error.message || "Failed to update profile" });
    }
  });

  router.patch("/api/admin/restaurant/onboarding", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const parseResult = onboardingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }

      const updatedRestaurant = await storage.updateRestaurantOnboarding(restaurantId!, parseResult.data);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'onboarding_updated',
        targetType: 'restaurant',
        targetId: restaurantId!,
        details: JSON.stringify({ fields: Object.keys(parseResult.data) }),
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update onboarding error:", error);
      res.status(400).json({ error: error.message || "Failed to update onboarding data" });
    }
  });

  router.post("/api/admin/restaurant/onboarding/submit", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      if (restaurant.onboardingStatus !== 'draft') {
        return res.status(422).json({ error: "Restaurant has already been submitted or is active" });
      }

      if (!restaurant.registrationNumber) {
        return res.status(422).json({ error: "Registration number is required" });
      }
      if (!restaurant.streetAddress || !restaurant.city) {
        return res.status(422).json({ error: "Address details are required" });
      }
      if (!restaurant.contactName || !restaurant.contactEmail || !restaurant.contactPhone) {
        return res.status(422).json({ error: "Contact details are required" });
      }

      const updatedRestaurant = await storage.updateRestaurantOnboarding(restaurantId!, {
        onboardingStatus: 'submitted',
      });

      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'onboarding_submitted',
        targetType: 'restaurant',
        targetId: restaurantId!,
        details: null,
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Submit onboarding error:", error);
      res.status(400).json({ error: error.message || "Failed to submit onboarding" });
    }
  });

  router.post("/api/admin/restaurant/onboarding/activate", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      if (restaurant.onboardingStatus !== 'submitted') {
        return res.status(422).json({ error: "Restaurant must be submitted before activation" });
      }

      const updatedRestaurant = await storage.updateRestaurantOnboarding(restaurantId!, {
        onboardingStatus: 'active',
        onboardingCompletedAt: new Date(),
      });

      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'restaurant_activated',
        targetType: 'restaurant',
        targetId: restaurantId!,
        details: null,
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Activate restaurant error:", error);
      res.status(400).json({ error: error.message || "Failed to activate restaurant" });
    }
  });

  router.get("/api/admin/branches", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const branchList = await storage.getBranchesByRestaurant(restaurantId!);
      res.json(branchList);
    } catch (error) {
      console.error("Get branches error:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  router.post("/api/admin/branches", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const parseResult = createBranchSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }

      const { name, address, phone, isDefault } = parseResult.data;
      
      const branch = await storage.createBranch({
        restaurantId: restaurantId!,
        name,
        address,
        phone,
        isDefault,
        isActive: true,
      });

      if (isDefault) {
        await storage.setDefaultBranch(restaurantId!, branch.id);
      }

      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId || null,
        action: 'branch_created',
        targetType: 'branch',
        targetId: branch.id,
        details: JSON.stringify({ name, address }),
      });

      res.json(branch);
    } catch (error: any) {
      console.error("Create branch error:", error);
      res.status(500).json({ error: error.message || "Failed to create branch" });
    }
  });

  router.patch("/api/admin/branches/:branchId", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const { branchId } = req.params;
      const updates = req.body;

      const branch = await storage.updateBranch(branchId, updates);
      
      if (updates.isDefault) {
        await storage.setDefaultBranch(restaurantId!, branchId);
      }

      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId || null,
        action: 'branch_updated',
        targetType: 'branch',
        targetId: branchId,
        details: JSON.stringify(updates),
      });

      res.json(branch);
    } catch (error: any) {
      console.error("Update branch error:", error);
      res.status(500).json({ error: error.message || "Failed to update branch" });
    }
  });

  router.delete("/api/admin/branches/:branchId", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const { branchId } = req.params;
      
      const branch = await storage.getBranch(branchId);
      if (branch?.isDefault) {
        return res.status(400).json({ error: "Cannot delete the default branch. Set another branch as default first." });
      }

      await storage.deleteBranch(branchId);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId || null,
        action: 'branch_deleted',
        targetType: 'branch',
        targetId: branchId,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete branch error:", error);
      res.status(500).json({ error: error.message || "Failed to delete branch" });
    }
  });

  router.get("/api/admin/stats", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(userId!, restaurantId!);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess) {
        if (branchAccess.branchIds.length > 0) {
          branchId = branchAccess.branchIds[0];
        } else {
          return res.status(403).json({ error: "You don't have access to any branches" });
        }
      }
      
      const stats = await services.stats.getRestaurantStats(restaurantId!, branchId || null);
      res.json(stats);
    } catch (error) {
      console.error("Get restaurant stats error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant stats" });
    }
  });

  router.get("/api/admin/revenue", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const parseDate = (str: string | undefined, fallback: Date): Date => {
        if (!str) return fallback;
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return fallback;
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const endDate = parseDate(req.query.end as string, today);
      const startDate = parseDate(req.query.start as string, thirtyDaysAgo);
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(userId!, restaurantId!);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess) {
        if (branchAccess.branchIds.length > 0) {
          branchId = branchAccess.branchIds[0];
        } else {
          return res.status(403).json({ error: "You don't have access to any branches" });
        }
      }
      
      const data = await storage.getRevenueByDateRange(restaurantId!, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get revenue error:", error);
      res.status(500).json({ error: "Failed to fetch revenue data" });
    }
  });

  router.get("/api/admin/diners", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const diners = await storage.getRegisteredDinersByRestaurant(restaurantId!);
      res.json(diners);
    } catch (error) {
      console.error("Get registered diners error:", error);
      res.status(500).json({ error: "Failed to fetch registered diners" });
    }
  });

  router.get("/api/admin/staff", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can manage staff" });
      }
      
      const portalUsersList = await storage.getPortalUsersByRestaurant(restaurantId!);
      res.json(portalUsersList);
    } catch (error) {
      console.error("Get portal users error:", error);
      res.status(500).json({ error: "Failed to fetch staff members" });
    }
  });

  router.post("/api/admin/staff", async (req, res) => {
    try {
      console.log("[Staff Create] Request body:", JSON.stringify(req.body));
      
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can add staff" });
      }
      
      const parseResult = addStaffUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorDetails = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.log("[Staff Create] Validation failed:", errorDetails);
        return res.status(422).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
      }
      
      const { email, name, phone, role, hasAllBranchAccess, branchIds } = parseResult.data;
      
      let staffUser = await storage.getUserByEmail(email);
      
      if (staffUser) {
        if (staffUser.userType !== 'restaurant_admin') {
          return res.status(400).json({ error: "This email belongs to a diner account, not a restaurant admin." });
        }
        
        const existingPortalUser = await storage.getPortalUserByUserAndRestaurant(staffUser.id, restaurantId!);
        if (existingPortalUser) {
          return res.status(400).json({ error: "This user is already a staff member of this restaurant." });
        }
      } else {
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        
        staffUser = await storage.createUser({
          email,
          name,
          phone: phone || null,
          password: hashedPassword,
          userType: 'restaurant_admin',
        });
      }
      
      const portalUser = await storage.addPortalUser({
        restaurantId: restaurantId!,
        userId: staffUser.id,
        role,
        addedBy: userId!,
        hasAllBranchAccess,
      });
      
      if (!hasAllBranchAccess && branchIds.length > 0) {
        const restaurantBranches = await storage.getBranchesByRestaurant(restaurantId!);
        const validBranchIds = restaurantBranches.map(b => b.id);
        const invalidBranches = branchIds.filter(id => !validBranchIds.includes(id));
        if (invalidBranches.length > 0) {
          return res.status(400).json({ error: "One or more branch IDs are invalid for this restaurant" });
        }
        await storage.setPortalUserBranches(portalUser.id, branchIds);
      }
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'staff_added',
        targetType: 'portal_user',
        targetId: portalUser.id,
        details: JSON.stringify({ email, role }),
      });
      
      console.log("[Staff Create] Success - created staff:", email, "with role:", role);
      res.json({ ...portalUser, user: staffUser });
    } catch (error: any) {
      console.error("Add portal user error:", error);
      res.status(500).json({ error: error.message || "Failed to add staff member" });
    }
  });

  router.delete("/api/admin/staff/:portalUserId", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can remove staff" });
      }
      
      const { portalUserId } = req.params;
      
      await storage.removePortalUser(portalUserId);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'staff_removed',
        targetType: 'portal_user',
        targetId: portalUserId,
        details: null,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Remove portal user error:", error);
      res.status(500).json({ error: error.message || "Failed to remove staff member" });
    }
  });

  router.put("/api/admin/staff/:portalUserId/branch-access", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can update staff access" });
      }
      
      const { portalUserId } = req.params;
      
      const parseResult = updateBranchAccessSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }
      
      const { hasAllBranchAccess, branchIds } = parseResult.data;
      
      if (!hasAllBranchAccess && branchIds.length > 0) {
        const restaurantBranches = await storage.getBranchesByRestaurant(restaurantId!);
        const validBranchIds = restaurantBranches.map(b => b.id);
        const invalidBranches = branchIds.filter(id => !validBranchIds.includes(id));
        if (invalidBranches.length > 0) {
          return res.status(400).json({ error: "One or more branch IDs are invalid for this restaurant" });
        }
      }
      
      await storage.updatePortalUserBranchAccess(portalUserId, hasAllBranchAccess, branchIds);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'staff_branch_access_updated',
        targetType: 'portal_user',
        targetId: portalUserId,
        details: JSON.stringify({ hasAllBranchAccess, branchIds }),
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Update branch access error:", error);
      res.status(500).json({ error: error.message || "Failed to update branch access" });
    }
  });

  router.get("/api/admin/activity-logs", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      
      const logs = await storage.getActivityLogsByRestaurant(restaurantId!, limit);
      res.json(logs);
    } catch (error) {
      console.error("Get activity logs error:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  router.get("/api/admin/voucher-types", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const voucherTypes = await storage.getVoucherTypesByRestaurant(restaurantId!);
      res.json(voucherTypes);
    } catch (error) {
      console.error("Get voucher types error:", error);
      res.status(500).json({ error: "Failed to fetch voucher types" });
    }
  });

  router.get("/api/admin/voucher-types/active", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const voucherTypes = await storage.getActiveVoucherTypesByRestaurant(restaurantId!);
      res.json(voucherTypes);
    } catch (error) {
      console.error("Get active voucher types error:", error);
      res.status(500).json({ error: "Failed to fetch voucher types" });
    }
  });

  router.post("/api/admin/voucher-types", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(userId!, restaurantId!);
      
      if (!isOwner && (!portalAccess || portalAccess.role === 'staff')) {
        return res.status(403).json({ error: "Only owners and managers can create voucher types" });
      }

      const parseResult = createVoucherTypeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }
      
      if (parseResult.data.expiresAt) {
        const expiryDate = new Date(parseResult.data.expiresAt);
        const minExpiry = new Date();
        minExpiry.setMonth(minExpiry.getMonth() + 6);
        minExpiry.setHours(0, 0, 0, 0);
        
        if (expiryDate < minExpiry) {
          return res.status(422).json({ 
            error: "Voucher type expiry date must be at least 6 months from today" 
          });
        }
      }

      const voucherType = await storage.createVoucherType({
        restaurantId: restaurantId!,
        ...parseResult.data,
        expiresAt: parseResult.data.expiresAt ? new Date(parseResult.data.expiresAt) : undefined,
      });

      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'voucher_type_created',
        targetType: 'voucher_type',
        targetId: voucherType.id,
        details: JSON.stringify({ name: voucherType.name, creditsCost: voucherType.creditsCost }),
      });

      res.json(voucherType);
    } catch (error: any) {
      console.error("Create voucher type error:", error);
      res.status(500).json({ error: error.message || "Failed to create voucher type" });
    }
  });

  router.patch("/api/admin/voucher-types/:voucherTypeId", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(userId!, restaurantId!);
      
      if (!isOwner && (!portalAccess || portalAccess.role === 'staff')) {
        return res.status(403).json({ error: "Only owners and managers can update voucher types" });
      }
      
      const { voucherTypeId } = req.params;

      const voucherType = await storage.getVoucherType(voucherTypeId);
      if (!voucherType || voucherType.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Voucher type not found" });
      }

      const updated = await storage.updateVoucherType(voucherTypeId, req.body);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'voucher_type_updated',
        targetType: 'voucher_type',
        targetId: voucherTypeId,
        details: JSON.stringify({ changes: req.body }),
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Update voucher type error:", error);
      res.status(500).json({ error: error.message || "Failed to update voucher type" });
    }
  });

  router.delete("/api/admin/voucher-types/:voucherTypeId", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(userId!, restaurantId!);
      
      if (!isOwner && (!portalAccess || portalAccess.role === 'staff')) {
        return res.status(403).json({ error: "Only owners and managers can delete voucher types" });
      }
      
      const { voucherTypeId } = req.params;

      const voucherType = await storage.getVoucherType(voucherTypeId);

      await storage.deleteVoucherType(voucherTypeId);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId!,
        action: 'voucher_type_deleted',
        targetType: 'voucher_type',
        targetId: voucherTypeId,
        details: JSON.stringify({ name: voucherType?.name }),
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete voucher type error:", error);
      res.status(500).json({ error: error.message || "Failed to delete voucher type" });
    }
  });

  router.get("/api/admin/voucher-redemptions", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const parseDate = (str: string | undefined): Date | undefined => {
        if (!str) return undefined;
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return undefined;
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      };
      
      const startDate = parseDate(req.query.start as string);
      const endDate = parseDate(req.query.end as string);
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(userId!, restaurantId!);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess) {
        if (branchAccess.branchIds.length > 0) {
          branchId = branchAccess.branchIds[0];
        } else {
          return res.status(403).json({ error: "You don't have access to any branches" });
        }
      }
      
      const data = await storage.getVoucherRedemptionsByType(restaurantId!, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get voucher redemptions by type error:", error);
      res.status(500).json({ error: "Failed to fetch voucher redemptions" });
    }
  });

  router.post("/api/admin/vouchers/redeem", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const { code, billId, branchId } = req.body;
      const result = await services.voucher.redeemVoucherByCode(restaurantId!, code, billId, branchId);
      
      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId || null,
        action: 'voucher_redeemed',
        targetType: 'voucher',
        targetId: result.voucher?.id || code,
        details: JSON.stringify({ code, billId, branchId, dinerId: result.voucher?.dinerId }),
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Restaurant redeem voucher error:", error);
      res.status(400).json({ error: error.message || "Failed to redeem voucher" });
    }
  });

  router.get("/api/admin/transactions", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(userId!, restaurantId!);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess && branchAccess.branchIds.length > 0) {
        branchId = branchAccess.branchIds[0];
      }
      
      const transactions = await storage.getTransactionsByRestaurant(restaurantId!, true, branchId || null);
      
      const enrichedTransactions = await Promise.all(
        transactions.map(async (tx) => {
          const diner = await storage.getUser(tx.dinerId);
          return {
            ...tx,
            dinerName: diner?.name || 'Unknown',
            dinerPhone: diner?.phone || ''
          };
        })
      );
      
      res.json(enrichedTransactions);
    } catch (error) {
      console.error("Get restaurant transactions error:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  router.post("/api/admin/transactions/record", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const parseResult = recordTransactionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }
      
      const { phone, billId, branchId, amountSpent } = parseResult.data;
      
      const diner = await storage.getUserByPhone(phone);
      if (!diner) {
        return res.status(404).json({ error: "No customer found with that phone number" });
      }
      
      if (diner.userType !== 'diner') {
        return res.status(400).json({ error: "Phone number is not registered as a diner" });
      }
      
      const result = await services.loyalty.recordTransaction(
        diner.id,
        restaurantId!,
        amountSpent,
        billId || undefined,
        branchId || undefined
      );
      
      res.json({
        ...result,
        dinerName: diner.name,
        dinerPhone: phone
      });
    } catch (error: any) {
      console.error("Record transaction error:", error);
      res.status(500).json({ error: error.message || "Failed to record transaction" });
    }
  });

  router.post("/api/admin/reconciliation/upload", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const { fileName, csvContent } = req.body;
      
      if (!fileName || !csvContent) {
        return res.status(400).json({ error: "fileName and csvContent are required" });
      }
      
      const result = await services.reconciliation.processCSV(restaurantId!, fileName, csvContent);
      res.json(result);
    } catch (error: any) {
      console.error("Reconciliation upload error:", error);
      res.status(400).json({ error: error.message || "Failed to process CSV" });
    }
  });

  router.get("/api/admin/reconciliation/batches", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const batches = await services.reconciliation.getBatches(restaurantId!);
      res.json(batches);
    } catch (error) {
      console.error("Get reconciliation batches error:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation batches" });
    }
  });

  router.get("/api/admin/reconciliation/batches/:batchId", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const { batchId } = req.params;
      const result = await services.reconciliation.getBatchDetails(batchId);
      if (!result) {
        return res.status(404).json({ error: "Batch not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Get reconciliation batch details error:", error);
      res.status(500).json({ error: "Failed to fetch batch details" });
    }
  });

  router.post("/api/admin/diners/invite", smsRateLimiter, async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const parseResult = inviteDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }
      
      const { phone } = parseResult.data;
      
      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const smsLimitCheck = checkSMSRateLimit(phone, restaurantId!);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }
      
      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ error: "A customer with this phone number is already registered" });
      }
      
      const token = crypto.randomBytes(8).toString('base64url');
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const invitation = await storage.createDinerInvitation({
        restaurantId: restaurantId!,
        phone,
        token,
        status: "pending",
        expiresAt,
      });
      
      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'https';
      const fullRegistrationLink = `${protocol}://${host}/r/${token}`;
      const registrationLink = `/r/${token}`;
      
      let smsSent = false;
      let smsError: string | undefined;
      
      try {
        const smsResult = await sendRegistrationInvite(phone, restaurant.name, fullRegistrationLink);
        smsSent = smsResult.success;
        smsError = smsResult.error;
        
        if (smsResult.success) {
          recordSMSSent(phone, restaurantId!);
        }
      } catch (err: any) {
        console.error('SMS sending failed:', err);
        smsError = err.message;
      }
      
      res.json({
        success: true,
        smsSent,
        smsError,
        invitation: {
          id: invitation.id,
          phone: invitation.phone,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
          registrationLink,
        },
        message: smsSent 
          ? "Invitation sent via SMS to the customer." 
          : "Invitation created. Share the registration link with the customer manually."
      });
    } catch (error: any) {
      console.error("Create invitation error:", error);
      res.status(500).json({ error: error.message || "Failed to create invitation" });
    }
  });

  router.get("/api/admin/invitations", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const invitations = await storage.getDinerInvitationsByRestaurant(restaurantId!);
      res.json(invitations);
    } catch (error) {
      console.error("Get restaurant invitations error:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  router.get("/api/admin/diner-registrations", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });
      
      const parseDate = (str: string | undefined, fallback: Date): Date => {
        if (!str) return fallback;
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return fallback;
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const endDate = parseDate(req.query.end as string, today);
      const startDate = parseDate(req.query.start as string, thirtyDaysAgo);
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(userId!, restaurantId!);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess) {
        if (branchAccess.branchIds.length > 0) {
          branchId = branchAccess.branchIds[0];
        } else {
          return res.status(403).json({ error: "You don't have access to any branches" });
        }
      }
      
      const data = await storage.getDinerRegistrationsByDateRange(restaurantId!, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get diner registrations error:", error);
      res.status(500).json({ error: "Failed to fetch diner registrations" });
    }
  });
}
