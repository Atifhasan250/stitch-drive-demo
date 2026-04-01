// Quick script to clean up duplicate accounts
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function cleanup() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✓ Connected to MongoDB");

        const db = mongoose.connection.db;

        // Show all accounts
        const accounts = await db.collection("drive_accounts").find({}).toArray();
        console.log("\n📋 Current accounts:");
        accounts.forEach(acc => {
            console.log(`  - Owner: ${acc.ownerId}, Index: ${acc.accountIndex}, Connected: ${acc.isConnected}, Email: ${acc.email || 'none'}`);
        });

        // Delete all accounts (uncomment to enable)
        // const result = await db.collection("drive_accounts").deleteMany({});
        // console.log(`\n✓ Deleted ${result.deletedCount} accounts`);

        // Or delete only disconnected accounts with no data (uncomment to enable)
        const cleanResult = await db.collection("drive_accounts").deleteMany({
            isConnected: false,
            email: null,
            refreshToken: null
        });
        console.log(`\n✓ Cleaned ${cleanResult.deletedCount} incomplete accounts`);

        await mongoose.disconnect();
        console.log("\n✓ Done!");
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

cleanup();
