import mongoose from "mongoose";

const appConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
  },
  { collection: "app_config", timestamps: false }
);

appConfigSchema.statics.getConfig = async function (key) {
  const doc = await this.findOne({ key });
  if (!doc) throw new Error(`Config key '${key}' missing. Run: node scripts/generate_secrets.js`);
  return doc.value;
};

appConfigSchema.statics.setConfig = async function (key, value) {
  await this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};

const AppConfig = mongoose.model("AppConfig", appConfigSchema);
export default AppConfig;
