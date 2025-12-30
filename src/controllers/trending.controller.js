// controllers/trending.controller.js
import { v2 as cloudinary } from "cloudinary";
import Trending from "../models/trending.js";
import { uniqueSlug, escapeRegex } from "../utils/slugs.js";
import fs from "fs/promises";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

/**
 * Safely delete an image
 * - PROD: deletes from Cloudinary using public_id
 * - DEV: deletes local file from uploads folder
 */
async function removeImageSafe(imageName) {
  if (!imageName) return;

  if (isProd) {
    try {
      await cloudinary.uploader.destroy(imageName);
    } catch (err) {
      console.error("Cloudinary delete failed:", err.message);
    }
  } else {
    try {
      const filePath = path.join(process.cwd(), "uploads", imageName);
      await fs.unlink(filePath);
    } catch {
      // ignore missing file
    }
  }
}

// POST /api/trending
export const createTrending = async (req, res) => {
  try {
    const { heading = "", subheading = "", btnText = "" } = req.body ?? {};

    if (!req.file && !req.imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    if (!heading.trim() || !subheading.trim() || !btnText.trim()) {
      return res.status(400).json({
        success: false,
        message: "All text fields are required",
      });
    }

    const slug = await uniqueSlug(Trending, heading.trim());

    const imageUrl = isProd ? req.imageUrl : req.file.filename;
    const imageName = isProd ? req.imagePublicId : req.file.filename;

    const doc = await Trending.create({
      heading: heading.trim(),
      subheading: subheading.trim(),
      btnText: btnText.trim(),
      slug,
      imageUrl,
      imageName,
    });

    return res.status(201).json({
      success: true,
      message: "Trending item created",
      data: doc,
    });
  } catch (err) {
    console.error(err);

    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({
        success: false,
        message: `Duplicate ${field}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/trending
export const getAllTrending = async (_req, res) => {
  try {
    const items = await Trending.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/trending/:slug
export const getTrendingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const doc = await Trending.findOne({
      slug: { $regex: `^${escapeRegex(slug)}$`, $options: "i" },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    return res.json({
      success: true,
      data: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Invalid slug",
    });
  }
};

// PUT /api/trending/:slug
export const updateTrendingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const doc = await Trending.findOne({
      slug: { $regex: `^${escapeRegex(slug)}$`, $options: "i" },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const { heading, subheading, btnText } = req.body ?? {};

    if (typeof heading === "string" && heading.trim()) {
      const trimmed = heading.trim();

      const exists = await Trending.exists({
        _id: { $ne: doc._id },
        heading: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Heading already exists",
        });
      }

      doc.heading = trimmed;
      doc.slug = await uniqueSlug(Trending, trimmed, String(doc._id));
    }

    if (typeof subheading === "string" && subheading.trim()) {
      doc.subheading = subheading.trim();
    }

    if (typeof btnText === "string" && btnText.trim()) {
      doc.btnText = btnText.trim();
    }

    // Image replacement
    if (req.file || req.imageUrl) {
      await removeImageSafe(doc.imageName);

      doc.imageUrl = isProd ? req.imageUrl : req.file.filename;
      doc.imageName = isProd ? req.imagePublicId : req.file.filename;
    }

    await doc.save();

    return res.json({
      success: true,
      message: "Trending item updated",
      data: doc,
    });
  } catch (err) {
    console.error(err);

    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({
        success: false,
        message: `Duplicate ${field}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update item",
    });
  }
};

// DELETE /api/trending/:slug
export const deleteTrendingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const doc = await Trending.findOne({
      slug: { $regex: `^${escapeRegex(slug)}$`, $options: "i" },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    // delete image FIRST
    await removeImageSafe(doc.imageName);

    await doc.deleteOne();

    return res.json({
      success: true,
      message: "Trending item deleted",
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Failed to delete item",
    });
  }
};
