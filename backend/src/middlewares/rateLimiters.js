import { rateLimit } from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ownerId || req.ip,
  message: { detail: "Too many requests. Please slow down." },
  skip: (req) => req.method === "GET" && req.path.includes("/thumbnail"),
});

export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ownerId || req.ip,
  message: { detail: "Download rate limit exceeded. Please wait." },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ownerId || req.ip,
  message: { detail: "Upload rate limit exceeded. Please wait." },
});
