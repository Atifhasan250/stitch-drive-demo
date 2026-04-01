import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    driveFileId: { type: String, required: true },
    accountIndex: { type: Number, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: null },
    thumbnailLink: { type: String, default: null },
    parentDriveFileId: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "files", timestamps: false }
);

fileSchema.index({ ownerId: 1, driveFileId: 1, accountIndex: 1 });
fileSchema.index({ ownerId: 1, accountIndex: 1 });

const File = mongoose.model("File", fileSchema);
export default File;
