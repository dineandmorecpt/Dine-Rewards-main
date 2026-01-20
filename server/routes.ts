import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerAuthRoutes } from "./routes/auth";
import { registerDinerRoutes } from "./routes/diners";
import { registerDinerApiRoutes } from "./routes/diner-api";
import { registerRestaurantRoutes } from "./routes/restaurants";
import { registerVoucherRoutes } from "./routes/vouchers";
import { registerTransactionRoutes } from "./routes/transactions";
import { registerReconciliationRoutes } from "./routes/reconciliation";
import { registerInvitationRoutes } from "./routes/invitations";
import { registerAdminApiRoutes } from "./routes/admin-api";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Register auth routes
  registerAuthRoutes(app);
  
  // Register diner routes
  registerDinerRoutes(app);
  
  // Register diner API routes (consumer-specific, session-based)
  registerDinerApiRoutes(app);
  
  // Register restaurant routes
  registerRestaurantRoutes(app);
  
  // Register voucher routes
  registerVoucherRoutes(app);
  
  // Register transaction routes
  registerTransactionRoutes(app);
  
  // Register reconciliation routes
  registerReconciliationRoutes(app);
  
  // Register invitation routes
  registerInvitationRoutes(app);
  
  // Register admin API routes (consumer-specific, session-based for admins)
  registerAdminApiRoutes(app);

  return httpServer;
}
