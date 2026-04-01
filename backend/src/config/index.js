import "dotenv/config";

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
export const MONGO_URI = process.env.MONGO_URI;

// These are loaded from the DB after connection - see configLoader.js
export let ENCRYPTION_KEY = null;

export function setSecrets({ encryption_key }) {
  ENCRYPTION_KEY = encryption_key;
}
