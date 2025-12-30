// controllers/cart.controller.js
import Cart from "../models/Cart.js";
import Product from "../models/product.js";

const MAX_QTY = 10;

/* =========================
   HELPERS
========================= */
const computeTotalsFromItems = (items) => {
  const totalItems = items.reduce((acc, it) => acc + it.qty, 0);
  const subtotal = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  return { totalItems, subtotal };
};

/* =========================
   ADD TO CART
========================= */
// POST /api/cart/add
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, slug, qty = 1, size = "" } = req.body ?? {};

    if (!productId && !slug) {
      return res.status(400).json({
        success: false,
        message: "productId or slug is required",
      });
    }

    const quantity = Math.min(Math.max(Number(qty) || 1, 1), MAX_QTY);

    const product = productId
      ? await Product.findById(productId).lean()
      : await Product.findOne({ slug }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (size && product.sizes?.length && !product.sizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size selection",
      });
    }

    // Atomic upsert
    const update = {
      $inc: { "items.$[line].qty": quantity },
    };

    const options = {
      arrayFilters: [
        { "line.product": product._id, "line.size": size || "" },
      ],
      new: true,
    };

    let cart = await Cart.findOneAndUpdate(
      { user: userId, "items.product": product._id, "items.size": size || "" },
      update,
      options
    );

    // If item didn't exist, push new line
    if (!cart) {
      cart = await Cart.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            items: {
              product: product._id,
              slug: product.slug,
              title: product.title,
              imageUrl: product.imageUrl,
              price: product.price,
              size: size || "",
              qty: quantity,
            },
          },
        },
        { new: true, upsert: true }
      );
    }

    const totals = computeTotalsFromItems(cart.items);
    return res.status(200).json({
      success: true,
      cart,
      ...totals,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   GET CART
========================= */
// GET /api/cart
export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).lean();

    if (!cart) {
      return res.json({
        success: true,
        cart: { items: [] },
        totalItems: 0,
        subtotal: 0,
      });
    }

    const totals = computeTotalsFromItems(cart.items);
    return res.json({
      success: true,
      cart,
      ...totals,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   UPDATE CART ITEM
========================= */
// PATCH /api/cart/item/:itemId
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { qty, size } = req.body ?? {};

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    if (qty !== undefined) {
      const q = Number(qty);
      if (Number.isNaN(q) || q < 1 || q > MAX_QTY) {
        return res.status(400).json({
          success: false,
          message: "Invalid quantity",
        });
      }
      item.qty = q;
    }

    if (size !== undefined) {
      const product = await Product.findById(item.product).lean();
      if (size && product?.sizes?.length && !product.sizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: "Invalid size selection",
        });
      }
      item.size = size || "";
    }

    await cart.save();
    const totals = computeTotalsFromItems(cart.items);

    return res.json({
      success: true,
      cart,
      ...totals,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   REMOVE ITEM
========================= */
// DELETE /api/cart/item/:itemId
export const removeCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    item.deleteOne();
    await cart.save();

    const totals = computeTotalsFromItems(cart.items);
    return res.json({
      success: true,
      cart,
      ...totals,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   CLEAR CART
========================= */
// POST /api/cart/clear
export const clearCart = async (req, res) => {
  try {
    await Cart.updateOne(
      { user: req.user._id },
      { $set: { items: [] } }
    );

    return res.json({
      success: true,
      cart: { items: [] },
      totalItems: 0,
      subtotal: 0,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
