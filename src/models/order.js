// models/order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  imageUrl: { type: String, required: true },
  price: { type: Number, required: true }, // snapshot at checkout
  size: { type: String, default: "" },
  qty: { type: Number, required: true, min: 1 },
}, { _id: false });

const addressSnapshotSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  line1: { type: String, required: true },
  line2: { type: String, default: "" },
  city: { type: String, required: true },
  province: { type: String, required: true },
  postalCode: { type: String, default: "" },
  country: { type: String, default: "PK" },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, unique: true, index: true }, // human friendly
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
  shippingFee: { type: Number, required: true, default: 0 },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true }, // subtotal + shipping - discount
  currency: { type: String, default: "PKR" },

  shippingAddress: { type: addressSnapshotSchema, required: true },
  billingAddress: { type: addressSnapshotSchema }, // optional (can default to shipping)

  paymentMethod: { type: String, enum: ["COD", "CARD", "BANK"], default: "COD" },
  paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },

  status: {
    type: String,
    enum: ["created", "confirmed", "packed", "shipped", "delivered", "canceled"],
    default: "created"
  },

  // Optional: idempotency to avoid duplicate orders on refresh
  checkoutToken: { type: String, index: true },

}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
