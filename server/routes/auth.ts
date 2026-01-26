import { Router } from "express";
import { storage } from "../storage";
import { sendRegistrationInvite, sendPhoneChangeOTP, sendSMS } from "../services/sms";
import { sendPasswordResetEmail, sendAccountDeletionConfirmationEmail } from "../services/email";
import { verifyCaptcha } from "../services/captcha";
import { checkSMSRateLimit, recordSMSSent } from "../services/smsRateLimiter";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";

const authRateLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
  message: { error: "Too many attempts. Please try again in a moment." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const smsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many SMS requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

export function getAuthUserId(req: any): string | null {
  const headerUserId = req.headers['x-user-id'] as string | undefined;
  if (headerUserId) {
    return headerUserId;
  }
  return req.session?.userId || null;
}

export function getAuthUserType(req: any): string | null {
  const headerUserType = req.headers['x-user-type'] as string | undefined;
  if (headerUserType) {
    return headerUserType;
  }
  return req.session?.userType || null;
}

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  captchaToken: z.string().min(1, "Security verification required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const forgotPasswordSmsSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

const requestDeletionSchema = z.object({
  reason: z.string().optional(),
});

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
  restaurantId: z.string().optional(),
});

const tokenLoginSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
});

const checkTokenLoginSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
});

const requestOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
});

const verifyOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const invitationOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  token: z.string().min(1, "Invitation token is required"),
});

const verifyInvitationOtpSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" }),
  otp: z.string().length(6, "Verification code must be 6 digits"),
  token: z.string().min(1, "Invitation token is required"),
});

