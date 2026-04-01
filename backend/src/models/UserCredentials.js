import mongoose from "mongoose";

const userCredentialsSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, unique: true, index: true },
    encryptedCredentials: { type: String, required: true },
    clientId: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { collection: "user_credentials", timestamps: false }
);

const UserCredentials = mongoose.model("UserCredentials", userCredentialsSchema);

export default UserCredentials;
