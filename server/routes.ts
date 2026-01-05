import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createLoyaltyServices } from "./services/loyalty";
import { sendRegistrationInvite, sendPhoneChangeOTP, sendSMS } from "./services/sms";
import { sendPasswordResetEmail, sendAccountDeletionConfirmationEmail } from "./services/email";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";

const authRateLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 100, // 100 requests per second
  message: { error: "Too many attempts. Please try again in a moment." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Stricter rate limiter for SMS-based endpoints to prevent abuse
const smsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 requests per minute per IP
  message: { error: "Too many SMS requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const recordTransactionSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
  billId: z.string().optional(),
  branchId: z.string().optional(), // Optional branch ID for branch-specific tracking
  amountSpent: z.coerce.number()
    .refine(val => !isNaN(val), { message: "Amount must be a valid number" })
    .refine(val => val > 0, { message: "Amount must be greater than zero" })
});

const services = createLoyaltyServices(storage);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
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

  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
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
    // Disable caching to ensure fresh session state
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
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
      let branchAccess: { branchIds: string[]; hasAllAccess: boolean } | null = null;
      
      if (user.userType === 'restaurant_admin') {
        // Check if user owns any restaurants
        const ownedRestaurants = await storage.getRestaurantsByAdmin(user.id);
        
        if (ownedRestaurants.length > 0) {
          restaurant = ownedRestaurants[0];
          portalRole = 'owner'; // Restaurant owner has full permissions
          branchAccess = await storage.getAccessibleBranchIds(user.id, restaurant.id);
        } else {
          // Check if user has portal access to any restaurant
          const allRestaurants = await storage.getAllRestaurants();
          for (const r of allRestaurants) {
            const portalAccess = await storage.getPortalUserByUserAndRestaurant(user.id, r.id);
            if (portalAccess) {
              restaurant = r;
              portalRole = portalAccess.role; // 'manager' or 'staff'
              branchAccess = await storage.getAccessibleBranchIds(user.id, r.id);
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
        branchAccess, // { branchIds: string[], hasAllAccess: boolean }
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

  // AUTH - Forgot Password (request reset link)
  const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
  });

  app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
    try {
      const parseResult = forgotPasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { email } = parseResult.data;
      const user = await storage.getUserByEmail(email);

      // Always return success to prevent email enumeration
      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
      }

      // Generate token (32 bytes = 64 hex characters)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Determine the reset link based on user type
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const resetPath = user.userType === 'diner' ? '/reset-password' : '/admin/reset-password';
      const resetLink = `${baseUrl}${resetPath}?token=${token}`;

      const emailResult = await sendPasswordResetEmail(email, resetLink, user.name);
      
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Don't reveal to user that email failed - still return success for security
      }

      res.json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // AUTH - Forgot Password via SMS (for diners - sends reset link to phone)
  const forgotPasswordSmsSchema = z.object({
    phone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  });

  app.post("/api/auth/forgot-password-sms", smsRateLimiter, async (req, res) => {
    try {
      const parseResult = forgotPasswordSmsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone } = parseResult.data;
      const user = await storage.getUserByPhone(phone);

      // Always return success to prevent phone number enumeration
      if (!user) {
        console.log(`Password reset requested for non-existent phone: ${phone}`);
        return res.json({ success: true, message: "If an account with that phone number exists, a password reset link has been sent." });
      }

      // Allow SMS password reset for both diners and restaurant admins
      if (user.userType !== 'diner' && user.userType !== 'restaurant_admin') {
        console.log(`SMS password reset attempted for unsupported account type: ${phone}`);
        return res.json({ success: true, message: "If an account with that phone number exists, a password reset link has been sent." });
      }

      // Generate token (32 bytes = 64 hex characters)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Build reset link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send SMS with reset link
      const { sendSMS } = await import("./services/sms");
      const smsResult = await sendSMS(phone, `Reset your Dine&More password: ${resetLink} (expires in 1 hour)`);
      
      if (!smsResult.success) {
        console.error('Failed to send password reset SMS:', smsResult.error);
        // Don't reveal to user that SMS failed - still return success for security
      }

      res.json({ success: true, message: "If an account with that phone number exists, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password SMS error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // AUTH - Reset Password (set new password using token)
  // Strong password validation: 8+ chars, uppercase, lowercase, number, special char
  const passwordSchema = z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

  const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    password: passwordSchema,
  });

  app.post("/api/auth/reset-password", authRateLimiter, async (req, res) => {
    try {
      const parseResult = resetPasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { token, password } = parseResult.data;

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "This reset link has expired" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update user's password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // AUTH - Validate reset token (check if token is valid before showing form)
  app.get("/api/auth/validate-reset-token", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.json({ valid: false, error: "No token provided" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.json({ valid: false, error: "Invalid reset link" });
      }

      if (resetToken.usedAt) {
        return res.json({ valid: false, error: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.json({ valid: false, error: "This reset link has expired" });
      }

      res.json({ valid: true });
    } catch (error: any) {
      console.error("Validate reset token error:", error);
      res.json({ valid: false, error: "Failed to validate token" });
    }
  });

  // ACCOUNT DELETION - Request account deletion (sends confirmation email)
  const requestDeletionSchema = z.object({
    reason: z.string().optional(),
  });

  app.post("/api/account/request-deletion", authRateLimiter, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate confirmation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await storage.createAccountDeletionRequest(userId, token, expiresAt);

      // Build confirmation link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const confirmationPath = user.userType === 'diner' ? '/confirm-account-deletion' : '/admin/confirm-account-deletion';
      const confirmationLink = `${baseUrl}${confirmationPath}?token=${token}`;

      const emailResult = await sendAccountDeletionConfirmationEmail(
        user.email,
        confirmationLink,
        user.name
      );

      if (!emailResult.success) {
        console.error('Failed to send account deletion email:', emailResult.error);
        return res.status(500).json({ error: "Failed to send confirmation email" });
      }

      res.json({ 
        success: true, 
        message: "A confirmation email has been sent. Please check your inbox to complete the deletion process." 
      });
    } catch (error: any) {
      console.error("Request account deletion error:", error);
      res.status(500).json({ error: "Failed to process deletion request" });
    }
  });

  // ACCOUNT DELETION - Confirm deletion (using token from email)
  app.post("/api/account/confirm-deletion", authRateLimiter, async (req, res) => {
    try {
      const { token, reason } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const deletionRequest = await storage.getAccountDeletionRequestByToken(token);
      
      if (!deletionRequest) {
        return res.status(400).json({ error: "Invalid deletion link" });
      }

      if (deletionRequest.confirmedAt) {
        return res.status(400).json({ error: "This deletion has already been processed" });
      }

      if (new Date() > deletionRequest.expiresAt) {
        return res.status(400).json({ error: "This deletion link has expired" });
      }

      const user = await storage.getUser(deletionRequest.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Archive user data before deletion
      await storage.archiveUser(user, reason);

      // Mark deletion request as confirmed
      await storage.confirmAccountDeletionRequest(token);

      // Delete the user and related data
      await storage.deleteUser(user.id);

      // Clear session
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
      });

      res.json({ 
        success: true, 
        message: "Your account has been deleted. Your data will be retained for 90 days before permanent removal." 
      });
    } catch (error: any) {
      console.error("Confirm account deletion error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // ACCOUNT DELETION - Validate deletion token
  app.get("/api/account/validate-deletion-token", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.json({ valid: false, error: "No token provided" });
      }

      const deletionRequest = await storage.getAccountDeletionRequestByToken(token);
      
      if (!deletionRequest) {
        return res.json({ valid: false, error: "Invalid deletion link" });
      }

      if (deletionRequest.confirmedAt) {
        return res.json({ valid: false, error: "This deletion has already been processed" });
      }

      if (new Date() > deletionRequest.expiresAt) {
        return res.json({ valid: false, error: "This deletion link has expired" });
      }

      res.json({ valid: true });
    } catch (error: any) {
      console.error("Validate deletion token error:", error);
      res.json({ valid: false, error: "Failed to validate token" });
    }
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
    password: passwordSchema,
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
    ageRange: z.enum(["18-29", "30-39", "40-49", "50-59", "60+"]),
    province: z.string().min(1, "Province is required"),
  });

  app.post("/api/auth/register-diner", authRateLimiter, async (req, res) => {
    try {
      const parseResult = selfRegisterDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { name, lastName, email, phone, password, gender, ageRange, province } = parseResult.data;

      // Verify that the phone number was verified via OTP
      if (!req.session.verifiedPhone || req.session.verifiedPhone !== phone) {
        return res.status(400).json({ error: "Phone number must be verified before registration" });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      // Check if phone already exists (double-check in case of race condition)
      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ error: "An account with this phone number already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await storage.createUser({
        name,
        lastName,
        email,
        phone,
        password: hashedPassword,
        userType: 'diner',
        gender,
        ageRange,
        province,
      });

      // Set session and clear verified phone
      req.session.userId = user.id;
      req.session.userType = user.userType;
      delete req.session.verifiedPhone;

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
        });
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

  app.post("/api/auth/request-otp", smsRateLimiter, async (req, res) => {
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
      
      // Return generic success message to prevent phone enumeration
      // Only actually send OTP if user exists and is a diner
      if (!user || user.userType !== 'diner') {
        console.log(`OTP request for non-existent or non-diner phone: ${phone}`);
        return res.json({
          success: true,
          message: "If an account with that phone number exists, a code has been sent.",
        });
      }

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();
      
      // Store OTP with 5-minute expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      otpStore.set(phone, { otp, expiresAt });

      // Send OTP via SMS
      const { sendSMS } = await import("./services/sms");
      const smsResult = await sendSMS(phone, `Your Dine&More login code is: ${otp}. Valid for 5 minutes.`);

      res.json({
        success: true,
        message: "If an account with that phone number exists, a code has been sent.",
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
        });
      });
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // AUTH - Request OTP for registration (phone verification)
  app.post("/api/auth/request-registration-otp", smsRateLimiter, async (req, res) => {
    try {
      const parseResult = requestOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { phone } = parseResult.data;

      // Check if phone is already registered
      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ error: "This phone number is already registered" });
      }

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();
      
      // Store OTP with 5-minute expiry (using same store with prefix to differentiate)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      otpStore.set(`reg_${phone}`, { otp, expiresAt });

      // Send OTP via SMS
      const { sendSMS } = await import("./services/sms");
      const smsResult = await sendSMS(phone, `Your Dine&More verification code is: ${otp}. Valid for 5 minutes.`);

      res.json({
        success: true,
        smsSent: smsResult.success,
        smsError: smsResult.error,
        message: smsResult.success 
          ? "Verification code sent to your phone" 
          : "Could not send SMS. Please try again.",
      });
    } catch (error: any) {
      console.error("Request registration OTP error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  // AUTH - Verify OTP for registration (stores verified phone in session)
  app.post("/api/auth/verify-registration-otp", async (req, res) => {
    try {
      const parseResult = verifyOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone, otp } = parseResult.data;

      // Check stored OTP (with registration prefix)
      const storedOtp = otpStore.get(`reg_${phone}`);
      if (!storedOtp) {
        return res.status(400).json({ error: "No verification code found. Please request a new one." });
      }

      if (new Date() > storedOtp.expiresAt) {
        otpStore.delete(`reg_${phone}`);
        return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      }

      if (storedOtp.otp !== otp) {
        return res.status(401).json({ error: "Invalid verification code" });
      }

      // OTP is valid - clear it and store verified phone in session
      otpStore.delete(`reg_${phone}`);
      
      // Store verified phone in session (valid for 15 minutes)
      req.session.verifiedPhone = phone;
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Verification failed" });
        }
        res.json({
          success: true,
          message: "Phone number verified successfully",
          verifiedPhone: phone,
        });
      });
    } catch (error: any) {
      console.error("Verify registration OTP error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // TRANSACTIONS - Record a transaction and calculate points
  app.post("/api/transactions", async (req, res) => {
    try {
      const { dinerId, restaurantId, amountSpent, branchId } = insertTransactionSchema.extend({
        branchId: z.string().optional()
      }).parse(req.body);
      const result = await services.loyalty.recordTransaction(
        dinerId, 
        restaurantId, 
        Number(amountSpent),
        undefined, // billId
        branchId
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

  // USER PROFILE - Update user profile (phone changes require OTP verification via /phone-change endpoints)
  const updateProfileSchema = z.object({
    name: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email address"),
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
      
      const { name, lastName, email } = parseResult.data;
      
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
      
      // Note: Phone changes are NOT allowed via this endpoint
      // Users must use /api/phone-change/request and /api/phone-change/verify
      
      const updatedUser = await storage.updateUserProfile(userId, { 
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

  // PHONE CHANGE - Request OTP for phone number change
  const phoneChangeRequestSchema = z.object({
    newPhone: z.string()
      .transform(val => val.trim().replace(/[\s\-()]/g, ''))
      .refine(val => val.length >= 10, { message: "Phone number must be at least 10 digits" })
  });

  app.post("/api/phone-change/request", smsRateLimiter, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const parseResult = phoneChangeRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { newPhone } = parseResult.data;

      // Check if phone is already in use
      const existingUser = await storage.getUserByPhone(newPhone);
      if (existingUser && existingUser.id !== req.session.userId) {
        return res.status(400).json({ error: "This phone number is already registered to another account" });
      }

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create phone change request
      await storage.createPhoneChangeRequest({
        userId: req.session.userId,
        newPhone,
        otpHash,
        expiresAt
      });

      // Send OTP via SMS
      const smsResult = await sendPhoneChangeOTP(newPhone, otp);
      if (!smsResult.success) {
        console.error("Failed to send phone change OTP:", smsResult.error);
        return res.status(500).json({ error: "Failed to send verification code. Please try again." });
      }

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

  // PHONE CHANGE - Verify OTP and update phone number
  const phoneChangeVerifySchema = z.object({
    otp: z.string().length(6, "Verification code must be 6 digits")
  });

  app.post("/api/phone-change/verify", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const parseResult = phoneChangeVerifySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid verification code" 
        });
      }

      const { otp } = parseResult.data;

      // Get active phone change request
      const request = await storage.getActivePhoneChangeRequest(req.session.userId);
      if (!request) {
        return res.status(400).json({ error: "No pending phone change request found. Please request a new code." });
      }

      // Check if request has expired
      if (new Date() > request.expiresAt) {
        await storage.expirePhoneChangeRequest(request.id);
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      // Check attempts (max 5)
      if (request.attempts >= 5) {
        await storage.expirePhoneChangeRequest(request.id);
        return res.status(400).json({ error: "Too many failed attempts. Please request a new code." });
      }

      // Verify OTP
      const isValid = await bcrypt.compare(otp, request.otpHash);
      if (!isValid) {
        await storage.incrementPhoneChangeAttempts(request.id);
        const remainingAttempts = 5 - (request.attempts + 1);
        return res.status(400).json({ 
          error: `Incorrect verification code. ${remainingAttempts} attempts remaining.` 
        });
      }

      // Double-check phone isn't taken (race condition protection)
      const existingUser = await storage.getUserByPhone(request.newPhone);
      if (existingUser && existingUser.id !== req.session.userId) {
        await storage.expirePhoneChangeRequest(request.id);
        return res.status(400).json({ error: "This phone number is already registered to another account" });
      }

      // Mark request as verified and update user's phone
      await storage.markPhoneChangeVerified(request.id);
      const updatedUser = await storage.updateUserPhone(req.session.userId, request.newPhone);

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
      const rawSettings = req.body;
      
      // Coerce numeric fields from potential string values, skip NaN
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

  // RESTAURANT PROFILE - Update business profile information
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

  app.patch("/api/restaurants/:restaurantId/profile", async (req, res) => {
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

  // RESTAURANT ONBOARDING - Save onboarding data (draft or submit)
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

  app.patch("/api/restaurants/:restaurantId/onboarding", async (req, res) => {
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

  // RESTAURANT ONBOARDING - Submit for activation
  app.post("/api/restaurants/:restaurantId/onboarding/submit", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Validate state transition - only allow draft -> submitted
      if (restaurant.onboardingStatus !== 'draft') {
        return res.status(422).json({ error: "Restaurant has already been submitted or is active" });
      }

      // Validate required fields
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

  // RESTAURANT ONBOARDING - Activate (go live)
  app.post("/api/restaurants/:restaurantId/onboarding/activate", async (req, res) => {
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

  // BRANCHES - Get all branches for a restaurant
  app.get("/api/restaurants/:restaurantId/branches", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const branchList = await storage.getBranchesByRestaurant(restaurantId);
      res.json(branchList);
    } catch (error) {
      console.error("Get branches error:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  // BRANCHES - Create a new branch (owner/manager only)
  const createBranchSchema = z.object({
    name: z.string().min(1, "Branch name is required"),
    address: z.string().optional(),
    phone: z.string().optional(),
    isDefault: z.boolean().optional().default(false),
  });

  app.post("/api/restaurants/:restaurantId/branches", async (req, res) => {
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

  // BRANCHES - Update a branch
  app.patch("/api/restaurants/:restaurantId/branches/:branchId", async (req, res) => {
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

  // BRANCHES - Delete a branch
  app.delete("/api/restaurants/:restaurantId/branches/:branchId", async (req, res) => {
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
    branchId: z.string().optional(),
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

      const { voucherTypeId, branchId } = parseResult.data;
      const result = await services.loyalty.redeemVoucherCredit(dinerId, restaurantId, voucherTypeId, branchId);
      res.json(result);
    } catch (error: any) {
      console.error("Redeem voucher credit error:", error);
      res.status(400).json({ error: error.message || "Failed to redeem voucher credit" });
    }
  });
  
  // RESTAURANT STATS - Get restaurant dashboard statistics
  app.get("/api/restaurants/:restaurantId/stats", async (req, res) => {
    try {
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
      
      let branchId = req.query.branchId as string | undefined;
      
      // Validate branch access and enforce restrictions for staff without full access
      const branchAccess = await storage.getAccessibleBranchIds(req.session.userId, restaurantId);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess) {
        // Staff without full access must specify a branch - default to first accessible
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

  // RESTAURANT GET TRANSACTIONS - Get recent transactions for a restaurant
  app.get("/api/restaurants/:restaurantId/transactions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { restaurantId } = req.params;
      
      // Check user's access to this restaurant
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
      
      // Validate branch access
      const branchAccess = await storage.getAccessibleBranchIds(req.session.userId, restaurantId);
      if (branchId) {
        if (!branchAccess.hasAllAccess && !branchAccess.branchIds.includes(branchId)) {
          return res.status(403).json({ error: "You don't have access to this branch" });
        }
      } else if (!branchAccess.hasAllAccess && branchAccess.branchIds.length > 0) {
        branchId = branchAccess.branchIds[0];
      }
      
      // Get transactions (last 30 days by default)
      const transactions = await storage.getTransactionsByRestaurant(restaurantId, true, branchId || null);
      
      // Enrich with diner info
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
      
      const { phone, billId, branchId, amountSpent } = parseResult.data;
      
      // Look up diner by phone
      const diner = await storage.getUserByPhone(phone);
      if (!diner) {
        return res.status(404).json({ error: "No customer found with that phone number" });
      }
      
      if (diner.userType !== 'diner') {
        return res.status(400).json({ error: "Phone number is not registered as a diner" });
      }
      
      // Record the transaction with optional branchId for branch-specific tracking
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

  // RECONCILIATION - Upload CSV for bill matching (any user with restaurant access)
  app.post("/api/restaurants/:restaurantId/reconciliation/upload", async (req, res) => {
    try {
      // Require authenticated user
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { restaurantId } = req.params;
      
      // Check user's access to this restaurant
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      // Allow any user with access to the restaurant (owner, manager, or staff)
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant" });
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

  // RECONCILIATION - Get all batches for a restaurant (any user with restaurant access)
  app.get("/api/restaurants/:restaurantId/reconciliation/batches", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { restaurantId } = req.params;
      
      // Check user's access to this restaurant
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant" });
      }
      
      const batches = await services.reconciliation.getBatches(restaurantId);
      res.json(batches);
    } catch (error) {
      console.error("Get reconciliation batches error:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation batches" });
    }
  });

  // RECONCILIATION - Get batch details (any user with restaurant access)
  app.get("/api/restaurants/:restaurantId/reconciliation/batches/:batchId", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { restaurantId } = req.params;
      
      // Check user's access to this restaurant
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const isOwner = restaurant.adminUserId === req.session.userId;
      const portalAccess = await storage.getPortalUserByUserAndRestaurant(req.session.userId, restaurantId);
      
      if (!isOwner && !portalAccess) {
        return res.status(403).json({ error: "You don't have access to this restaurant" });
      }
      
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
      
      // Check if restaurant is active (completed onboarding)
      if (!restaurant || restaurant.onboardingStatus !== 'active') {
        return res.status(400).json({ error: "This restaurant is not yet accepting registrations" });
      }
      
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
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
    ageRange: z.enum(["18-29", "30-39", "40-49", "50-59", "60+"]),
    province: z.string().min(1, "Province is required"),
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
      
      const { token, email, name, lastName, gender, ageRange, province, termsAccepted, privacyAccepted } = parseResult.data;
      
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
      
      // Check if restaurant is active (completed onboarding)
      const restaurant = await storage.getRestaurant(invitation.restaurantId);
      if (!restaurant || restaurant.onboardingStatus !== 'active') {
        return res.status(400).json({ error: "This restaurant is not yet accepting registrations" });
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
        gender,
        ageRange,
        province,
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
      let branchId = req.query.branchId as string | undefined;
      
      // Validate branch access
      const branchAccess = await storage.getAccessibleBranchIds(req.session.userId, restaurantId);
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
      
      const data = await storage.getDinerRegistrationsByDateRange(restaurantId, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get diner registrations error:", error);
      res.status(500).json({ error: "Failed to fetch diner registrations" });
    }
  });

  // REVENUE BY DATE - Get daily revenue over time with date range filtering
  app.get("/api/restaurants/:restaurantId/revenue", async (req, res) => {
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
      
      // Validate branch access
      const branchAccess = await storage.getAccessibleBranchIds(req.session.userId, restaurantId);
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
      let branchId = req.query.branchId as string | undefined;
      
      // Validate branch access
      const branchAccess = await storage.getAccessibleBranchIds(req.session.userId, restaurantId);
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

  // REGISTERED DINERS - Get all registered diners for a restaurant
  app.get("/api/restaurants/:restaurantId/diners", async (req, res) => {
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

  // PORTAL USERS - Get all portal users (staff) for a restaurant
  app.get("/api/restaurants/:restaurantId/portal-users", async (req, res) => {
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

  // PORTAL USERS - Add a new portal user (staff member)
  const addStaffUserSchema = z.object({
    email: z.string().email("Valid email is required"),
    role: z.enum(["manager", "staff"]).default("staff"),
    hasAllBranchAccess: z.boolean().default(true),
    branchIds: z.array(z.string()).default([]),
  });

  app.post("/api/restaurants/:restaurantId/portal-users", async (req, res) => {
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

  // PORTAL USERS - Remove a portal user (staff member)
  app.delete("/api/restaurants/:restaurantId/portal-users/:portalUserId", async (req, res) => {
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

  // PORTAL USERS - Update branch access for a portal user
  const updateBranchAccessSchema = z.object({
    hasAllBranchAccess: z.boolean(),
    branchIds: z.array(z.string()),
  });

  app.put("/api/restaurants/:restaurantId/portal-users/:portalUserId/branch-access", async (req, res) => {
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
