import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildServer() {
  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  await buildServer();
}

async function buildDiner() {
  await rm("dist/public-diner", { recursive: true, force: true });

  console.log("building diner portal...");
  await viteBuild({ configFile: "vite.config.diner.ts" });
}

async function buildAdmin() {
  await rm("dist/public-admin", { recursive: true, force: true });

  console.log("building admin portal...");
  await viteBuild({ configFile: "vite.config.admin.ts" });
}

async function buildSeparate() {
  await rm("dist", { recursive: true, force: true });

  await buildDiner();
  await buildAdmin();
  await buildServer();
}

const buildType = process.argv[2];

if (buildType === "diner") {
  buildDiner().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (buildType === "admin") {
  buildAdmin().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (buildType === "separate") {
  buildSeparate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  buildAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
