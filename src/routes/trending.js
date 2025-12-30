import express from "express";
import {
  upload,
  processImage,
  setUploadFolder,
} from "../middleware/upload.js";
import {
  createTrending,
  getAllTrending,
  getTrendingBySlug,
  updateTrendingBySlug,
  deleteTrendingBySlug,
} from "../controllers/trending.controller.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Create trending item
router.post(
  "/",
  protect,
  requireAdmin,
  setUploadFolder("trending"),       // 👈 goes into Cloudinary "trending" folder in prod
  upload.single("image"),
  processImage,
  createTrending
);

// Get all
router.get("/", getAllTrending);

// Get one by slug
router.get("/:slug", getTrendingBySlug);

// Update by slug
router.put(
  "/:slug",
  protect,
  requireAdmin,
  setUploadFolder("trending"),
  upload.single("image"),
  processImage,
  updateTrendingBySlug
);

// Delete by slug
router.delete("/:slug", protect, requireAdmin, deleteTrendingBySlug);

export default router;
