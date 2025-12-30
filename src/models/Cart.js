import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    slug: { type: String, required: true },           // snapshot for quick lookup
    title: { type: String, required: true },          // snapshot
    imageUrl: { type: String, required: true },       // snapshot
    price: { type: Number, required: true, min: 0 },  // snapshot (price at add time)
    size: { type: String, default: "" },              // optional size selection
    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: true, timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Cart", cartSchema);
