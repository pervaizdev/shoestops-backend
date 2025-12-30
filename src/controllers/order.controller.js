// controllers/order.controller.js
import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/product.js";
import Order from "../models/order.js";

// helper
const computeCartTotals = (items) => {
  const subtotal = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  return { subtotal };
};

// POST /api/orders (place order)
// Body: { shippingAddress: {...}, billingAddress?: {...}, paymentMethod?: "COD"|"CARD"|"BANK", checkoutToken?: string }
export const placeOrder = async (req, res) => {
  const userId = req.user._id;
  const {
    shippingAddress,
    billingAddress,
    paymentMethod = "COD",
    checkoutToken, // optional idempotency key from client
  } = req.body || {};

  if (!shippingAddress?.fullName || !shippingAddress?.phone || !shippingAddress?.line1 ||
      !shippingAddress?.city || !shippingAddress?.province) {
    return res.status(400).json({ success: false, message: "Incomplete shipping address" });
  }

  // Idempotency: if a request with the same checkoutToken already created an order, return it
  if (checkoutToken) {
    const existing = await Order.findOne({ user: userId, checkoutToken }).lean();
    if (existing) return res.status(200).json({ success: true, order: existing, idempotent: true });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: userId }).session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // (Optional) validate stock & latest prices
    for (const it of cart.items) {
      const p = await Product.findById(it.product).session(session);
      if (!p) {
        throw new Error(`Product removed: ${it.title}`);
      }
      // Validate size if product.sizes enforced
      if (it.size && p.sizes?.length && !p.sizes.includes(it.size)) {
        throw new Error(`Invalid size on ${p.title}`);
      }
      // Optional: enforce stock
      if (typeof p.stock === "number" && p.stock < it.qty) {
        throw new Error(`Insufficient stock for ${p.title}`);
      }
    }

    // (Optional) reprice at checkout if you want the *current* price instead of snapshot
    const repricedItems = [];
    for (const it of cart.items) {
      const p = await Product.findById(it.product).session(session);
      const priceToUse = it.price; // or p.price for live reprice
      repricedItems.push({
        product: it.product,
        slug: it.slug,
        title: it.title,
        imageUrl: it.imageUrl,
        price: priceToUse,
        size: it.size || "",
        qty: it.qty,
      });
    }

    const { subtotal } = computeCartTotals(repricedItems);
    const shippingFee = 0; // plug your logic (city-based, weight-based, etc.)
    const discount = 0;    // plug your coupons/points
    const total = subtotal + shippingFee - discount;

    // Generate a human-friendly order number (e.g., YYMMDD-XXXX)
    const today = new Date();
    const y = String(today.getFullYear()).slice(-2);
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const orderNo = `${y}${m}${d}-${rnd}`;

    const orderDoc = await Order.create([{
      orderNo,
      user: userId,
      items: repricedItems,
      subtotal,
      shippingFee,
      discount,
      total,
      currency: "PKR",
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "unpaid" : "unpaid", // set to 'paid' after gateway webhook
      status: "created",
      checkoutToken: checkoutToken || undefined,
    }], { session });

    // Decrement stock (optional)
    for (const it of repricedItems) {
      await Product.updateOne(
        { _id: it.product },
        { $inc: { stock: -it.qty } },
        { session }
      );
    }

    // Clear cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ success: true, order: orderDoc[0] });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(400).json({ success: false, message: err.message || "Checkout failed" });
  }
};

// controllers/order.controller.js (more handlers)

// GET /api/orders/mine  -> list current user's orders
export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, orders });
};

// GET /api/orders/:id -> single order details (owner or admin)
export const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  // If not admin, ensure the order belongs to the user
  if (!req.user.isAdmin && String(order.user._id) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  res.json({ success: true, order });
};

// (ADMIN) GET /api/admin/orders?status=created&page=1&pageSize=20
export const adminListOrders = async (req, res) => {
  try {
    const { status = "", q = "", page = 1, limit = 20 } = req.query;

    const query = {};

    // Status filter (exact match)
    if (status) query.status = status;

    // Search filter
    if (q) {
      const or = [];

      // Try orderNo as number
      const qNum = Number(q);
      if (!Number.isNaN(qNum)) {
        or.push({ orderNo: qNum });
      }

      // Try orderNo as string (in case you store it as string)
      or.push({ orderNo: q });

      // Try _id full match
      if (mongoose.isValidObjectId(q)) {
        or.push({ _id: q });
      } else {
        // Optional: “starts with” _id (use cautiously; not indexed)
        // only add if q looks like hex
        if (/^[a-fA-F0-9]{3,24}$/.test(q)) {
          or.push({ _id: { $regex: `^${q}`, $options: "i" } });
        }
      }

      // Optional: search by customer name (uncomment if needed)
      // or.push({ "shippingAddress.fullName": { $regex: q, $options: "i" } });

      query.$or = or;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * perPage)
        .limit(perPage)
        .lean(),
      Order.countDocuments(query),
    ]);

    return res.json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        limit: perPage,
        total,
        pages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to list orders",
    });
  }
};
// (ADMIN) PATCH /api/admin/orders/:id/status  { status }
export const adminUpdateOrderStatus = async (req, res) => {
 
  const { status } = req.body;
  const allowed = ["created", "confirmed", "packed", "shipped", "delivered", "canceled"];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true }
  );
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  // Optional: if canceled, restock items
  // if (status === "canceled") { ... }

  res.json({ success: true, order });
};
