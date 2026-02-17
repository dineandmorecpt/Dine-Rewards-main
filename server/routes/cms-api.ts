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

const ftpPathSchema = z.object({
  ftpPath: z.string().nullable(),
});

const contentTypeSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase alphanumeric with underscores"),
  name: z.string().min(1),
  description: z.string().optional(),
  schema: z.record(z.object({
    type: z.enum(["text", "textarea", "richtext", "number", "boolean", "url", "image", "date", "select", "json"]),
    label: z.string(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
  })).default({}),
});

const contentItemSchema = z.object({
  typeKey: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase alphanumeric with hyphens"),
  data: z.record(z.any()).default({}),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export function registerCmsApiRoutes(router: Router): void {
  // ============================================================================
  // AUTH
  // ============================================================================

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

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  router.get("/api/cms/dashboard", requireCmsAuth, async (req, res) => {
    try {
      const [restaurantCount, dinerCount, restaurants, contentTypesCount, contentItemsCount] = await Promise.all([
        storage.countAllRestaurants(),
        storage.countAllDiners(),
        storage.getAllRestaurants(),
        storage.getAllContentTypes().then(t => t.length),
        storage.getAllContentItems().then(i => i.length),
      ]);

      const ftpConfiguredCount = restaurants.filter(r => r.ftpPath).length;
      const activeCount = restaurants.filter(r => r.onboardingStatus === "active").length;

      res.json({
        restaurantCount,
        dinerCount,
        ftpConfiguredCount,
        activeRestaurants: activeCount,
        contentTypesCount,
        contentItemsCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load dashboard stats" });
    }
  });

  // ============================================================================
  // RESTAURANTS
  // ============================================================================

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

  // ============================================================================
  // FTP STATUS
  // ============================================================================

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

  // ============================================================================
  // CONTENT TYPES (Headless CMS - Schema Definitions)
  // ============================================================================

  router.get("/api/cms/content-types", requireCmsAuth, async (req, res) => {
    try {
      const types = await storage.getAllContentTypes();
      res.json(types);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content types" });
    }
  });

  router.get("/api/cms/content-types/:id", requireCmsAuth, async (req, res) => {
    try {
      const type = await storage.getContentType(req.params.id);
      if (!type) {
        return res.status(404).json({ error: "Content type not found" });
      }
      res.json(type);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content type" });
    }
  });

  router.post("/api/cms/content-types", requireCmsAuth, async (req, res) => {
    try {
      const parsed = contentTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error.errors[0]?.message || "Invalid content type" });
      }

      const existing = await storage.getContentTypeByKey(parsed.data.key);
      if (existing) {
        return res.status(409).json({ error: "A content type with this key already exists" });
      }

      const type = await storage.createContentType(parsed.data);
      res.json(type);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create content type" });
    }
  });

  router.put("/api/cms/content-types/:id", requireCmsAuth, async (req, res) => {
    try {
      const parsed = contentTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error.errors[0]?.message || "Invalid content type" });
      }

      const existing = await storage.getContentType(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Content type not found" });
      }

      const updated = await storage.updateContentType(req.params.id, parsed.data);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update content type" });
    }
  });

  router.delete("/api/cms/content-types/:id", requireCmsAuth, async (req, res) => {
    try {
      const existing = await storage.getContentType(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Content type not found" });
      }

      await storage.deleteContentType(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete content type" });
    }
  });

  // ============================================================================
  // CONTENT ITEMS (Headless CMS - Structured Data)
  // ============================================================================

  router.get("/api/cms/content-items", requireCmsAuth, async (req, res) => {
    try {
      const typeKey = req.query.typeKey as string | undefined;
      const items = typeKey
        ? await storage.getContentItemsByType(typeKey)
        : await storage.getAllContentItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content items" });
    }
  });

  router.get("/api/cms/content-items/:id", requireCmsAuth, async (req, res) => {
    try {
      const item = await storage.getContentItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Content item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content item" });
    }
  });

  router.post("/api/cms/content-items", requireCmsAuth, async (req, res) => {
    try {
      const parsed = contentItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error.errors[0]?.message || "Invalid content item" });
      }

      const contentType = await storage.getContentTypeByKey(parsed.data.typeKey);
      if (!contentType) {
        return res.status(400).json({ error: `Content type '${parsed.data.typeKey}' does not exist` });
      }

      const existing = await storage.getContentItemByTypeAndSlug(parsed.data.typeKey, parsed.data.slug);
      if (existing) {
        return res.status(409).json({ error: "An item with this slug already exists for this content type" });
      }

      const publishedAt = parsed.data.status === "published" ? new Date() : null;
      const item = await storage.createContentItem({ ...parsed.data, publishedAt });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create content item" });
    }
  });

  router.put("/api/cms/content-items/:id", requireCmsAuth, async (req, res) => {
    try {
      const parsed = contentItemSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error.errors[0]?.message || "Invalid content item" });
      }

      const existing = await storage.getContentItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Content item not found" });
      }

      const updates: any = {
        ...parsed.data,
        version: existing.version + 1,
      };

      if (parsed.data.status === "published" && existing.status !== "published") {
        updates.publishedAt = new Date();
      }

      const updated = await storage.updateContentItem(req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update content item" });
    }
  });

  router.delete("/api/cms/content-items/:id", requireCmsAuth, async (req, res) => {
    try {
      await storage.deleteContentItem(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete content item" });
    }
  });

  // ============================================================================
  // LEGACY CONTENT PAGES (backward compatibility)
  // ============================================================================

  router.get("/api/cms/content", requireCmsAuth, async (req, res) => {
    try {
      const pages = await storage.getAllContentPages();
      res.json(pages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content pages" });
    }
  });

  router.post("/api/cms/content", requireCmsAuth, async (req, res) => {
    try {
      const legacySchema = z.object({
        slug: z.string().min(1),
        title: z.string().min(1),
        content: z.string().min(1),
        portal: z.string().default("diner"),
        isPublished: z.boolean().default(true),
      });
      const parsed = legacySchema.safeParse(req.body);
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
      const legacySchema = z.object({
        slug: z.string().min(1),
        title: z.string().min(1),
        content: z.string().min(1),
        portal: z.string().default("diner"),
        isPublished: z.boolean().default(true),
      });
      const parsed = legacySchema.partial().safeParse(req.body);
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

  // ============================================================================
  // SEED ADMIN
  // ============================================================================

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

  // ============================================================================
  // SEED DEFAULT CONTENT TYPES
  // ============================================================================

  router.post("/api/cms/seed-content-types", requireCmsAuth, async (req, res) => {
    try {
      const defaultTypes = [
        {
          key: "promotion_banner",
          name: "Promotion Banner",
          description: "Promotional banners displayed across the platform",
          schema: {
            heading: { type: "text", label: "Heading", required: true },
            subheading: { type: "text", label: "Subheading" },
            imageUrl: { type: "url", label: "Image URL" },
            ctaText: { type: "text", label: "CTA Button Text" },
            ctaUrl: { type: "url", label: "CTA Button URL" },
            backgroundColor: { type: "text", label: "Background Color", placeholder: "#FF5733" },
          },
        },
        {
          key: "reward_tier",
          name: "Reward Tier Description",
          description: "Describes loyalty tiers and their benefits",
          schema: {
            tierName: { type: "text", label: "Tier Name", required: true },
            description: { type: "textarea", label: "Description", required: true },
            pointsRequired: { type: "number", label: "Points Required" },
            benefits: { type: "textarea", label: "Benefits List" },
            iconUrl: { type: "url", label: "Tier Icon URL" },
            color: { type: "text", label: "Tier Color", placeholder: "#Gold" },
          },
        },
        {
          key: "legal_page",
          name: "Legal Page",
          description: "Terms, privacy policy, and other legal documents",
          schema: {
            title: { type: "text", label: "Page Title", required: true },
            body: { type: "richtext", label: "Page Content", required: true },
            effectiveDate: { type: "date", label: "Effective Date" },
          },
        },
        {
          key: "faq_entry",
          name: "FAQ Entry",
          description: "Frequently asked questions and answers",
          schema: {
            question: { type: "text", label: "Question", required: true },
            answer: { type: "richtext", label: "Answer", required: true },
            category: { type: "select", label: "Category", options: ["General", "Rewards", "Account", "Billing", "Technical"] },
            sortOrder: { type: "number", label: "Sort Order" },
          },
        },
        {
          key: "partner_logo",
          name: "Partner Logo",
          description: "Restaurant and partner logos displayed on the platform",
          schema: {
            name: { type: "text", label: "Partner Name", required: true },
            logoUrl: { type: "url", label: "Logo URL", required: true },
            websiteUrl: { type: "url", label: "Website URL" },
            featured: { type: "boolean", label: "Featured Partner" },
            sortOrder: { type: "number", label: "Display Order" },
          },
        },
        {
          key: "announcement",
          name: "Announcement",
          description: "Platform-wide announcements and notifications",
          schema: {
            title: { type: "text", label: "Title", required: true },
            message: { type: "richtext", label: "Message", required: true },
            severity: { type: "select", label: "Severity", options: ["info", "warning", "critical"], required: true },
            dismissible: { type: "boolean", label: "Can be dismissed" },
            expiresAt: { type: "date", label: "Expires At" },
          },
        },
      ];

      const created = [];
      for (const typeData of defaultTypes) {
        const existing = await storage.getContentTypeByKey(typeData.key);
        if (!existing) {
          const type = await storage.createContentType(typeData);
          created.push(type.key);
        }
      }

      res.json({ message: `Seeded ${created.length} content types`, created });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to seed content types" });
    }
  });
}

// ============================================================================
// PUBLIC HEADLESS CONTENT API (No auth required - consumed by rewards platform)
// ============================================================================

export function registerPublicContentApiRoutes(router: Router): void {
  router.get("/api/content/types", async (req, res) => {
    try {
      const types = await storage.getAllContentTypes();
      res.json(types.map(t => ({
        key: t.key,
        name: t.name,
        description: t.description,
      })));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content types" });
    }
  });

  router.get("/api/content/:typeKey", async (req, res) => {
    try {
      const { typeKey } = req.params;
      const contentType = await storage.getContentTypeByKey(typeKey);
      if (!contentType) {
        return res.status(404).json({ error: `Content type '${typeKey}' not found` });
      }

      const items = await storage.getPublishedContentItemsByType(typeKey);
      res.json({
        type: { key: contentType.key, name: contentType.name },
        items: items.map(item => ({
          slug: item.slug,
          data: item.data,
          version: item.version,
          publishedAt: item.publishedAt,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content" });
    }
  });

  router.get("/api/content/:typeKey/:slug", async (req, res) => {
    try {
      const { typeKey, slug } = req.params;
      const item = await storage.getPublishedContentItemByTypeAndSlug(typeKey, slug);
      if (!item) {
        return res.status(404).json({ error: "Content not found" });
      }

      res.json({
        slug: item.slug,
        data: item.data,
        version: item.version,
        publishedAt: item.publishedAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load content" });
    }
  });
}
