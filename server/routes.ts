import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createLoyaltyServices } from "./services/loyalty";
import { sendRegistrationInvite } from "./services/sms";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

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
  
  // SHORT REGISTRATION REDIRECT - /r/:token redirects to /register?token=...
  app.get("/r/:token", (req, res) => {
    const { token } = req.params;
    res.redirect(`/register?token=${token}`);
  });

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

  // DINER INVITATION - Create invitation and optionally send SMS
  const inviteDinerSchema = z.object({
    phone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
      .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  });

  app.post("/api/restaurants/:restaurantId/diners/invite", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      // Validate input
      const parseResult = inviteDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }
      
      const { phone } = parseResult.data;
      
      // Check if restaurant exists
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      // Check if user already exists with this phone
      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ error: "A customer with this phone number is already registered" });
      }
      
      // Generate unique token (shorter, URL-friendly format)
      const token = crypto.randomBytes(8).toString('base64url');
      
      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // Create invitation
      const invitation = await storage.createDinerInvitation({
        restaurantId,
        phone,
        token,
        status: "pending",
        expiresAt,
      });
      
      // Generate full registration link (short format for SMS)
      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'https';
      const fullRegistrationLink = `${protocol}://${host}/r/${token}`;
      const registrationLink = `/r/${token}`;
      
      // Send SMS with registration link
      let smsSent = false;
      let smsError: string | undefined;
      
      try {
        const smsResult = await sendRegistrationInvite(phone, restaurant.name, fullRegistrationLink);
        smsSent = smsResult.success;
        smsError = smsResult.error;
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

  // INVITATION VALIDATION - Get invitation by token
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getDinerInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invalid invitation link" });
      }
      
      // Check if expired
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ error: "This invitation link has expired" });
      }
      
      // Check if already used
      if (invitation.status === 'registered') {
        return res.status(400).json({ error: "This invitation has already been used" });
      }
      
      // Get restaurant details
      const restaurant = await storage.getRestaurant(invitation.restaurantId);
      
      res.json({
        valid: true,
        phone: invitation.phone,
        restaurantId: invitation.restaurantId,
        restaurantName: restaurant?.name || "Restaurant",
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });

  // DINER REGISTRATION - Register from invitation
  const registerDinerSchema = z.object({
    token: z.string().min(1, "Token is required"),
    email: z.string().email("Invalid email address"),
    name: z.string().min(1, "Name is required"),
    lastName: z.string().min(1, "Surname is required"),
    termsAccepted: z.boolean().refine(val => val === true, { message: "You must accept the Terms & Conditions" }),
    privacyAccepted: z.boolean().refine(val => val === true, { message: "You must accept the Privacy Policy" }),
  });

  app.post("/api/diners/register", async (req, res) => {
    try {
      // Validate input
      const parseResult = registerDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }
      
      const { token, email, name, lastName, termsAccepted, privacyAccepted } = parseResult.data;
      
      // Get and validate invitation
      const invitation = await storage.getDinerInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invalid invitation link" });
      }
      
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ error: "This invitation link has expired" });
      }
      
      if (invitation.status === 'registered') {
        return res.status(400).json({ error: "This invitation has already been used" });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }
      
      // Check if phone already exists (shouldn't happen but double-check)
      const existingPhone = await storage.getUserByPhone(invitation.phone);
      if (existingPhone) {
        return res.status(400).json({ error: "This phone number is already registered" });
      }
      
      const now = new Date();
      
      // Create the diner user
      const user = await storage.createUser({
        email,
        password: crypto.randomBytes(16).toString('hex'), // Random password (they'll use phone/token to login)
        name,
        lastName,
        phone: invitation.phone,
        userType: 'diner',
        termsAcceptedAt: termsAccepted ? now : null,
        privacyAcceptedAt: privacyAccepted ? now : null,
      });
      
      // Update invitation status
      await storage.updateDinerInvitation(invitation.id, {
        status: 'registered',
        dinerId: user.id,
        consumedAt: now,
      });
      
      // Create initial points balance for the restaurant
      await storage.createPointsBalance({
        dinerId: user.id,
        restaurantId: invitation.restaurantId,
        currentPoints: 0,
        totalPointsEarned: 0,
        totalVouchersGenerated: 0,
      });
      
      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        },
        message: "Registration successful! Welcome to the rewards program."
      });
    } catch (error: any) {
      console.error("Register diner error:", error);
      res.status(500).json({ error: error.message || "Failed to complete registration" });
    }
  });

  // GET RESTAURANT INVITATIONS - List all invitations for a restaurant
  app.get("/api/restaurants/:restaurantId/invitations", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const invitations = await storage.getDinerInvitationsByRestaurant(restaurantId);
      res.json(invitations);
    } catch (error) {
      console.error("Get restaurant invitations error:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  return httpServer;
}
