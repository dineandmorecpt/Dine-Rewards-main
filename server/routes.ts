import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createLoyaltyServices } from "./services/loyalty";
import { sendRegistrationInvite } from "./services/sms";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

  // AUTH - Login endpoint
  const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { email, password } = parseResult.data;

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check password (support both hashed and plain text for migration)
      let passwordValid = false;
      if (user.password.startsWith('$2')) {
        // Bcrypt hashed password
        passwordValid = await bcrypt.compare(password, user.password);
      } else {
        // Plain text password (legacy)
        passwordValid = user.password === password;
      }

      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Get restaurant and portal role if admin
      let restaurant = null;
      let portalRole = null;
      
      if (user.userType === 'restaurant_admin') {
        const ownedRestaurants = await storage.getRestaurantsByAdmin(user.id);
        
        if (ownedRestaurants.length > 0) {
          restaurant = ownedRestaurants[0];
          portalRole = 'owner';
        } else {
          const allRestaurants = await storage.getAllRestaurants();
          for (const r of allRestaurants) {
            const portalAccess = await storage.getPortalUserByUserAndRestaurant(user.id, r.id);
            if (portalAccess) {
              restaurant = r;
              portalRole = portalAccess.role;
              break;
            }
          }
        }
      }

      // Set session
      req.session.userId = user.id;
      req.session.userType = user.userType;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Login failed" });
        }
        
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            lastName: user.lastName,
            phone: user.phone,
            userType: user.userType,
          },
          restaurant: restaurant ? {
            id: restaurant.id,
            name: restaurant.name,
          } : null,
          portalRole,
        });
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // AUTH - Get current user (for session check)
  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.json({ user: null, restaurant: null, portalRole: null });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ user: null, restaurant: null, portalRole: null });
      }

      let restaurant = null;
      let portalRole = null; // 'owner' | 'manager' | 'staff' | null
      
      if (user.userType === 'restaurant_admin') {
        // Check if user owns any restaurants
        const ownedRestaurants = await storage.getRestaurantsByAdmin(user.id);
        
        if (ownedRestaurants.length > 0) {
          restaurant = ownedRestaurants[0];
          portalRole = 'owner'; // Restaurant owner has full permissions
        } else {
          // Check if user has portal access to any restaurant
          const allRestaurants = await storage.getAllRestaurants();
          for (const r of allRestaurants) {
            const portalAccess = await storage.getPortalUserByUserAndRestaurant(user.id, r.id);
            if (portalAccess) {
              restaurant = r;
              portalRole = portalAccess.role; // 'manager' or 'staff'
              break;
            }
          }
        }
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
        },
        restaurant: restaurant ? {
          id: restaurant.id,
          name: restaurant.name,
        } : null,
        portalRole, // 'owner' | 'manager' | 'staff' | null
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.json({ user: null, restaurant: null, portalRole: null });
    }
  });

  // AUTH - Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // AUTH - Register diner (self-registration)
  const selfRegisterDinerSchema = z.object({
    name: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Surname is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
      .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  app.post("/api/auth/register-diner", async (req, res) => {
    try {
      const parseResult = selfRegisterDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { name, lastName, email, phone, password } = parseResult.data;

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      // Check if phone already exists
      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ error: "An account with this phone number already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        name,
        lastName,
        email,
        phone,
        password: hashedPassword,
        userType: 'diner',
      });

      // Set session
      req.session.userId = user.id;
      req.session.userType = user.userType;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Registration failed" });
        }
        
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            lastName: user.lastName,
            phone: user.phone,
            userType: user.userType,
          },
        });
      });
    } catch (error: any) {
      console.error("Register diner error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // AUTH - Login with access token (for diners with valid token)
  const tokenLoginSchema = z.object({
    accessToken: z.string().min(1, "Access token is required"),
  });

  app.post("/api/auth/login-token", async (req, res) => {
    try {
      const parseResult = tokenLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { accessToken } = parseResult.data;

      // Find user by access token
      const user = await storage.getUserByAccessToken(accessToken);
      if (!user) {
        return res.status(401).json({ error: "Invalid or expired access token" });
      }

      // Check if token is expired
      if (user.accessTokenExpiresAt && new Date(user.accessTokenExpiresAt) < new Date()) {
        return res.status(401).json({ error: "Access token has expired. Please login with OTP." });
      }

      // Set session
      req.session.userId = user.id;
      req.session.userType = user.userType;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
        },
      });
    } catch (error: any) {
      console.error("Token login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // AUTH - Check if phone has valid access token and auto-login
  const checkTokenLoginSchema = z.object({
    phone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  });

  app.post("/api/auth/check-token", async (req, res) => {
    try {
      const parseResult = checkTokenLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { phone } = parseResult.data;

      // Find user by phone
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.json({ hasValidToken: false, requiresOtp: true });
      }

      if (user.userType !== 'diner') {
        return res.json({ hasValidToken: false, requiresOtp: true });
      }

      // Check if user has a valid (non-expired) access token
      if (user.accessToken && user.accessTokenExpiresAt && new Date(user.accessTokenExpiresAt) > new Date()) {
        // Auto-login: set session
        req.session.userId = user.id;
        req.session.userType = user.userType;

        // Explicitly save session before responding
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Login failed" });
          }
          return res.json({
            hasValidToken: true,
            requiresOtp: false,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              lastName: user.lastName,
              phone: user.phone,
              userType: user.userType,
            },
          });
        });
        return;
      }

      // No valid token, requires OTP
      return res.json({ hasValidToken: false, requiresOtp: true });
    } catch (error: any) {
      console.error("Check token error:", error);
      res.status(500).json({ error: "Check failed" });
    }
  });

  // OTP Storage (in-memory with expiry)
  const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

  // AUTH - Request OTP for diner login
  const requestOtpSchema = z.object({
    phone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
      .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  });

  app.post("/api/auth/request-otp", async (req, res) => {
    try {
      const parseResult = requestOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { phone } = parseResult.data;

      // Check if user exists with this phone
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ error: "No account found with this phone number" });
      }

      if (user.userType !== 'diner') {
        return res.status(400).json({ error: "This phone number is not registered as a diner" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP with 5-minute expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      otpStore.set(phone, { otp, expiresAt });

      // Send OTP via SMS
      const { sendSMS } = await import("./services/sms");
      const smsResult = await sendSMS(phone, `Your Dine&More login code is: ${otp}. Valid for 5 minutes.`);

      res.json({
        success: true,
        smsSent: smsResult.success,
        smsError: smsResult.error,
        message: smsResult.success 
          ? "OTP sent to your phone" 
          : "Could not send SMS. Please try again.",
      });
    } catch (error: any) {
      console.error("Request OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // AUTH - Verify OTP and login diner
  const verifyOtpSchema = z.object({
    phone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
    otp: z.string().length(6, "OTP must be 6 digits"),
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const parseResult = verifyOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone, otp } = parseResult.data;

      // Check stored OTP
      const storedOtp = otpStore.get(phone);
      if (!storedOtp) {
        return res.status(400).json({ error: "No OTP found. Please request a new one." });
      }

      if (new Date() > storedOtp.expiresAt) {
        otpStore.delete(phone);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }

      if (storedOtp.otp !== otp) {
        return res.status(401).json({ error: "Invalid OTP" });
      }

      // OTP is valid - clear it
      otpStore.delete(phone);

      // Get user and create session
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.userType = user.userType;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
        },
      });
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Login failed" });
    }
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
  
  // DINER TRANSACTION HISTORY - Get transactions for a diner at a specific restaurant
  app.get("/api/diners/:dinerId/restaurants/:restaurantId/transactions", async (req, res) => {
    try {
      const { dinerId, restaurantId } = req.params;
      const transactions = await storage.getTransactionsByDinerAndRestaurant(dinerId, restaurantId);
      res.json(transactions);
    } catch (error) {
      console.error("Get transaction history error:", error);
      res.status(500).json({ error: "Failed to fetch transaction history" });
    }
  });

  // USER PROFILE - Update user profile
  const updateProfileSchema = z.object({
    name: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
  });

  app.patch("/api/users/:userId/profile", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Ensure user is updating their own profile
      if (req.session.userId !== userId) {
        return res.status(403).json({ error: "You can only update your own profile" });
      }
      
      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }
      
      const { name, lastName, email, phone } = parseResult.data;
      
      // Check if email is being changed and if it's already taken
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (email !== currentUser.email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ error: "This email is already in use" });
        }
      }
      
      // Check if phone is being changed and if it's already taken
      if (phone && phone !== currentUser.phone) {
        const existingPhone = await storage.getUserByPhone(phone);
        if (existingPhone) {
          return res.status(400).json({ error: "This phone number is already in use" });
        }
      }
      
      const updatedUser = await storage.updateUserProfile(userId, { 
        name, 
        lastName: lastName || undefined, 
        email, 
        phone: phone || undefined 
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

  // DINER ALL TRANSACTIONS - Get all transactions for a diner with restaurant info
  app.get("/api/diners/:dinerId/transactions", async (req, res) => {
    try {
      const { dinerId } = req.params;
      const allTransactions = await storage.getTransactionsByDiner(dinerId);
      
      // Get all restaurants to map names
      const allRestaurants = await storage.getAllRestaurants();
      const restaurantMap = new Map(allRestaurants.map(r => [r.id, r.name]));
      
      // Add restaurant name to each transaction
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
      
      // Log activity
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId || null,
        action: 'voucher_redeemed',
        targetType: 'voucher',
        targetId: result.voucher?.id || code,
        details: JSON.stringify({ code, billId, dinerId: result.voucher?.dinerId }),
      });
      
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
      
      // Log activity
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

  // VOUCHER TYPES - Get all voucher types for a restaurant (admin)
  app.get("/api/restaurants/:restaurantId/voucher-types", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const voucherTypes = await storage.getVoucherTypesByRestaurant(restaurantId);
      res.json(voucherTypes);
    } catch (error) {
      console.error("Get voucher types error:", error);
      res.status(500).json({ error: "Failed to fetch voucher types" });
    }
  });

  // VOUCHER TYPES - Get active voucher types for diners to choose from
  app.get("/api/restaurants/:restaurantId/voucher-types/active", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const voucherTypes = await storage.getActiveVoucherTypesByRestaurant(restaurantId);
      res.json(voucherTypes);
    } catch (error) {
      console.error("Get active voucher types error:", error);
      res.status(500).json({ error: "Failed to fetch voucher types" });
    }
  });

  // VOUCHER TYPES - Create new voucher type (owner/manager only)
  const createVoucherTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    rewardDetails: z.string().optional(),
    creditsCost: z.number().int().min(1).default(1),
    validityDays: z.number().int().min(1).default(30),
    isActive: z.boolean().default(true),
  });

  app.post("/api/restaurants/:restaurantId/voucher-types", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'admin') {
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

      const voucherType = await storage.createVoucherType({
        restaurantId,
        ...parseResult.data,
      });

      // Log activity
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

  // VOUCHER TYPES - Update voucher type (owner/manager only)
  app.patch("/api/restaurants/:restaurantId/voucher-types/:voucherTypeId", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'admin') {
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
      
      // Log activity
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

  // VOUCHER TYPES - Delete voucher type (owner/manager only)
  app.delete("/api/restaurants/:restaurantId/voucher-types/:voucherTypeId", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== 'admin') {
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

      // Get voucher type details before deleting for logging
      const voucherType = await storage.getVoucherType(voucherTypeId);

      await storage.deleteVoucherType(voucherTypeId);
      
      // Log activity
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

  // DINER REDEEM VOUCHER CREDIT - Diner selects a voucher type to redeem their credit
  const redeemVoucherCreditSchema = z.object({
    voucherTypeId: z.string().min(1, "Voucher type is required"),
  });

  app.post("/api/diners/:dinerId/restaurants/:restaurantId/redeem-credit", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { dinerId, restaurantId } = req.params;

      if (req.session.userId !== dinerId) {
        return res.status(403).json({ error: "You can only redeem your own credits" });
      }

      const parseResult = redeemVoucherCreditSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { voucherTypeId } = parseResult.data;
      const result = await services.loyalty.redeemVoucherCredit(dinerId, restaurantId, voucherTypeId);
      res.json(result);
    } catch (error: any) {
      console.error("Redeem voucher credit error:", error);
      res.status(400).json({ error: error.message || "Failed to redeem voucher credit" });
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

  // RECONCILIATION - Upload CSV for bill matching (owner/manager only, staff cannot upload)
  app.post("/api/restaurants/:restaurantId/reconciliation/upload", async (req, res) => {
    try {
      // Require authenticated admin
      if (!req.session.userId || req.session.userType !== 'admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      // Check user's role for this restaurant
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      // Staff cannot upload reconciliation files - only owner/manager
      if (!isOwner && (!portalAccess || portalAccess.role === 'staff')) {
        return res.status(403).json({ error: "You don't have permission to upload reconciliation files" });
      }

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

  // PORTAL USERS - Get all portal users for a restaurant
  app.get("/api/restaurants/:restaurantId/portal-users", async (req, res) => {
    try {
      // Require authenticated admin
      if (!req.session.userId || req.session.userType !== 'admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      // Verify user has access to this restaurant (owner or portal user)
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant" });
      }

      const portalUsers = await storage.getPortalUsersByRestaurant(restaurantId);
      res.json(portalUsers);
    } catch (error) {
      console.error("Get portal users error:", error);
      res.status(500).json({ error: "Failed to fetch portal users" });
    }
  });

  // PORTAL USERS - Add a new portal user
  const addPortalUserSchema = z.object({
    email: z.string().email("Invalid email address"),
    name: z.string().min(1, "Name is required"),
    role: z.enum(["manager", "staff"]).default("staff"),
  });

  app.post("/api/restaurants/:restaurantId/portal-users", async (req, res) => {
    try {
      // Require authenticated admin
      if (!req.session.userId || req.session.userType !== 'admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      // Verify user is owner of this restaurant (only owners can add portal users)
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      if (restaurant.adminUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only restaurant owners can add portal users" });
      }

      const parseResult = addPortalUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { email, name, role } = parseResult.data;

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Create new admin user with random password
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        user = await storage.createUser({
          email,
          name,
          password: hashedPassword,
          userType: 'admin',
        });
      }

      // Check if already a portal user for this restaurant
      const existingPortalUser = await storage.getPortalUserByUserAndRestaurant(user.id, restaurantId);
      if (existingPortalUser) {
        return res.status(400).json({ error: "This user already has access to this restaurant" });
      }

      // Add as portal user
      const portalUser = await storage.addPortalUser({
        restaurantId,
        userId: user.id,
        role,
        addedBy: req.session.userId || null,
      });

      // Log activity
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'portal_user_added',
        targetType: 'portal_user',
        targetId: portalUser.id,
        details: JSON.stringify({ email, name, role }),
      });

      res.json({
        success: true,
        portalUser: {
          ...portalUser,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        }
      });
    } catch (error: any) {
      console.error("Add portal user error:", error);
      res.status(500).json({ error: error.message || "Failed to add user" });
    }
  });

  // PORTAL USERS - Remove a portal user
  app.delete("/api/restaurants/:restaurantId/portal-users/:portalUserId", async (req, res) => {
    try {
      // Require authenticated admin
      if (!req.session.userId || req.session.userType !== 'admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId, portalUserId } = req.params;
      
      // Verify user is owner of this restaurant (only owners can remove portal users)
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      if (restaurant.adminUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only restaurant owners can remove portal users" });
      }

      await storage.removePortalUser(portalUserId);
      
      // Log activity
      await storage.createActivityLog({
        restaurantId,
        userId: req.session.userId,
        action: 'portal_user_removed',
        targetType: 'portal_user',
        targetId: portalUserId,
        details: null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Remove portal user error:", error);
      res.status(500).json({ error: "Failed to remove user" });
    }
  });

  // DINER REGISTRATIONS STATS - Get diner registrations by date range for charts
  app.get("/api/restaurants/:restaurantId/diner-registrations", async (req, res) => {
    try {
      // Require authenticated admin
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      // Verify user has access to this restaurant
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant's stats" });
      }
      
      // Parse date range - defaults to last 30 days
      // Expects YYYY-MM-DD format to avoid timezone issues
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
      
      const data = await storage.getDinerRegistrationsByDateRange(restaurantId, startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error("Get diner registrations error:", error);
      res.status(500).json({ error: "Failed to fetch diner registrations" });
    }
  });

  // VOUCHER REDEMPTIONS BY TYPE - Get voucher redemptions grouped by voucher type
  app.get("/api/restaurants/:restaurantId/voucher-redemptions-by-type", async (req, res) => {
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
        return res.status(403).json({ error: "You don't have access to this restaurant's stats" });
      }
      
      // Parse date range - expects YYYY-MM-DD format
      const parseDate = (str: string | undefined): Date | undefined => {
        if (!str) return undefined;
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return undefined;
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      };
      
      const startDate = parseDate(req.query.start as string);
      const endDate = parseDate(req.query.end as string);
      
      const data = await storage.getVoucherRedemptionsByType(restaurantId, startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error("Get voucher redemptions by type error:", error);
      res.status(500).json({ error: "Failed to fetch voucher redemptions" });
    }
  });

  // ACTIVITY LOGS - Get activity logs for a restaurant (authenticated admin only)
  app.get("/api/restaurants/:restaurantId/activity-logs", async (req, res) => {
    try {
      // Require authenticated admin
      if (!req.session.userId || req.session.userType !== 'restaurant_admin') {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      // Verify user has access to this restaurant
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

  return httpServer;
}
