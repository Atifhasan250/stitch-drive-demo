import "dotenv/config";
import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";

import { connectDB } from "./db/index.js";
import { loadSecretsFromDB } from "./utils/configLoader.js";
import { syncFilesFromDrives } from "./services/driveService.js";
import { FRONTEND_URL } from "./config/index.js";


import accountsRoutes from "./routes/accounts.js";
import filesRoutes from "./routes/files.js";
import profileRoutes from "./routes/profile.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8000;
const IS_PROD = process.env.NODE_ENV === "production";

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Request logger ────────────────────────────────────────────────────────────
app.use(morgan(IS_PROD ? "combined" : "dev"));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  ...new Set([
    "http://localhost:3000",
    "http://192.168.137.1:3000",
    "https://atifs-drive.vercel.app",
    FRONTEND_URL,
  ].filter(Boolean)),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Credentials"],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Clerk authentication ──────────────────────────────────────────────────────
app.use(clerkMiddleware());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/accounts", accountsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/profile", profileRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ message: "StitchDrive API is running", status: "active" }));
app.get("/active", (req, res) => res.json({ status: "active" }));

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);



// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  await loadSecretsFromDB();

  // Pre-warming tokens is now per-user, we just initialize DB.

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Server] StitchDrive API running on http://0.0.0.0:${PORT} (${IS_PROD ? "production" : "development"})`
    );
  });
}

bootstrap();