// routes/mostsales.routes.js
import express from "express";
import {
  upload,
  processImage,
  setUploadFolder,
} from "../middleware/upload.js";
import {
  createMostSales,
  getAllMostSales,
  getMostSalesBySlug,
  updateMostSalesBySlug,
  deleteMostSalesBySlug,
} from "../controllers/mostsales.controller.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Create (slug-based)
router.post(
  "/",
  protect,
  requireAdmin,
  setUploadFolder("mostsales"), // 👈 Cloudinary folder name
  upload.single("image"),
  processImage,
  createMostSales
);

// Get all
router.get("/", getAllMostSales);

// Get one by slug
router.get("/:slug", getMostSalesBySlug);

// Update by slug
router.put(
  "/:slug",
  protect,
  requireAdmin,
  setUploadFolder("mostsales"),
  upload.single("image"),
  processImage,
  updateMostSalesBySlug
);

// Delete by slug
router.delete("/:slug", protect, requireAdmin, deleteMostSalesBySlug);

export default router;
