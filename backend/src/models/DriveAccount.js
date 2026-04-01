import mongoose from "mongoose";

const driveAccountSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    accountIndex: { type: Number, required: true },
    email: { type: String, default: null },
    refreshToken: { type: String, default: null },
    accessToken: { type: String, default: null },
    tokenExpiry: { type: Date, default: null },
    isConnected: { type: Boolean, default: false, required: true },
    tempCredentials: { type: String, default: null },
  },
  { collection: "drive_accounts", timestamps: false }
);

// Unique per user, not globally
driveAccountSchema.index({ ownerId: 1, accountIndex: 1 }, { unique: true });

const DriveAccount = mongoose.model("DriveAccount", driveAccountSchema);
export default DriveAccount;
