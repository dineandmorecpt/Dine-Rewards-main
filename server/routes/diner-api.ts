import { Router } from "express";
import { storage } from "../storage";
import { createLoyaltyServices } from "../services/loyalty";
import { sendPhoneChangeOTP } from "../services/sms";
import { checkSMSRateLimit, recordSMSSent } from "../services/smsRateLimiter";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { getAuthUserId, getAuthUserType } from "./auth";

const smsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many SMS requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const services = createLoyaltyServices(storage);

const updateProfileSchema = z.object({
  name: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address"),
});

const phoneChangeRequestSchema = z.object({
  newPhone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 10, { message: "Phone number must be at least 10 digits" })
});

const phoneChangeVerifySchema = z.object({
  otp: z.string().length(6, "Verification code must be 6 digits")
});

const redeemVoucherCreditSchema = z.object({
  voucherTypeId: z.string().min(1, "Voucher type is required"),
  branchId: z.string().optional(),
});

function requireDinerAuth(req: any, res: any): string | null {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  
  const userType = getAuthUserType(req);
  if (userType !== 'diner') {
    res.status(403).json({ error: "Forbidden: Diner access required" });
    return null;
  }
  
  return userId;
}

export function registerDinerApiRoutes(router: Router): void {
  router.get("/api/diner/points", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const balances = await services.loyalty.getBalancesForDiner(dinerId);
      res.json(balances);
    } catch (error) {
      console.error("Get points error:", error);
      res.status(500).json({ error: "Failed to fetch points" });
    }
  });

  router.get("/api/diner/transactions", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const allTransactions = await storage.getTransactionsByDiner(dinerId);
      
      const allRestaurants = await storage.getAllRestaurants();
      const restaurantMap = new Map(allRestaurants.map(r => [r.id, r.name]));
      
      const transactionsWithRestaurant = allTransactions.map(tx => ({
        ...tx,
        restaurantName: restaurantMap.get(tx.restaurantId) || 'Unknown Restaurant'
      }));
      
      res.json(transactionsWithRestaurant);
    } catch (error) {
      console.error("Get all transactions error:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  router.get("/api/diner/restaurants/:restaurantId/transactions", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const { restaurantId } = req.params;
      const transactions = await storage.getTransactionsByDinerAndRestaurant(dinerId, restaurantId);
      res.json(transactions);
    } catch (error) {
      console.error("Get transaction history error:", error);
      res.status(500).json({ error: "Failed to fetch transaction history" });
    }
  });

  router.get("/api/diner/vouchers", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const vouchers = await services.voucher.getDinerVouchers(dinerId);
      res.json(vouchers);
    } catch (error) {
      console.error("Get vouchers error:", error);
      res.status(500).json({ error: "Failed to fetch vouchers" });
    }
  });

  router.post("/api/diner/vouchers/:voucherId/select", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const { voucherId } = req.params;
      const result = await services.voucher.selectVoucherForPresentation(dinerId, voucherId);
      res.json(result);
    } catch (error: any) {
      console.error("Select voucher error:", error);
      res.status(400).json({ error: error.message || "Failed to select voucher" });
    }
  });

  router.post("/api/diner/restaurants/:restaurantId/redeem-credit", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const { restaurantId } = req.params;

      const parseResult = redeemVoucherCreditSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { voucherTypeId, branchId } = parseResult.data;
      const result = await services.loyalty.redeemVoucherCredit(dinerId, restaurantId, voucherTypeId, branchId);
      res.json(result);
    } catch (error: any) {
      console.error("Redeem voucher credit error:", error);
      res.status(400).json({ error: error.message || "Failed to redeem voucher credit" });
    }
  });

  router.patch("/api/diner/profile", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }
      
      const { name, lastName, email } = parseResult.data;
      
      const currentUser = await storage.getUser(dinerId);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (email !== currentUser.email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ error: "This email is already in use" });
        }
      }
      
      const updatedUser = await storage.updateUserProfile(dinerId, { 
        name, 
        lastName: lastName || undefined, 
        email
      });
      
      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
          userType: updatedUser.userType,
        },
      });
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  router.post("/api/diner/phone-change/request", smsRateLimiter, async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const parseResult = phoneChangeRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { newPhone } = parseResult.data;

      const existingUser = await storage.getUserByPhone(newPhone);
      if (existingUser && existingUser.id !== dinerId) {
        return res.status(400).json({ error: "This phone number is already registered to another account" });
      }

      const smsLimitCheck = checkSMSRateLimit(newPhone);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storage.createPhoneChangeRequest({
        userId: dinerId,
        newPhone,
        otpHash,
        expiresAt
      });

      const smsResult = await sendPhoneChangeOTP(newPhone, otp);
      if (!smsResult.success) {
        console.error("Failed to send phone change OTP:", smsResult.error);
        return res.status(500).json({ error: "Failed to send verification code. Please try again." });
      }
      
      recordSMSSent(newPhone);

      res.json({ 
        success: true, 
        message: "Verification code sent to your new phone number",
        expiresAt: expiresAt.toISOString()
      });
    } catch (error: any) {
      console.error("Phone change request error:", error);
      res.status(500).json({ error: "Failed to initiate phone change" });
    }
  });

  router.post("/api/diner/phone-change/verify", async (req, res) => {
    try {
      const dinerId = requireDinerAuth(req, res);
      if (!dinerId) return;

      const parseResult = phoneChangeVerifySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid verification code" 
        });
      }

      const { otp } = parseResult.data;

      const request = await storage.getActivePhoneChangeRequest(dinerId);
      if (!request) {
        return res.status(400).json({ error: "No pending phone change request found. Please request a new code." });
      }

      if (new Date() > request.expiresAt) {
        await storage.expirePhoneChangeRequest(request.id);
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      if (request.attempts >= 5) {
        await storage.expirePhoneChangeRequest(request.id);
        return res.status(400).json({ error: "Too many failed attempts. Please request a new code." });
      }

      const isValid = await bcrypt.compare(otp, request.otpHash);
      if (!isValid) {
        await storage.incrementPhoneChangeAttempts(request.id);
        const remainingAttempts = 5 - (request.attempts + 1);
        return res.status(400).json({ 
          error: `Incorrect verification code. ${remainingAttempts} attempts remaining.` 
        });
      }

      const existingUser = await storage.getUserByPhone(request.newPhone);
      if (existingUser && existingUser.id !== dinerId) {
        await storage.expirePhoneChangeRequest(request.id);
        return res.status(400).json({ error: "This phone number is already registered to another account" });
      }

      await storage.markPhoneChangeVerified(request.id);
      const updatedUser = await storage.updateUserPhone(dinerId, request.newPhone);

      res.json({ 
        success: true, 
        message: "Phone number updated successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
          userType: updatedUser.userType,
        }
      });
    } catch (error: any) {
      console.error("Phone change verify error:", error);
      res.status(500).json({ error: "Failed to verify phone change" });
    }
  });
}
