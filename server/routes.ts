import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerAuthRoutes } from "./routes/auth";
import { registerDinerRoutes } from "./routes/diners";
import { registerRestaurantRoutes } from "./routes/restaurants";
import { registerVoucherRoutes } from "./routes/vouchers";
import { registerTransactionRoutes } from "./routes/transactions";
import { registerReconciliationRoutes } from "./routes/reconciliation";
import { registerInvitationRoutes } from "./routes/invitations";

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

  return httpServer;
}
