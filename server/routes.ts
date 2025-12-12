import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // POINTS CALCULATION ENGINE
  // POST /api/transactions - Record a transaction and auto-calculate points
  app.post("/api/transactions", async (req, res) => {
    try {
      const { dinerId, restaurantId, amountSpent } = insertTransactionSchema.parse(req.body);
      
      // Rule 1: Every R1 spent = 1 point
      const pointsEarned = Math.floor(Number(amountSpent));
      
      // Create transaction record
      const transaction = await storage.createTransaction({
        dinerId,
        restaurantId,
        amountSpent: amountSpent.toString(),
        pointsEarned
      });
      
      // Get or create points balance
      let balance = await storage.getPointsBalance(dinerId, restaurantId);
      if (!balance) {
        balance = await storage.createPointsBalance({
          dinerId,
          restaurantId,
          currentPoints: 0,
          totalPointsEarned: 0,
          totalVouchersGenerated: 0
        });
      }
      
      // Calculate new points (Rule 5: Points do not fall away, but accumulate)
      let newCurrentPoints = balance.currentPoints + pointsEarned;
      const newTotalPointsEarned = balance.totalPointsEarned + pointsEarned;
      let newVouchersGenerated = balance.totalVouchersGenerated;
      
      const vouchersToGenerate = [];
      
      // Rule 2 & 4: Every 1000 points generates a voucher, then count resets
      while (newCurrentPoints >= 1000) {
        newCurrentPoints -= 1000;
        newVouchersGenerated += 1;
        
        // Get restaurant info to determine voucher value
        const restaurant = await storage.getRestaurant(restaurantId);
        if (restaurant) {
          // Generate voucher code
          const voucherCode = `${restaurant.name.substring(0, 4).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;
          
          // Calculate expiry date
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + restaurant.voucherValidityDays);
          
          // Create voucher
          const voucher = await storage.createVoucher({
            dinerId,
            restaurantId,
            title: restaurant.voucherValue,
            code: voucherCode,
            expiryDate,
            isRedeemed: false,
            redeemedAt: null
          });
          
          vouchersToGenerate.push(voucher);
        }
      }
      
      // Update points balance
      const updatedBalance = await storage.updatePointsBalance(
        balance.id,
        newCurrentPoints,
        newTotalPointsEarned,
        newVouchersGenerated
      );
      
      res.json({
        transaction,
        balance: updatedBalance,
        vouchersGenerated: vouchersToGenerate
      });
    } catch (error) {
      console.error("Transaction error:", error);
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });
  
  // GET /api/diners/:dinerId/points - Get all points balances for a diner
  app.get("/api/diners/:dinerId/points", async (req, res) => {
    try {
      const { dinerId } = req.params;
      const balances = await storage.getPointsBalancesByDiner(dinerId);
      
      // Enrich with restaurant data
      const enrichedBalances = await Promise.all(
        balances.map(async (balance) => {
          const restaurant = await storage.getRestaurant(balance.restaurantId);
          return {
            ...balance,
            restaurantName: restaurant?.name || "Unknown",
            restaurantColor: restaurant?.color || "bg-primary"
          };
        })
      );
      
      res.json(enrichedBalances);
    } catch (error) {
      console.error("Get points error:", error);
      res.status(500).json({ error: "Failed to fetch points" });
    }
  });
  
  // GET /api/diners/:dinerId/vouchers - Get all vouchers for a diner
  app.get("/api/diners/:dinerId/vouchers", async (req, res) => {
    try {
      const { dinerId } = req.params;
      const dinerVouchers = await storage.getVouchersByDiner(dinerId);
      
      // Enrich with restaurant data
      const enrichedVouchers = await Promise.all(
        dinerVouchers.map(async (voucher) => {
          const restaurant = await storage.getRestaurant(voucher.restaurantId);
          return {
            ...voucher,
            restaurantName: restaurant?.name || "Unknown"
          };
        })
      );
      
      res.json(enrichedVouchers);
    } catch (error) {
      console.error("Get vouchers error:", error);
      res.status(500).json({ error: "Failed to fetch vouchers" });
    }
  });
  
  // POST /api/vouchers/:voucherId/redeem - Redeem a voucher (Rule 3: Only redeemable once)
  app.post("/api/vouchers/:voucherId/redeem", async (req, res) => {
    try {
      const { voucherId } = req.params;
      const redeemedVoucher = await storage.redeemVoucher(voucherId);
      res.json(redeemedVoucher);
    } catch (error) {
      console.error("Redeem voucher error:", error);
      res.status(400).json({ error: "Failed to redeem voucher" });
    }
  });
  
  // GET /api/restaurants - Get all restaurants
  app.get("/api/restaurants", async (req, res) => {
    try {
      const allRestaurants = await storage.getAllRestaurants();
      res.json(allRestaurants);
    } catch (error) {
      console.error("Get restaurants error:", error);
      res.status(500).json({ error: "Failed to fetch restaurants" });
    }
  });
  
  // GET /api/restaurants/:restaurantId/stats - Get restaurant dashboard stats
  app.get("/api/restaurants/:restaurantId/stats", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      // Get transactions from last 30 days
      const recentTransactions = await storage.getTransactionsByRestaurant(restaurantId, true);
      
      // Count unique diners in last 30 days
      const uniqueDiners = new Set(recentTransactions.map(t => t.dinerId)).size;
      
      // Calculate total spent
      const totalSpent = recentTransactions.reduce((sum, t) => sum + Number(t.amountSpent), 0);
      
      // Get vouchers for this restaurant
      const restaurantVouchers = await storage.getVouchersByRestaurant(restaurantId);
      const redeemedCount = restaurantVouchers.filter(v => v.isRedeemed).length;
      
      res.json({
        dinersLast30Days: uniqueDiners,
        totalSpent,
        vouchersRedeemed: redeemedCount,
        transactions: recentTransactions
      });
    } catch (error) {
      console.error("Get restaurant stats error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant stats" });
    }
  });

  return httpServer;
}
