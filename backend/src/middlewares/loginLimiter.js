import { rateLimit } from "express-rate-limit";

// 30 login/oauth attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many login attempts. Please try again in 15 minutes." },
  keyGenerator: (req) => req.ip,
});
