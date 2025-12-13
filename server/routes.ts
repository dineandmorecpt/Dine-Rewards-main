import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createLoyaltyServices } from "./services/loyalty";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";

const recordTransactionSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  billId: z.string().optional(),
  amountSpent: z.coerce.number()
    .refine(val => !isNaN(val), { message: "Amount must be a valid number" })
    .refine(val => val > 0, { message: "Amount must be greater than zero" })
});

const services = createLoyaltyServices(storage);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // TRANSACTIONS - Record a transaction and calculate points
  app.post("/api/transactions", async (req, res) => {
    try {
      const { dinerId, restaurantId, amountSpent } = insertTransactionSchema.parse(req.body);
      const result = await services.loyalty.recordTransaction(
        dinerId, 
        restaurantId, 
        Number(amountSpent)
      );
      res.json(result);
    } catch (error: any) {
      console.error("Transaction error:", error);
      res.status(400).json({ error: error.message || "Invalid transaction data" });
    }
  });
  
  // DINER POINTS - Get all points balances for a diner
  app.get("/api/diners/:dinerId/points", async (req, res) => {
    try {
      const { dinerId } = req.params;
      const balances = await services.loyalty.getBalancesForDiner(dinerId);
      res.json(balances);
    } catch (error) {
      console.error("Get points error:", error);
      res.status(500).json({ error: "Failed to fetch points" });
    }
  });
  
  // DINER VOUCHERS - Get all vouchers for a diner
  app.get("/api/diners/:dinerId/vouchers", async (req, res) => {
    try {
      const { dinerId } = req.params;
      const vouchers = await services.voucher.getDinerVouchers(dinerId);
      res.json(vouchers);
    } catch (error) {
      console.error("Get vouchers error:", error);
      res.status(500).json({ error: "Failed to fetch vouchers" });
    }
  });
  
  // DINER SELECT VOUCHER - Select a voucher to present to restaurant
  app.post("/api/diners/:dinerId/vouchers/:voucherId/select", async (req, res) => {
    try {
      const { dinerId, voucherId } = req.params;
      const result = await services.voucher.selectVoucherForPresentation(dinerId, voucherId);
      res.json(result);
    } catch (error: any) {
      console.error("Select voucher error:", error);
      res.status(400).json({ error: error.message || "Failed to select voucher" });
    }
  });

  // RESTAURANT REDEEM VOUCHER - Restaurant redeems voucher by code
  app.post("/api/restaurants/:restaurantId/vouchers/redeem", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { code, billId } = req.body;
      const result = await services.voucher.redeemVoucherByCode(restaurantId, code, billId);
      res.json(result);
    } catch (error: any) {
      console.error("Restaurant redeem voucher error:", error);
      res.status(400).json({ error: error.message || "Failed to redeem voucher" });
    }
  });
  
  // RESTAURANTS - Get all restaurants
  app.get("/api/restaurants", async (req, res) => {
    try {
      const allRestaurants = await storage.getAllRestaurants();
      res.json(allRestaurants);
    } catch (error) {
      console.error("Get restaurants error:", error);
      res.status(500).json({ error: "Failed to fetch restaurants" });
    }
  });

  // RESTAURANT - Get a single restaurant
  app.get("/api/restaurants/:restaurantId", async (req, res) => {
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

  // RESTAURANT SETTINGS - Update restaurant configuration
  app.patch("/api/restaurants/:restaurantId/settings", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const settings = req.body;
      const updatedRestaurant = await services.config.updateRestaurantSettings(restaurantId, settings);
      res.json(updatedRestaurant);
    } catch (error: any) {
      console.error("Update restaurant settings error:", error);
      res.status(400).json({ error: error.message || "Failed to update settings" });
    }
  });
  
  // RESTAURANT STATS - Get restaurant dashboard statistics
  app.get("/api/restaurants/:restaurantId/stats", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const stats = await services.stats.getRestaurantStats(restaurantId);
      res.json(stats);
    } catch (error) {
      console.error("Get restaurant stats error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant stats" });
    }
  });

  // RESTAURANT RECORD TRANSACTION - Record transaction by phone lookup
  app.post("/api/restaurants/:restaurantId/transactions/record", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      // Validate input with Zod
      const parseResult = recordTransactionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }
      
      const { phone, billId, amountSpent } = parseResult.data;
      
      // Look up diner by phone
      const diner = await storage.getUserByPhone(phone);
      if (!diner) {
        return res.status(404).json({ error: "No customer found with that phone number" });
      }
      
      if (diner.userType !== 'diner') {
        return res.status(400).json({ error: "Phone number is not registered as a diner" });
      }
      
      // Record the transaction
      const result = await services.loyalty.recordTransaction(
        diner.id,
        restaurantId,
        amountSpent,
        billId || undefined
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

  // RECONCILIATION - Upload CSV for bill matching
  app.post("/api/restaurants/:restaurantId/reconciliation/upload", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { fileName, csvContent } = req.body;
      
      if (!fileName || !csvContent) {
        return res.status(400).json({ error: "fileName and csvContent are required" });
      }
      
      const result = await services.reconciliation.processCSV(restaurantId, fileName, csvContent);
      res.json(result);
    } catch (error: any) {
      console.error("Reconciliation upload error:", error);
      res.status(400).json({ error: error.message || "Failed to process CSV" });
    }
  });

  // RECONCILIATION - Get all batches for a restaurant
  app.get("/api/restaurants/:restaurantId/reconciliation/batches", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const batches = await services.reconciliation.getBatches(restaurantId);
      res.json(batches);
    } catch (error) {
      console.error("Get reconciliation batches error:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation batches" });
    }
  });

  // RECONCILIATION - Get batch details
  app.get("/api/restaurants/:restaurantId/reconciliation/batches/:batchId", async (req, res) => {
    try {
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

  return httpServer;
}
