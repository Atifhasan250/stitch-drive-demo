import AppConfig from "../models/AppConfig.js";
import { ENCRYPTION_KEY, setSecrets } from "../config/index.js";

export async function loadSecretsFromDB() {
  try {
    if (ENCRYPTION_KEY) {
      console.log("[Config] ENCRYPTION_KEY loaded from environment.");
      return;
    }

    const encryptionKey = await AppConfig.getConfig("encryption_key");
    if (!encryptionKey) {
      throw new Error("Missing encryption_key in AppConfig.");
    }
    setSecrets({
      encryption_key: encryptionKey,
    });
    console.log("[Config] Secrets loaded from database.");
  } catch (err) {
    console.error("[Config] Failed to load secrets:", err.message);
    process.exit(1);
  }
}
