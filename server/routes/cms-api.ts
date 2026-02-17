import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSchedulerStatus, fetchAndProcessFtpFiles, recordFetchResult } from "../services/scheduler";

const CMS_SESSION_KEY = "cms_admin_id";

function getCmsAdminId(req: any): string | null {
  return req.session?.[CMS_SESSION_KEY] || null;
}

function requireCmsAuth(req: any, res: any, next: any) {
  const adminId = getCmsAdminId(req);
  if (!adminId) {
    return res.status(401).json({ error: "CMS authentication required" });
  }
  next();
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const contentPageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  portal: z.string().default("diner"),
  isPublished: z.boolean().default(true),
});

const ftpPathSchema = z.object({
  ftpPath: z.string().nullable(),
});

export function registerCmsApiRoutes(router: Router): void {
  router.post("/api/cms/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: "Invalid credentials format" });
      }

      const admin = await storage.getCmsAdminByEmail(parsed.data.email);
      if (!admin) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(parsed.data.password, admin.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      (req.session as any)[CMS_SESSION_KEY] = admin.id;
      res.json({ id: admin.id, name: admin.name, email: admin.email });
    } catch (error: any) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  router.get("/api/cms/auth/me", async (req, res) => {
    const adminId = getCmsAdminId(req);
    if (!adminId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const admin = await storage.getCmsAdmin(adminId);
    if (!admin) {
      return res.status(401).json({ error: "Admin not found" });
    }

    res.json({ id: admin.id, name: admin.name, email: admin.email });
  });

  router.post("/api/cms/auth/logout", (req, res) => {
    delete (req.session as any)[CMS_SESSION_KEY];
    res.json({ success: true });
  });

  router.get("/api/cms/dashboard", requireCmsAuth, async (req, res) => {
    try {
      const [restaurantCount, dinerCount, restaurants] = await Promise.all([
        storage.countAllRestaurants(),
        storage.countAllDiners(),
        storage.getAllRestaurants(),
      ]);

      const ftpConfiguredCount = restaurants.filter(r => r.ftpPath).length;
      const activeCount = restaurants.filter(r => r.onboardingStatus === "active").length;

      res.json({
        restaurantCount,
        dinerCount,
        ftpConfiguredCount,
        activeRestaurants: activeCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load dashboard stats" });
    }
  });

  router.get("/api/cms/restaurants", requireCmsAuth, async (req, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      res.json(restaurants);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load restaurants" });
    }
  });

  router.get("/api/cms/restaurants/:id", requireCmsAuth, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurant(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load restaurant" });
    }
  });

  router.put("/api/cms/restaurants/:id/ftp-path", requireCmsAuth, async (req, res) => {
    try {
      const parsed = ftpPathSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: "Invalid FTP path" });
      }

      const restaurant = await storage.updateRestaurant(req.params.id, {
        ftpPath: parsed.data.ftpPath,
      } as any);
      res.json(restaurant);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update FTP path" });
    }
  });

  router.get("/api/cms/ftp/status", requireCmsAuth, async (req, res) => {
    try {
      const restaurants = await storage.getRestaurantsWithFtpPath();
      const statuses = restaurants.map(r => {
        const status = getSchedulerStatus(r.id);
        return {
          restaurantId: r.id,
          restaurantName: r.name,
          ftpPath: r.ftpPath,
          schedulerStatus: status,
        };
      });
      
      const globalStatus = getSchedulerStatus();

      res.json({ globalStatus, restaurants: statuses });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load FTP status" });
    }
  });

  router.post("/api/cms/ftp/fetch/:restaurantId", requireCmsAuth, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurant(req.params.restaurantId);
      if (!restaurant || !restaurant.ftpPath) {
        return res.status(400).json({ error: "Restaurant has no FTP path configured" });
      }

      const result = await fetchAndProcessFtpFiles(restaurant.id, restaurant.ftpPath);
      recordFetchResult(restaurant.id, result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: `FTP fetch failed: ${error.message}` });
    }
  });

  router.get("/api/cms/content", requireCmsAuth, async (req, res) => {
    try {
      const pages = await storage.getAllContentPages();
      res.json(pages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content pages" });
    }
  });

  router.get("/api/cms/content/:id", requireCmsAuth, async (req, res) => {
    try {
      const page = await storage.getContentPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Content page not found" });
      }
      res.json(page);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content page" });
    }
  });

  router.post("/api/cms/content", requireCmsAuth, async (req, res) => {
    try {
      const parsed = contentPageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error.errors[0]?.message || "Invalid content" });
      }

      const page = await storage.createContentPage(parsed.data);
      res.json(page);
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ error: "A page with this slug already exists" });
      }
      res.status(500).json({ error: "Failed to create content page" });
    }
  });

  router.put("/api/cms/content/:id", requireCmsAuth, async (req, res) => {
    try {
      const parsed = contentPageSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error.errors[0]?.message || "Invalid content" });
      }

      const existing = await storage.getContentPage(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Content page not found" });
      }

      const updated = await storage.updateContentPage(req.params.id, {
        ...parsed.data,
        version: existing.version + 1,
      } as any);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update content page" });
    }
  });

  router.delete("/api/cms/content/:id", requireCmsAuth, async (req, res) => {
    try {
      await storage.deleteContentPage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete content page" });
    }
  });

  router.post("/api/cms/seed-admin", async (req, res) => {
    try {
      const existing = await storage.getCmsAdminByEmail("admin@dineandmore.co.za");
      if (existing) {
        return res.json({ message: "Admin already exists" });
      }

      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = await storage.createCmsAdmin({
        email: "admin@dineandmore.co.za",
        password: hashedPassword,
        name: "Platform Admin",
      });

      res.json({ message: "Admin created", email: admin.email });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to seed admin" });
    }
  });
}
