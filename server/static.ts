import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  const dinerDistPath = path.resolve(__dirname, "public-diner");
  const adminDistPath = path.resolve(__dirname, "public-admin");
  
  const portalMode = process.env.PORTAL_MODE;
  
  if (portalMode === "diner") {
    if (!fs.existsSync(dinerDistPath)) {
      throw new Error(`Could not find diner build directory: ${dinerDistPath}`);
    }
    app.use(express.static(dinerDistPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(dinerDistPath, "diner.html"));
    });
    return;
  }
  
  if (portalMode === "admin") {
    if (!fs.existsSync(adminDistPath)) {
      throw new Error(`Could not find admin build directory: ${adminDistPath}`);
    }
    app.use(express.static(adminDistPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(adminDistPath, "admin.html"));
    });
    return;
  }
  
  const hasSeparateBuilds = fs.existsSync(dinerDistPath) && fs.existsSync(adminDistPath);
  const hasUnifiedBuild = fs.existsSync(distPath);
  
  if (!hasSeparateBuilds && !hasUnifiedBuild) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  if (hasSeparateBuilds) {
    app.use("/admin", express.static(adminDistPath));
    app.use(express.static(dinerDistPath));
    
    app.use("/admin/*", (_req, res) => {
      res.sendFile(path.resolve(adminDistPath, "admin.html"));
    });
    
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(dinerDistPath, "diner.html"));
    });
  } else {
    app.use(express.static(distPath));
    
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
}
