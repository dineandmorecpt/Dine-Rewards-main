import { Router } from "express";
import { storage } from "../storage";
import { createLoyaltyServices } from "../services/loyalty";
import { getAuthUserId, getAuthUserType } from "./auth";
import { z } from "zod";

const services = createLoyaltyServices(storage);

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
  role: z.enum(["manager", "staff"]).default("staff"),
  hasAllBranchAccess: z.boolean().default(true),
  branchIds: z.array(z.string()).default([]),
});

const updateBranchAccessSchema = z.object({
  hasAllBranchAccess: z.boolean(),
  branchIds: z.array(z.string()),
});

export function registerRestaurantRoutes(router: Router): void {
  router.get("/api/restaurants", async (req, res) => {
    try {
      const allRestaurants = await storage.getAllRestaurants();
      res.json(allRestaurants);
    } catch (error) {
      console.error("Get restaurants error:", error);
      res.status(500).json({ error: "Failed to fetch restaurants" });
    }
  });

  router.get("/api/restaurants/:restaurantId", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error) {
      console.error("Get restaurant error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant" });
    }
  });

  router.patch("/api/restaurants/:restaurantId/settings", async (req, res) => {
    try {
      const { restaurantId } = req.params;
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
      
      const updatedRestaurant = await services.config.updateRestaurantSettings(restaurantId, settings);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId || null,
        action: 'settings_updated',
        targetType: 'settings',
        targetId: restaurantId,
        details: JSON.stringify(settings),
      });
      
      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update restaurant settings error:", error);
      res.status(400).json({ error: error.message || "Failed to update settings" });
    }
  });

  router.patch("/api/restaurants/:restaurantId/profile", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant" });
      }

      const parseResult = profileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }

      const updatedRestaurant = await storage.updateRestaurantProfile(restaurantId, parseResult.data);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'profile_updated',
        targetType: 'restaurant',
        targetId: restaurantId,
        details: JSON.stringify({ fields: Object.keys(parseResult.data) }),
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update restaurant profile error:", error);
      res.status(400).json({ error: error.message || "Failed to update profile" });
    }
  });

  router.patch("/api/restaurants/:restaurantId/onboarding", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parseResult = onboardingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }

      const updatedRestaurant = await storage.updateRestaurantOnboarding(restaurantId, parseResult.data);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'onboarding_updated',
        targetType: 'restaurant',
        targetId: restaurantId,
        details: JSON.stringify({ fields: Object.keys(parseResult.data) }),
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update onboarding error:", error);
      res.status(400).json({ error: error.message || "Failed to update onboarding data" });
    }
  });

  router.post("/api/restaurants/:restaurantId/onboarding/submit", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
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

      const updatedRestaurant = await storage.updateRestaurantOnboarding(restaurantId, {
        onboardingStatus: 'submitted',
      });

      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'onboarding_submitted',
        targetType: 'restaurant',
        targetId: restaurantId,
        details: null,
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Submit onboarding error:", error);
      res.status(400).json({ error: error.message || "Failed to submit onboarding" });
    }
  });

  router.post("/api/restaurants/:restaurantId/onboarding/activate", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      if (restaurant.onboardingStatus !== 'submitted') {
        return res.status(422).json({ error: "Restaurant must be submitted before activation" });
      }

      const updatedRestaurant = await storage.updateRestaurantOnboarding(restaurantId, {
        onboardingStatus: 'active',
        onboardingCompletedAt: new Date(),
      });

      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'restaurant_activated',
        targetType: 'restaurant',
        targetId: restaurantId,
        details: null,
      });

      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Activate restaurant error:", error);
      res.status(400).json({ error: error.message || "Failed to activate restaurant" });
    }
  });

  router.get("/api/restaurants/:restaurantId/branches", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const branchList = await storage.getBranchesByRestaurant(restaurantId);
      res.json(branchList);
    } catch (error) {
      console.error("Get branches error:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  router.post("/api/restaurants/:restaurantId/branches", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const parseResult = createBranchSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }

      const { name, address, phone, isDefault } = parseResult.data;
      
      const branch = await storage.createBranch({
        restaurantId,
        name,
        address,
        phone,
        isDefault,
        isActive: true,
      });

      if (isDefault) {
        await storage.setDefaultBranch(restaurantId, branch.id);
      }

      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId || null,
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

  router.patch("/api/restaurants/:restaurantId/branches/:branchId", async (req, res) => {
    try {
      const { restaurantId, branchId } = req.params;
      const updates = req.body;

      const branch = await storage.updateBranch(branchId, updates);
      
      if (updates.isDefault) {
        await storage.setDefaultBranch(restaurantId, branchId);
      }

      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId || null,
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

  router.delete("/api/restaurants/:restaurantId/branches/:branchId", async (req, res) => {
    try {
      const { restaurantId, branchId } = req.params;
      
      const branch = await storage.getBranch(branchId);
      if (branch?.isDefault) {
        return res.status(400).json({ error: "Cannot delete the default branch. Set another branch as default first." });
      }

      await storage.deleteBranch(branchId);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId || null,
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

  router.get("/api/restaurants/:restaurantId/stats", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const userType = getAuthUserType(req);
      
      if (!userId || userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant's stats" });
      }
      
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(userId, restaurantId);
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
      
      const stats = await services.stats.getRestaurantStats(restaurantId, branchId || null);
      res.json(stats);
    } catch (error) {
      console.error("Get restaurant stats error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant stats" });
    }
  });

  router.get("/api/restaurants/:restaurantId/revenue", async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const userType = getAuthUserType(req);
      
      if (!userId || userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant's stats" });
      }
      
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
      
      const branchAccess = await storage.getAccessibleBranchIds(userId, restaurantId);
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
      
      const data = await storage.getRevenueByDateRange(restaurantId, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get revenue error:", error);
      res.status(500).json({ error: "Failed to fetch revenue data" });
    }
  });

  router.get("/api/restaurants/:restaurantId/diners", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant" });
      }
      
      const diners = await storage.getRegisteredDinersByRestaurant(restaurantId);
      res.json(diners);
    } catch (error) {
      console.error("Get registered diners error:", error);
      res.status(500).json({ error: "Failed to fetch registered diners" });
    }
  });

  router.get("/api/restaurants/:restaurantId/portal-users", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can manage staff" });
      }
      
      const portalUsersList = await storage.getPortalUsersByRestaurant(restaurantId);
      res.json(portalUsersList);
    } catch (error) {
      console.error("Get portal users error:", error);
      res.status(500).json({ error: "Failed to fetch staff members" });
    }
  });

  router.post("/api/restaurants/:restaurantId/portal-users", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can add staff" });
      }
      
      const parseResult = addStaffUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }
      
      const { email, role, hasAllBranchAccess, branchIds } = parseResult.data;
      
      const existingUser = await storage.getUserByEmail(email);
      if (!existingUser) {
        return res.status(404).json({ error: "No user found with that email. They must register first." });
      }
      
      if (existingUser.userType !== 'restaurant_admin') {
        return res.status(400).json({ error: "This email belongs to a diner account, not a restaurant admin." });
      }
      
      const existingPortalUser = await storage.getPortalUserByUserAndRestaurant(existingUser.id, restaurantId);
      if (existingPortalUser) {
        return res.status(400).json({ error: "This user is already a staff member of this restaurant." });
      }
      
      const portalUser = await storage.addPortalUser({
        restaurantId,
        userId: existingUser.id,
        role,
        addedBy: req.session.userId,
        hasAllBranchAccess,
      });
      
      if (!hasAllBranchAccess && branchIds.length > 0) {
        const restaurantBranches = await storage.getBranchesByRestaurant(restaurantId);
        const validBranchIds = restaurantBranches.map(b => b.id);
        const invalidBranches = branchIds.filter(id => !validBranchIds.includes(id));
        if (invalidBranches.length > 0) {
          return res.status(400).json({ error: "One or more branch IDs are invalid for this restaurant" });
        }
        await storage.setPortalUserBranches(portalUser.id, branchIds);
      }
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'staff_added',
        targetType: 'portal_user',
        targetId: portalUser.id,
        details: JSON.stringify({ email, role }),
      });
      
      res.json({ ...portalUser, user: existingUser });
    } catch (error: any) {
      console.error("Add portal user error:", error);
      res.status(500).json({ error: error.message || "Failed to add staff member" });
    }
  });

  router.delete("/api/restaurants/:restaurantId/portal-users/:portalUserId", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId, portalUserId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can remove staff" });
      }
      
      await storage.removePortalUser(portalUserId);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
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

  router.put("/api/restaurants/:restaurantId/portal-users/:portalUserId/branch-access", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId, portalUserId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Only the restaurant owner can update staff access" });
      }
      
      const parseResult = updateBranchAccessSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ error: parseResult.error.errors[0]?.message });
      }
      
      const { hasAllBranchAccess, branchIds } = parseResult.data;
      
      if (!hasAllBranchAccess && branchIds.length > 0) {
        const restaurantBranches = await storage.getBranchesByRestaurant(restaurantId);
        const validBranchIds = restaurantBranches.map(b => b.id);
        const invalidBranches = branchIds.filter(id => !validBranchIds.includes(id));
        if (invalidBranches.length > 0) {
          return res.status(400).json({ error: "One or more branch IDs are invalid for this restaurant" });
        }
      }
      
      await storage.updatePortalUserBranchAccess(portalUserId, hasAllBranchAccess, branchIds);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
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

  router.get("/api/restaurants/:restaurantId/activity-logs", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant's activity logs" });
      }
      
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      
      const logs = await storage.getActivityLogsByRestaurant(restaurantId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Get activity logs error:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });
}
