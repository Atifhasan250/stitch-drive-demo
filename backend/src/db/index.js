import mongoose from "mongoose";
import { MONGO_URI } from "../config/index.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      // Keep connections alive — avoids reconnect latency on idle Atlas clusters
      socketTimeoutMS: 45000,
      // Connection pool — allows concurrent queries without queuing
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    isConnected = true;
    console.log("[DB] Connected to MongoDB:", MONGO_URI.replace(/:\/\/.*@/, "://<credentials>@"));
  } catch (err) {
    console.error("[DB] Connection error:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] MongoDB disconnected — will auto-reconnect.");
    isConnected = false;
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[DB] MongoDB reconnected.");
    isConnected = true;
  });
}

export default mongoose;