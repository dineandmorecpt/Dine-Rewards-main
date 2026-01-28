import { Router } from "express";
import { storage } from "../storage";
import { createLoyaltyServices } from "../services/loyalty";
import { getAuthUserId, getAuthUserType } from "./auth";
import { z } from "zod";

const services = createLoyaltyServices(storage);

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

export function registerVoucherRoutes(router: Router): void {
  router.post("/api/restaurants/:restaurantId/vouchers/redeem", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { code, billId, branchId } = req.body;
      const result = await services.voucher.redeemVoucherByCode(restaurantId, code, billId, branchId);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId || null,
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
  
  router.get("/api/restaurants/:restaurantId/voucher-types", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const voucherTypes = await storage.getVoucherTypesByRestaurant(restaurantId);
      res.json(voucherTypes);
    } catch (error) {
      console.error("Get voucher types error:", error);
      res.status(500).json({ error: "Failed to fetch voucher types" });
    }
  });

  router.get("/api/restaurants/:restaurantId/voucher-types/active", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const voucherTypes = await storage.getActiveVoucherTypesByRestaurant(restaurantId);
      res.json(voucherTypes);
    } catch (error) {
      console.error("Get active voucher types error:", error);
      res.status(500).json({ error: "Failed to fetch voucher types" });
    }
  });

  router.post("/api/restaurants/:restaurantId/voucher-types", async (req, res) => {
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
        restaurantId,
        ...parseResult.data,
        expiresAt: parseResult.data.expiresAt ? new Date(parseResult.data.expiresAt) : undefined,
      });

      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
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

  router.patch("/api/restaurants/:restaurantId/voucher-types/:voucherTypeId", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId, voucherTypeId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && (!portalAccess || portalAccess.role === 'staff')) {
        return res.status(403).json({ error: "Only owners and managers can update voucher types" });
      }

      const voucherType = await storage.getVoucherType(voucherTypeId);
      if (!voucherType || voucherType.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Voucher type not found" });
      }

      const updated = await storage.updateVoucherType(voucherTypeId, req.body);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
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

  router.delete("/api/restaurants/:restaurantId/voucher-types/:voucherTypeId", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId, voucherTypeId } = req.params;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && (!portalAccess || portalAccess.role === 'staff')) {
        return res.status(403).json({ error: "Only owners and managers can delete voucher types" });
      }

      const voucherType = await storage.getVoucherType(voucherTypeId);

      await storage.deleteVoucherType(voucherTypeId);
      
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
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

  router.get("/api/restaurants/:restaurantId/voucher-redemptions-by-type", async (req, res) => {
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
      
      const data = await storage.getVoucherRedemptionsByType(restaurantId, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get voucher redemptions by type error:", error);
      res.status(500).json({ error: "Failed to fetch voucher redemptions" });
    }
  });
}
