import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createLoyaltyServices } from "./services/loyalty";
import { insertTransactionSchema } from "@shared/schema";

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
      const { code } = req.body;
      const result = await services.voucher.redeemVoucherByCode(restaurantId, code);
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

  return httpServer;
}
