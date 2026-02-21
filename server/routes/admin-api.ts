import { Router } from "express";
import { storage } from "../storage";
import { createLoyaltyServices } from "../services/loyalty";
import { sendRegistrationInvite } from "../services/sms";
import { checkSMSRateLimit, recordSMSSent } from "../services/smsRateLimiter";
import { getAuthUserId, getAuthUserType } from "./auth";
import { recordTransactionSchema } from "../validation/auth-schemas";
import { validateDiscoveryRequest, validateDiscoveryEligibility, getSubscriptionStatus } from "../validation/discovery-rules";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { getSchedulerStatus, fetchAndProcessFtpFiles, recordFetchResult } from "../services/scheduler";

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
  vatNumber: z.string().optional(),
  tradingName: z.string().optional(),
  description: z.string().optional(),
  cuisineType: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  businessHours: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
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
        
        // Create in legacy users table (for FK relationships)
        staffUser = await storage.createUser({
          email,
          name,
          phone: phone || null,
          password: hashedPassword,
          userType: 'restaurant_admin',
        });
        
        // Also create in new restaurant_staff table (for portal authentication)
        try {
          await storage.createStaff({
            email,
            name,
            phone: phone || null,
            password: hashedPassword,
          });
        } catch (staffErr) {
          console.log("[Staff Create] Could not create in restaurant_staff table:", staffErr);
          // Continue even if staff creation fails - legacy users table is the source of truth
        }
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

      // Prevent changing from all_branches to specific_branches
      // Expanding from specific to all is allowed (benefits diners)
      if (voucherType.redemptionScope === "all_branches" && req.body.redemptionScope === "specific_branches") {
        return res.status(400).json({ error: "Cannot restrict a voucher from all branches to specific branches, as this would negatively affect diners who expect to use it at any location." });
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
      if (!voucherType || voucherType.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Voucher type not found" });
      }

      // Prevent deletion if any diner has earned vouchers from this type
      const hasVouchers = await storage.hasVouchersForType(voucherTypeId);
      if (hasVouchers) {
        return res.status(400).json({ error: "This voucher cannot be deleted because diners have already started earning points towards it. You can deactivate it instead." });
      }

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
      
      if (!billId || !billId.trim()) {
        return res.status(400).json({ error: "Bill ID is required to redeem a voucher" });
      }
      
      const result = await services.voucher.redeemVoucherByCode(restaurantId!, code, billId.trim(), branchId);
      
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

  router.get("/api/admin/reconciliation/insights", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const batches = await storage.getReconciliationBatchesByRestaurant(restaurantId!);
      if (batches.length === 0) {
        return res.json({
          totalBatches: 0,
          totalMatchedRecords: 0,
          totalUnmatchedRecords: 0,
          matchRate: 0,
          totalReconciled: 0,
          totalRecordedRevenue: 0,
          totalCSVRevenue: 0,
          totalVariance: 0,
          averageTransactionValue: 0,
          uniqueDiners: 0,
          topDiners: [],
          revenueByDate: [],
          transactionsByDiner: [],
          varianceDistribution: [],
          batchSummaries: [],
          topMenuItems: [],
          menuItemsByDiner: [],
        });
      }

      let totalMatchedRecords = 0;
      let totalUnmatchedRecords = 0;
      let totalReconciled = 0;
      let totalRecordedRevenue = 0;
      let totalCSVRevenue = 0;
      let totalVariance = 0;
      const dinerSpending: Record<string, { label: string; totalSpent: number; transactionCount: number }> = {};
      const dateRevenue: Record<string, { recorded: number; csv: number; count: number }> = {};
      const varianceBuckets = { zero: 0, smallPos: 0, largePos: 0, smallNeg: 0, largeNeg: 0 };
      const batchSummaries: Array<{ fileName: string; uploadedAt: string; matched: number; total: number; matchRate: number }> = [];
      const menuItemCounts: Record<string, { count: number; totalRevenue: number }> = {};
      const dinerMenuItems: Record<string, Record<string, { count: number; totalAmount: number }>> = {};

      let dinerCounter = 0;
      const dinerLabelMap = new Map<string, string>();

      for (const batch of batches) {
        batchSummaries.push({
          fileName: batch.fileName,
          uploadedAt: batch.uploadedAt?.toISOString() || '',
          matched: batch.matchedRecords,
          total: batch.totalRecords,
          matchRate: batch.totalRecords > 0 ? Math.round((batch.matchedRecords / batch.totalRecords) * 1000) / 10 : 0,
        });

        totalMatchedRecords += batch.matchedRecords;
        totalUnmatchedRecords += batch.unmatchedRecords;
        totalReconciled += batch.totalRecords;

        const records = await storage.getReconciliationRecordsByBatch(batch.id);

        for (const record of records) {
          if (!record.isMatched) continue;

          const transaction = await storage.getTransactionByBillId(restaurantId!, record.billId);
          if (!transaction) continue;

          const recordedAmt = parseFloat(transaction.amountSpent) || 0;
          totalRecordedRevenue += recordedAmt;

          let csvAmt = 0;
          if (record.csvAmount) {
            const cleaned = record.csvAmount.replace(/[R$,\s]/g, '').replace(',', '.');
            csvAmt = parseFloat(cleaned) || 0;
          }
          totalCSVRevenue += csvAmt;

          const variance = csvAmt - recordedAmt;
          totalVariance += variance;

          if (Math.abs(variance) < 0.01) varianceBuckets.zero++;
          else if (variance > 0 && variance <= 50) varianceBuckets.smallPos++;
          else if (variance > 50) varianceBuckets.largePos++;
          else if (variance < 0 && variance >= -50) varianceBuckets.smallNeg++;
          else varianceBuckets.largeNeg++;

          const dinerId = transaction.dinerId;
          if (!dinerLabelMap.has(dinerId)) {
            dinerCounter++;
            dinerLabelMap.set(dinerId, `User ${dinerCounter}`);
          }
          const dinerLabel = dinerLabelMap.get(dinerId)!;

          if (!dinerSpending[dinerId]) {
            dinerSpending[dinerId] = { label: dinerLabel, totalSpent: 0, transactionCount: 0 };
          }
          dinerSpending[dinerId].totalSpent += recordedAmt;
          dinerSpending[dinerId].transactionCount++;

          const dateKey = record.csvDate || transaction.transactionDate?.toISOString().split('T')[0] || 'Unknown';
          if (!dateRevenue[dateKey]) {
            dateRevenue[dateKey] = { recorded: 0, csv: 0, count: 0 };
          }
          dateRevenue[dateKey].recorded += recordedAmt;
          dateRevenue[dateKey].csv += csvAmt;
          dateRevenue[dateKey].count++;

          const csvObj = typeof record.csvData === 'string' ? JSON.parse(record.csvData) : record.csvData;
          if (csvObj) {
            for (let mi = 1; mi <= 10; mi++) {
              const itemName = csvObj[`menu_item_${mi}`]?.toString().trim();
              if (!itemName) continue;
              const itemAmtStr = csvObj[`menu_item_${mi}_amount`]?.toString().replace(/[R$,\s]/g, '').replace(',', '.') || '0';
              const itemAmt = parseFloat(itemAmtStr) || 0;

              if (!menuItemCounts[itemName]) {
                menuItemCounts[itemName] = { count: 0, totalRevenue: 0 };
              }
              menuItemCounts[itemName].count++;
              menuItemCounts[itemName].totalRevenue += itemAmt;

              if (!dinerMenuItems[dinerId]) {
                dinerMenuItems[dinerId] = {};
              }
              if (!dinerMenuItems[dinerId][itemName]) {
                dinerMenuItems[dinerId][itemName] = { count: 0, totalAmount: 0 };
              }
              dinerMenuItems[dinerId][itemName].count++;
              dinerMenuItems[dinerId][itemName].totalAmount += itemAmt;
            }
          }
        }
      }

      const uniqueDiners = Object.keys(dinerSpending).length;
      const averageTransactionValue = totalMatchedRecords > 0 ? totalRecordedRevenue / totalMatchedRecords : 0;
      const matchRate = totalReconciled > 0 ? Math.round((totalMatchedRecords / totalReconciled) * 1000) / 10 : 0;

      const topDiners = Object.values(dinerSpending)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map(d => ({
          label: d.label,
          totalSpent: Math.round(d.totalSpent * 100) / 100,
          transactionCount: d.transactionCount,
          avgSpend: Math.round((d.totalSpent / d.transactionCount) * 100) / 100,
        }));

      const revenueByDate = Object.entries(dateRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date,
          recorded: Math.round(data.recorded * 100) / 100,
          csv: Math.round(data.csv * 100) / 100,
          count: data.count,
        }));

      const transactionsByDiner = Object.values(dinerSpending)
        .sort((a, b) => b.transactionCount - a.transactionCount)
        .slice(0, 10)
        .map(d => ({
          label: d.label,
          transactionCount: d.transactionCount,
          totalSpent: Math.round(d.totalSpent * 100) / 100,
        }));

      const varianceDistribution = [
        { range: 'Exact Match', count: varianceBuckets.zero },
        { range: 'Under R50', count: varianceBuckets.smallPos },
        { range: 'Over R50', count: varianceBuckets.largePos },
        { range: '-R50 to R0', count: varianceBuckets.smallNeg },
        { range: 'Below -R50', count: varianceBuckets.largeNeg },
      ];

      const topMenuItems = Object.entries(menuItemCounts)
        .sort(([, a], [, b]) => b.count - a.count || b.totalRevenue - a.totalRevenue)
        .map(([name, data]) => ({
          name,
          count: data.count,
          totalRevenue: Math.round(data.totalRevenue * 100) / 100,
          avgPrice: data.count > 0 ? Math.round((data.totalRevenue / data.count) * 100) / 100 : 0,
        }));

      const menuItemsByDiner = Object.entries(dinerMenuItems)
        .map(([dinerId, items]) => ({
          label: dinerLabelMap.get(dinerId) || dinerId,
          items: Object.entries(items)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([name, data]) => ({
              name,
              count: data.count,
              totalAmount: Math.round(data.totalAmount * 100) / 100,
            })),
        }))
        .sort((a, b) => {
          const aTotal = a.items.reduce((s, i) => s + i.count, 0);
          const bTotal = b.items.reduce((s, i) => s + i.count, 0);
          return bTotal - aTotal;
        });

      res.json({
        totalBatches: batches.length,
        totalMatchedRecords,
        totalUnmatchedRecords,
        matchRate,
        totalReconciled,
        totalRecordedRevenue: Math.round(totalRecordedRevenue * 100) / 100,
        totalCSVRevenue: Math.round(totalCSVRevenue * 100) / 100,
        totalVariance: Math.round(totalVariance * 100) / 100,
        averageTransactionValue: Math.round(averageTransactionValue * 100) / 100,
        uniqueDiners,
        topDiners,
        revenueByDate,
        transactionsByDiner,
        varianceDistribution,
        batchSummaries,
        topMenuItems,
        menuItemsByDiner,
      });
    } catch (error) {
      console.error("Reconciliation insights error:", error);
      res.status(500).json({ error: "Failed to generate insights" });
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

  router.get("/api/admin/discovery", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      res.json({
        dinerDiscoveryEnabled: restaurant.dinerDiscoveryEnabled,
        dinerDiscoveryAcceptedAt: restaurant.dinerDiscoveryAcceptedAt,
      });
    } catch (error) {
      console.error("Get discovery settings error:", error);
      res.status(500).json({ error: "Failed to fetch discovery settings" });
    }
  });

  router.post("/api/admin/discovery", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const { enabled, termsAccepted } = req.body;

      const requestValidation = validateDiscoveryRequest({ enabled, termsAccepted });
      if (!requestValidation.valid) {
        return res.status(422).json({ error: requestValidation.errors[0] });
      }

      const restaurant = await storage.getRestaurant(restaurantId!);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const eligibility = validateDiscoveryEligibility(restaurant.onboardingStatus);
      if (!eligibility.eligible) {
        return res.status(422).json({ error: eligibility.error });
      }

      const updatedRestaurant = await storage.updateRestaurantDiscovery(restaurantId!, {
        dinerDiscoveryEnabled: enabled,
        dinerDiscoveryAcceptedAt: enabled ? new Date() : null,
      });

      await storage.createActivityLog({
        restaurantId: restaurantId!,
        userId: userId || null,
        action: enabled ? 'discovery_enabled' : 'discovery_disabled',
        targetType: 'restaurant',
        targetId: restaurantId!,
        details: enabled ? JSON.stringify({ termsAcceptedAt: new Date().toISOString() }) : null,
      });

      res.json({
        dinerDiscoveryEnabled: updatedRestaurant.dinerDiscoveryEnabled,
        dinerDiscoveryAcceptedAt: updatedRestaurant.dinerDiscoveryAcceptedAt,
      });
    } catch (error: any) {
      console.error("Update discovery settings error:", error);
      res.status(400).json({ error: error.message || "Failed to update discovery settings" });
    }
  });

  router.get("/api/admin/subscription", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const subscription = await storage.getRestaurantSubscription(restaurantId!);
      const status = getSubscriptionStatus(subscription ?? null);
      res.json(status);
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  router.post("/api/admin/subscription/subscribe", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const existing = await storage.getRestaurantSubscription(restaurantId!);
      const now = new Date();

      if (existing) {
        const updated = await storage.updateRestaurantSubscription(restaurantId!, {
          isSubscribed: true,
          plan: "premium",
          subscribedAt: now,
          expiresAt: null,
        });
        const status = getSubscriptionStatus(updated);
        return res.json(status);
      }

      const created = await storage.createRestaurantSubscription({
        restaurantId: restaurantId!,
        isSubscribed: true,
        plan: "premium",
        subscribedAt: now,
        expiresAt: null,
      });
      const status = getSubscriptionStatus(created);
      res.json(status);
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  router.post("/api/admin/subscription/unsubscribe", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const existing = await storage.getRestaurantSubscription(restaurantId!);
      if (!existing) {
        const created = await storage.createRestaurantSubscription({
          restaurantId: restaurantId!,
          isSubscribed: false,
          plan: "free",
          subscribedAt: null,
          expiresAt: null,
        });
        const status = getSubscriptionStatus(created);
        return res.json(status);
      }

      if (!existing.isSubscribed) {
        const status = getSubscriptionStatus(existing);
        return res.json(status);
      }

      const updated = await storage.updateRestaurantSubscription(restaurantId!, {
        isSubscribed: false,
        plan: "free",
      });
      const status = getSubscriptionStatus(updated);
      res.json(status);
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  router.get("/api/admin/ftp-status", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const status = getSchedulerStatus(restaurantId!);
      res.json(status);
    } catch (error) {
      console.error("Get FTP status error:", error);
      res.status(500).json({ error: "Failed to fetch FTP status" });
    }
  });

  router.post("/api/admin/ftp-fetch", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const restaurant = await storage.getRestaurant(restaurantId!);
      const ftpPath = restaurant?.ftpPath;

      const result = await fetchAndProcessFtpFiles(restaurantId!, ftpPath || undefined);
      recordFetchResult(restaurantId!, result);
      res.json(result);
    } catch (error) {
      console.error("Manual FTP fetch error:", error);
      res.status(500).json({ error: "Failed to run FTP fetch" });
    }
  });

  router.get("/api/admin/ftp-path", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const restaurant = await storage.getRestaurant(restaurantId!);
      res.json({ ftpPath: restaurant?.ftpPath || null });
    } catch (error) {
      console.error("Get FTP path error:", error);
      res.status(500).json({ error: "Failed to fetch FTP path" });
    }
  });

  router.put("/api/admin/ftp-path", async (req, res) => {
    try {
      const { restaurantId, error } = await getAdminRestaurantId(req);
      if (error) return res.status(error.status).json({ error: error.message });

      const { ftpPath } = req.body;
      if (ftpPath !== null && typeof ftpPath !== "string") {
        return res.status(400).json({ error: "ftpPath must be a string or null" });
      }

      const updated = await storage.updateRestaurant(restaurantId!, { ftpPath: ftpPath || null });
      res.json({ ftpPath: updated.ftpPath });
    } catch (error) {
      console.error("Update FTP path error:", error);
      res.status(500).json({ error: "Failed to update FTP path" });
    }
  });

}
