import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, unique: true },
    displayName: { type: String, default: null },
    bio: { type: String, default: null },
    avatarDriveFileId: { type: String, default: null },
    avatarAccountIndex: { type: Number, default: null },
    avatarMimeType: { type: String, default: null },
  },
  { collection: "profiles", timestamps: false }
);

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
