import { Router } from "express";
import { storage } from "../storage";
import { createLoyaltyServices } from "../services/loyalty";
import { z } from "zod";
import { insertTransactionSchema } from "@shared/schema";
import { getAuthUserId } from "./auth";

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

const services = createLoyaltyServices(storage);

export function registerTransactionRoutes(router: Router): void {
  router.post("/api/transactions", async (req, res) => {
    try {
      const { dinerId, restaurantId, amountSpent, branchId } = insertTransactionSchema.extend({
        branchId: z.string().optional()
      }).parse(req.body);
      const result = await services.loyalty.recordTransaction(
        dinerId, 
        restaurantId, 
        Number(amountSpent),
        undefined,
        branchId
      );
      res.json(result);
    } catch (error: any) {
      console.error("Transaction error:", error);
      res.status(400).json({ error: error.message || "Invalid transaction data" });
    }
  });

  router.get("/api/restaurants/:restaurantId/transactions", async (req, res) => {
    try {
      if (!req.session.userId) {
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
      
      let branchId = req.query.branchId as string | undefined;
      
      const branchAccess = await storage.getAccessibleBranchIds(req.session.userId, restaurantId);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess && branchAccess.branchIds.length > 0) {
        branchId = branchAccess.branchIds[0];
      }
      
      const transactions = await storage.getTransactionsByRestaurant(restaurantId, true, branchId || null);
      
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

  router.post("/api/restaurants/:restaurantId/transactions/record", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
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
        restaurantId,
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
}
