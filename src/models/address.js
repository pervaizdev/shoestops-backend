// models/address.js (optional if you want multiple saved addresses)
import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  line1: { type: String, required: true },
  line2: { type: String, default: "" },
  city: { type: String, required: true },
  province: { type: String, required: true }, // e.g., Balochistan/Sindh/Punjab/...
  postalCode: { type: String, default: "" },
  country: { type: String, default: "PK" },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Address", addressSchema);
