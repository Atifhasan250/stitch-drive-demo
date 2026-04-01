import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import AppConfig from "../src/models/AppConfig.js";

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error("MONGO_URI is required to generate DB-backed secrets.");
  process.exit(1);
}

const encryptionKey = crypto.randomBytes(32).toString("base64");

try {
  await mongoose.connect(mongoUri);
  await AppConfig.setConfig("encryption_key", encryptionKey);
  console.log("Stored new encryption_key in app_config.");
  console.log("STATE_SECRET is env-based now. Generate one with:");
  console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
} catch (err) {
  console.error("Failed to generate secrets:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
