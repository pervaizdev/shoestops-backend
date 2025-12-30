// routes/product.routes.js
import express from "express";
import {
  upload,
  processImage,
  setUploadFolder,
} from "../middleware/upload.js";
import {
  createProduct,
  getAllProducts,
  getProductBySlug,
  updateProductBySlug,
  deleteProductBySlug,
  // getProductById, updateProductById, deleteProductById  // if you use legacy later
} from "../controllers/product.controller.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// CREATE product
router.post(
  "/",
  protect,
  requireAdmin,               // 👈 if only admins can create products; if not, remove this
  setUploadFolder("products"), // 👈 Cloudinary folder name
  upload.single("image"),
  processImage,                // 👈 populates req.imagePath / req.imageUrl
  createProduct
);

// READ all products
router.get("/", getAllProducts);

// READ one product by slug
router.get("/:slug", getProductBySlug);

// UPDATE product by slug
router.put(
  "/:slug",
  protect,
  requireAdmin,
  setUploadFolder("products"),
  upload.single("image"),
  processImage,
  updateProductBySlug
);

// DELETE product by slug
router.delete("/:slug", protect, requireAdmin, deleteProductBySlug);

// (Optional) If you ever add legacy ID routes, they'd look like:
// router.get("/id/:id", getProductById);
// router.put(
//   "/id/:id",
//   protect,
//   requireAdmin,
//   setUploadFolder("products"),
//   upload.single("image"),
//   processImage,
//   updateProductById
// );
// router.delete("/id/:id", protect, requireAdmin, deleteProductById);

export default router;
