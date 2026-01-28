import { Router } from "express";
import { storage } from "../storage";
import { sendRegistrationInvite } from "../services/sms";
import { verifyCaptcha } from "../services/captcha";
import { checkSMSRateLimit, recordSMSSent } from "../services/smsRateLimiter";
import { getAuthUserId, getAuthUserType } from "./auth";
import { z } from "zod";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

const smsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many SMS requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const inviteDinerSchema = z.object({
  phone: z.string()
    .transform(val => val.trim().replace(/[\s\-()]/g, ''))
    .refine(val => val.length >= 7, { message: "Phone number must be at least 7 digits" })
    .refine(val => /^[0-9+]+$/.test(val), { message: "Phone number contains invalid characters" }),
});

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
  captchaToken: z.string().min(1, "Security verification required"),
});

export function registerInvitationRoutes(router: Router): void {
  router.post("/api/restaurants/:restaurantId/diners/invite", smsRateLimiter, async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      const parseResult = inviteDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }
      
      const { phone } = parseResult.data;
      
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      const smsLimitCheck = checkSMSRateLimit(phone, restaurantId);
      if (!smsLimitCheck.allowed) {
        return res.status(429).json({ 
          error: smsLimitCheck.error,
          retryAfterSeconds: smsLimitCheck.retryAfterSeconds
        });
      }
      
      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ error: "A customer with this phone number is already registered" });
      }
      
      const token = crypto.randomBytes(8).toString('base64url');
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const invitation = await storage.createDinerInvitation({
        restaurantId,
        phone,
        token,
        status: "pending",
        expiresAt,
      });
      
      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'https';
      const fullRegistrationLink = `${protocol}://${host}/r/${token}`;
      const registrationLink = `/r/${token}`;
      
      let smsSent = false;
      let smsError: string | undefined;
      
      try {
        const smsResult = await sendRegistrationInvite(phone, restaurant.name, fullRegistrationLink);
        smsSent = smsResult.success;
        smsError = smsResult.error;
        
        if (smsResult.success) {
          recordSMSSent(phone, restaurantId);
        }
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

  router.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
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
      
      const restaurant = await storage.getRestaurant(invitation.restaurantId);
      
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

  router.post("/api/diners/register", async (req, res) => {
    try {
      const parseResult = registerDinerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(422).json({ 
          error: parseResult.error.errors[0]?.message || "Invalid input data" 
        });
      }

      const captchaResult = await verifyCaptcha(parseResult.data.captchaToken, req.ip || req.socket.remoteAddress);
      if (!captchaResult.success) {
        return res.status(403).json({ error: captchaResult.error || "Security verification failed" });
      }

      const { token, email, name, lastName, gender, ageRange, province, termsAccepted, privacyAccepted } = parseResult.data;
      
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
      
      if (!req.session.verifiedInvitationPhone || !req.session.verifiedInvitationToken) {
        return res.status(400).json({ error: "Phone number must be verified before registration" });
      }
      
      if (req.session.verifiedInvitationPhone !== invitation.phone || req.session.verifiedInvitationToken !== token) {
        return res.status(400).json({ error: "Phone verification does not match this invitation" });
      }
      
      const restaurant = await storage.getRestaurant(invitation.restaurantId);
      if (!restaurant || restaurant.onboardingStatus !== 'active') {
        return res.status(400).json({ error: "This restaurant is not yet accepting registrations" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }
      
      const existingPhone = await storage.getUserByPhone(invitation.phone);
      if (existingPhone) {
        return res.status(400).json({ error: "This phone number is already registered" });
      }
      
      const now = new Date();
      
      const user = await storage.createUser({
        email,
        password: crypto.randomBytes(16).toString('hex'),
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
      
      await storage.updateDinerInvitation(invitation.id, {
        status: 'registered',
        dinerId: user.id,
        consumedAt: now,
      });
      
      await storage.createPointsBalance({
        dinerId: user.id,
        restaurantId: invitation.restaurantId,
        currentPoints: 0,
        totalPointsEarned: 0,
        totalVouchersGenerated: 0,
      });
      
      delete req.session.verifiedInvitationPhone;
      delete req.session.verifiedInvitationToken;
      
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

  router.get("/api/restaurants/:restaurantId/invitations", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const invitations = await storage.getDinerInvitationsByRestaurant(restaurantId);
      res.json(invitations);
    } catch (error) {
      console.error("Get restaurant invitations error:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  router.get("/api/restaurants/:restaurantId/diner-registrations", async (req, res) => {
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
      
      const data = await storage.getDinerRegistrationsByDateRange(restaurantId, startDate, endDate, branchId || null);
      res.json(data);
    } catch (error) {
      console.error("Get diner registrations error:", error);
      res.status(500).json({ error: "Failed to fetch diner registrations" });
    }
  });
}
