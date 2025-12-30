// controllers/product.controller.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import Product from "../models/product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "..", "uploads");

const isProd = process.env.NODE_ENV === "production";

/* =========================
   IMAGE DELETE (SAFE)
========================= */
async function removeImageSafe(imageName) {
  if (!imageName) return;

  if (isProd) {
    try {
      // imageName MUST be Cloudinary public_id
      await cloudinary.uploader.destroy(imageName);
    } catch (err) {
      console.error("Cloudinary delete failed:", err.message);
    }
  } else {
    try {
      const fullPath = path.join(uploadsRoot, imageName);
      await fs.unlink(fullPath);
    } catch {
      // ignore missing file
    }
  }
}

/* =========================
   SLUG HELPERS
========================= */
function toSlug(input = "") {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlugForTitle(title, currentId = null) {
  const base = toSlug(title) || "product";
  let slug = base;
  let i = 1;

  while (true) {
    const exists = await Product.findOne({ slug });
    if (!exists || (currentId && exists._id.equals(currentId))) break;
    slug = `${base}-${++i}`;
  }
  return slug;
}

/* =========================
   CREATE
========================= */
export const createProduct = async (req, res) => {
  try {
    const {
      sub = "",
      title = "",
      price,
      description = "",
      sizes,
      isBestSelling,
    } = req.body ?? {};

    if (!req.file && !req.imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    if (!title.trim() || price === undefined || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "title, price and description are required",
      });
    }

    // sizes normalization
    let sizesArr = [];
    if (Array.isArray(sizes)) {
      sizesArr = sizes;
    } else if (typeof sizes === "string" && sizes.trim()) {
      try {
        const parsed = JSON.parse(sizes);
        sizesArr = Array.isArray(parsed)
          ? parsed
          : sizes.split(",").map(s => s.trim()).filter(Boolean);
      } catch {
        sizesArr = sizes.split(",").map(s => s.trim()).filter(Boolean);
      }
    }

    const slug = await uniqueSlugForTitle(title);

    const imageUrl = isProd ? req.imageUrl : req.file.filename;
    const imageName = isProd ? req.imagePublicId : req.file.filename;

    const doc = await Product.create({
      sub: sub.trim(),
      title: title.trim(),
      price: Number(price),
      sizes: sizesArr,
      description: description.trim(),
      imageUrl,
      imageName,
      slug,
      isBestSelling:
        typeof isBestSelling === "string"
          ? isBestSelling === "true"
          : Boolean(isBestSelling),
    });

    return res.status(201).json({
      success: true,
      message: "Product created",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate product",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================
   READ ALL
========================= */
export const getAllProducts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 9), 9);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.bestSelling !== undefined) {
      filter.isBestSelling = req.query.bestSelling === "true";
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================
   READ ONE
========================= */
export const getProductBySlug = async (req, res) => {
  try {
    const doc = await Product.findOne({ slug: req.params.slug });
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    return res.json({ success: true, data: doc });
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid slug",
    });
  }
};

/* =========================
   UPDATE
========================= */
export const updateProductBySlug = async (req, res) => {
  try {
    const doc = await Product.findOne({ slug: req.params.slug });
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { sub, title, price, description, sizes, isBestSelling } = req.body ?? {};

    if (typeof sub === "string") doc.sub = sub.trim();

    if (typeof title === "string" && title.trim()) {
      doc.title = title.trim();
      doc.slug = await uniqueSlugForTitle(doc.title, doc._id);
    }

    if (price !== undefined && !Number.isNaN(Number(price))) {
      doc.price = Number(price);
    }

    if (typeof description === "string" && description.trim()) {
      doc.description = description.trim();
    }

    if (sizes !== undefined) {
      if (Array.isArray(sizes)) {
        doc.sizes = sizes;
      } else if (typeof sizes === "string") {
        try {
          const parsed = JSON.parse(sizes);
          doc.sizes = Array.isArray(parsed)
            ? parsed
            : sizes.split(",").map(s => s.trim()).filter(Boolean);
        } catch {
          doc.sizes = sizes.split(",").map(s => s.trim()).filter(Boolean);
        }
      }
    }

    if (isBestSelling !== undefined) {
      doc.isBestSelling =
        typeof isBestSelling === "string"
          ? isBestSelling === "true"
          : Boolean(isBestSelling);
    }

    // image replacement
    if (req.file || req.imageUrl) {
      await removeImageSafe(doc.imageName);

      doc.imageUrl = isProd ? req.imageUrl : req.file.filename;
      doc.imageName = isProd ? req.imagePublicId : req.file.filename;
    }

    await doc.save();

    return res.json({
      success: true,
      message: "Product updated",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

/* =========================
   DELETE
========================= */
export const deleteProductBySlug = async (req, res) => {
  try {
    const doc = await Product.findOne({ slug: req.params.slug });
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await removeImageSafe(doc.imageName);
    await doc.deleteOne();

    return res.json({
      success: true,
      message: "Product deleted",
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};
