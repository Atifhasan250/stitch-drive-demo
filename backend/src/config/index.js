import "dotenv/config";

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
export const MONGO_URI = process.env.MONGO_URI;
export const STATE_SECRET = process.env.STATE_SECRET || null;

// Allow env override while keeping DB-backed compatibility.
export let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;

export function setSecrets({ encryption_key }) {
  if (!ENCRYPTION_KEY && encryption_key) {
    ENCRYPTION_KEY = encryption_key;
  }
}