export function registerAuthRoutes(router: Router): void {
  router.get("/r/:token", (req, res) => {
    const { token } = req.params;
    res.redirect(`/register?token=${token}`);
  });

  router.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const captchaResult = await verifyCaptcha(parseResult.data.captchaToken, req.ip || req.socket.remoteAddress);
      if (!captchaResult.success) {
        return res.status(403).json({ error: captchaResult.error || "Security verification failed" });
      }

      const { email, password } = parseResult.data;

      const user = await storage.getUserByEmail(email);
      console.log('[LOGIN DEBUG] User lookup for email:', email, '- Found:', !!user, user?.id);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      let passwordValid = false;
      console.log('[LOGIN DEBUG] Password hash prefix:', user.password.substring(0, 10), '- Length:', user.password.length);
      if (user.password.startsWith('$2')) {
        passwordValid = await bcrypt.compare(password, user.password);
        console.log('[LOGIN DEBUG] bcrypt.compare result:', passwordValid);
      } else {
        passwordValid = user.password === password;
        console.log('[LOGIN DEBUG] Plain text compare result:', passwordValid);
      }

      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

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

      req.session.userId = user.id;
      req.session.userType = user.userType;
      
      console.log("[DEBUG] Login - Session ID:", req.sessionID, "userId:", user.id);

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Login failed" });
        }
        
        console.log("[DEBUG] Login - Session saved successfully");
        
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

  router.get("/api/auth/me", async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const userId = getAuthUserId(req);
      console.log("[DEBUG] /api/auth/me - userId:", userId, "from header:", req.headers['x-user-id']);
      
      if (!userId) {
        return res.json({ user: null, restaurant: null, portalRole: null, branchAccess: null });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ user: null, restaurant: null, portalRole: null });
      }

      let restaurant = null;
      let portalRole = null;
      let branchAccess: { branchIds: string[]; hasAllAccess: boolean } | null = null;
      
      if (user.userType === 'restaurant_admin') {
        const ownedRestaurants = await storage.getRestaurantsByAdmin(user.id);
        
        if (ownedRestaurants.length > 0) {
          restaurant = ownedRestaurants[0];
          portalRole = 'owner';
          branchAccess = await storage.getAccessibleBranchIds(user.id, restaurant.id);
        } else {
          const allRestaurants = await storage.getAllRestaurants();
          for (const r of allRestaurants) {
            const portalAccess = await storage.getPortalUserByUserAndRestaurant(user.id, r.id);
            if (portalAccess) {
              restaurant = r;
              portalRole = portalAccess.role;
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
        portalRole,
        branchAccess,
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.json({ user: null, restaurant: null, portalRole: null });
    }
  });

  router.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  router.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
    try {
      const parseResult = forgotPasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { email } = parseResult.data;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const resetPath = user.userType === 'diner' ? '/reset-password' : '/admin/reset-password';
      const resetLink = `${baseUrl}${resetPath}?token=${token}`;

      const emailResult = await sendPasswordResetEmail(email, resetLink, user.name);
      
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
      }

      res.json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  router.post("/api/auth/forgot-password-sms", smsRateLimiter, async (req, res) => {
    try {
      const parseResult = forgotPasswordSmsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone } = parseResult.data;
      const user = await storage.getUserByPhone(phone);

      if (!user) {
        console.log(`Password reset requested for non-existent phone: ${phone}`);
        return res.json({ success: true, message: "If an account with that phone number exists, a password reset link has been sent." });
      }

      if (user.userType !== 'diner' && user.userType !== 'restaurant_admin') {
        console.log(`SMS password reset attempted for unsupported account type: ${phone}`);
        return res.json({ success: true, message: "If an account with that phone number exists, a password reset link has been sent." });
      }

      const smsLimitCheck = checkSMSRateLimit(phone);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      const smsResult = await sendSMS(phone, `Reset your Dine&More password: ${resetLink} (expires in 1 hour)`);
      
      if (smsResult.success) {
        recordSMSSent(phone);
      } else {
        console.error('Failed to send password reset SMS:', smsResult.error);
      }

      res.json({ success: true, message: "If an account with that phone number exists, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password SMS error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  router.post("/api/auth/reset-password", authRateLimiter, async (req, res) => {
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

      const hashedPassword = await bcrypt.hash(password, 12);

      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      await storage.markPasswordResetTokenUsed(token);

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  router.get("/api/auth/validate-reset-token", async (req, res) => {
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

  router.post("/api/account/request-deletion", authRateLimiter, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.createAccountDeletionRequest(userId, token, expiresAt);

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

  router.post("/api/account/confirm-deletion", authRateLimiter, async (req, res) => {
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

      await storage.archiveUser(user, reason);

      await storage.confirmAccountDeletionRequest(token);

      await storage.deleteUser(user.id);

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

  router.get("/api/account/validate-deletion-token", async (req, res) => {
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

  router.post("/api/auth/register-diner", authRateLimiter, async (req, res) => {
    try {
      const parseResult = selfRegisterDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { name, lastName, email, phone, password, gender, ageRange, province, restaurantId } = parseResult.data;

      if (!req.session.verifiedPhone || req.session.verifiedPhone !== phone) {
        return res.status(400).json({ error: "Phone number must be verified before registration" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ error: "An account with this phone number already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

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

      // If registered via restaurant QR code, create initial points balance for that restaurant
      if (restaurantId) {
        try {
          const restaurant = await storage.getRestaurant(restaurantId);
          if (restaurant) {
            // Check if points balance already exists
            const existingBalance = await storage.getPointsBalance(user.id, restaurantId);
            if (!existingBalance) {
              await storage.createPointsBalance({
                dinerId: user.id,
                restaurantId: restaurantId,
                currentPoints: 0,
                totalPointsEarned: 0,
              });
            }
          }
        } catch (err) {
          console.error("Failed to create initial points balance:", err);
          // Don't fail registration if points balance creation fails
        }
      }

      req.session.userId = user.id;
      req.session.userType = user.userType;
      delete req.session.verifiedPhone;

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

  router.post("/api/auth/login-token", async (req, res) => {
    try {
      const parseResult = tokenLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { accessToken } = parseResult.data;

      const user = await storage.getUserByAccessToken(accessToken);
      if (!user) {
        return res.status(401).json({ error: "Invalid or expired access token" });
      }

      if (user.accessTokenExpiresAt && new Date(user.accessTokenExpiresAt) < new Date()) {
        return res.status(401).json({ error: "Access token has expired. Please login with OTP." });
      }

      req.session.userId = user.id;
      req.session.userType = user.userType;

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

  router.post("/api/auth/check-token", async (req, res) => {
    try {
      const parseResult = checkTokenLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { phone } = parseResult.data;

      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.json({ hasValidToken: false, requiresOtp: true });
      }

      if (user.userType !== 'diner') {
        return res.json({ hasValidToken: false, requiresOtp: true });
      }

      if (user.accessToken && user.accessTokenExpiresAt && new Date(user.accessTokenExpiresAt) > new Date()) {
        req.session.userId = user.id;
        req.session.userType = user.userType;

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

      return res.json({ hasValidToken: false, requiresOtp: true });
    } catch (error: any) {
      console.error("Check token error:", error);
      res.status(500).json({ error: "Check failed" });
    }
  });

  router.post("/api/auth/request-otp", smsRateLimiter, async (req, res) => {
    try {
      const parseResult = requestOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { phone } = parseResult.data;

      const user = await storage.getUserByPhone(phone);
      
      if (!user || user.userType !== 'diner') {
        console.log(`OTP request for non-existent or non-diner phone: ${phone}`);
        return res.json({
          success: true,
          message: "If an account with that phone number exists, a code has been sent.",
        });
      }

      const smsLimitCheck = checkSMSRateLimit(phone);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      otpStore.set(phone, { otp, expiresAt });

      const smsResult = await sendSMS(phone, `Your Dine&More login code is: ${otp}. Valid for 5 minutes.`);
      
      if (smsResult.success) {
        recordSMSSent(phone);
      }

      res.json({
        success: true,
        message: "If an account with that phone number exists, a code has been sent.",
      });
    } catch (error: any) {
      console.error("Request OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  router.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const parseResult = verifyOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone, otp } = parseResult.data;

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

      otpStore.delete(phone);

      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      req.session.userId = user.id;
      req.session.userType = user.userType;

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

  router.post("/api/auth/request-registration-otp", smsRateLimiter, async (req, res) => {
    try {
      const parseResult = requestOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid phone number" 
        });
      }

      const { phone } = parseResult.data;

      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ error: "This phone number is already registered" });
      }

      const smsLimitCheck = checkSMSRateLimit(phone);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      otpStore.set(`reg_${phone}`, { otp, expiresAt });

      const smsResult = await sendSMS(phone, `Your Dine&More verification code is: ${otp}. Valid for 5 minutes.`);
      
      if (smsResult.success) {
        recordSMSSent(phone);
      }

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

  router.post("/api/auth/verify-registration-otp", async (req, res) => {
    try {
      const parseResult = verifyOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone, otp } = parseResult.data;

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

      otpStore.delete(`reg_${phone}`);
      
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

  router.post("/api/auth/invitation-otp", smsRateLimiter, async (req, res) => {
    try {
      const parseResult = invitationOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone, token } = parseResult.data;

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

      if (invitation.phone !== phone) {
        return res.status(400).json({ error: "Phone number does not match invitation" });
      }

      const smsLimitCheck = checkSMSRateLimit(phone, invitation.restaurantId);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      otpStore.set(`inv_${phone}`, { otp, expiresAt });

      const smsResult = await sendSMS(phone, `Your Dine&More verification code is: ${otp}. Valid for 5 minutes.`);
      
      if (smsResult.success) {
        recordSMSSent(phone, invitation.restaurantId);
      }

      res.json({
        success: true,
        smsSent: smsResult.success,
        message: smsResult.success 
          ? "Verification code sent to your phone" 
          : "Could not send SMS. Please try again.",
      });
    } catch (error: any) {
      console.error("Request invitation OTP error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  router.post("/api/auth/verify-invitation-otp", async (req, res) => {
    try {
      const parseResult = verifyInvitationOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { phone, otp, token } = parseResult.data;

      const invitation = await storage.getDinerInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invalid invitation link" });
      }

      if (invitation.phone !== phone) {
        return res.status(400).json({ error: "Phone number does not match invitation" });
      }

      const storedOtp = otpStore.get(`inv_${phone}`);
      if (!storedOtp) {
        return res.status(400).json({ error: "No verification code found. Please request a new one." });
      }

      if (new Date() > storedOtp.expiresAt) {
        otpStore.delete(`inv_${phone}`);
        return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      }

      if (storedOtp.otp !== otp) {
        return res.status(401).json({ error: "Invalid verification code" });
      }

      otpStore.delete(`inv_${phone}`);
      
      req.session.verifiedInvitationPhone = phone;
      req.session.verifiedInvitationToken = token;
      
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
      console.error("Verify invitation OTP error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });
}
