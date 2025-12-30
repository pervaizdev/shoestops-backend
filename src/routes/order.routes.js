// routes/order.routes.js
import express from "express";
import { protect, requireAdmin } from "../middleware/auth.js";
import {
  placeOrder, getMyOrders, getOrderById,
  adminListOrders, adminUpdateOrderStatus
} from "../controllers/order.controller.js";

const router = express.Router();

// user
router.use(protect);
router.post("/", placeOrder);         // POST /api/orders
router.get("/mine", getMyOrders);     // GET  /api/orders/mine
router.get("/:id", getOrderById);     // GET  /api/orders/:id

// admin
router.get("/", protect, requireAdmin, adminListOrders);                 // GET /api/orders?status=&page=
router.patch("/:id/status", protect, requireAdmin, adminUpdateOrderStatus); // PATCH /api/orders/:id/status

export default router;
