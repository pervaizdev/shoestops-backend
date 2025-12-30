import express from "express";
import { protect } from "../middleware/auth.js";
import {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";

const router = express.Router();
const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");  // browser must re-fetch each time
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

// All cart routes require auth (per-user carts)
router.use(protect);

router.get("/", noStore, getCart);
router.post("/add", noStore, addToCart);
router.patch("/item/:itemId", noStore, updateCartItem);
router.delete("/item/:itemId", noStore, removeCartItem);
router.post("/clear", noStore, clearCart);


export default router;
