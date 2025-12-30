// routes/features.routes.js
import express from "express";
import { upload } from "../middleware/upload.js"; // same multer you already use
import {
  createFeature,
  getAllFeatures,
  getFeatureBySlug,
  updateFeatureBySlug,
  deleteFeatureBySlug,
} from "../controllers/feature.controller.js";

const router = express.Router();

// CRUD via slug
router.post("/", upload.single("image"), createFeature);
router.get("/", getAllFeatures);
router.get("/:slug", getFeatureBySlug);
router.put("/:slug", upload.single("image"), updateFeatureBySlug);
router.delete("/:slug", deleteFeatureBySlug);

export default router;
