// controllers/mostsales.controller.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import MostSales from "../models/mostsales.js";
import { uniqueSlug, escapeRegex } from "../utils/slugs.js";

const isProd = process.env.NODE_ENV === "production";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "..", "uploads");

/* =========================
   SAFE IMAGE DELETE
========================= */
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
      const fullPath = path.join(uploadsRoot, imageName);
      await fs.unlink(fullPath);
    } catch {
      // ignore missing file
    }
  }
}

/* =========================
   CREATE
========================= */
export const createMostSales = async (req, res) => {
  try {
    const { heading = "", subheading = "", btnText = "" } = req.body ?? {};

    if (!heading.trim() || !subheading.trim() || !btnText.trim()) {
      return res.status(400).json({
        success: false,
        message: "All text fields are required",
      });
    }

    if (!req.file && !req.imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const exists = await MostSales.exists({
      heading: {
        $regex: `^${escapeRegex(heading.trim())}$`,
        $options: "i",
      },
    });

    if (exists) {
      if (isProd && req.imagePublicId) {
        await removeImageSafe(req.imagePublicId);
      }
      return res.status(409).json({
        success: false,
        message: "Heading already exists",
      });
    }

    const slug = await uniqueSlug(MostSales, heading.trim());

    const imageUrl = isProd ? req.imageUrl : req.file.filename;
    const imageName = isProd ? req.imagePublicId : req.file.filename;

    const doc = await MostSales.create({
      heading: heading.trim(),
      subheading: subheading.trim(),
      btnText: btnText.trim(),
      slug,
      imageUrl,
      imageName,
    });

    return res.status(201).json({
      success: true,
      message: "Most Sales item added",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    if (isProd && req.imagePublicId) {
      await removeImageSafe(req.imagePublicId);
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
export const getAllMostSales = async (_req, res) => {
  try {
    const items = await MostSales.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: items });
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
export const getMostSalesBySlug = async (req, res) => {
  try {
    const doc = await MostSales.findOne({
      slug: { $regex: `^${escapeRegex(req.params.slug)}$`, $options: "i" },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Not found",
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
export const updateMostSalesBySlug = async (req, res) => {
  try {
    const doc = await MostSales.findOne({
      slug: { $regex: `^${escapeRegex(req.params.slug)}$`, $options: "i" },
    });

    if (!doc) {
      if (isProd && req.imagePublicId) {
        await removeImageSafe(req.imagePublicId);
      }
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const { heading, subheading, btnText } = req.body ?? {};

    if (typeof heading === "string" && heading.trim()) {
      const trimmed = heading.trim();
      const exists = await MostSales.exists({
        _id: { $ne: doc._id },
        heading: {
          $regex: `^${escapeRegex(trimmed)}$`,
          $options: "i",
        },
      });

      if (exists) {
        if (isProd && req.imagePublicId) {
          await removeImageSafe(req.imagePublicId);
        }
        return res.status(409).json({
          success: false,
          message: "Heading already exists",
        });
      }

      doc.heading = trimmed;
      doc.slug = await uniqueSlug(MostSales, trimmed, String(doc._id));
    }

    if (typeof subheading === "string" && subheading.trim()) {
      doc.subheading = subheading.trim();
    }

    if (typeof btnText === "string" && btnText.trim()) {
      doc.btnText = btnText.trim();
    }

    if (req.file || req.imageUrl) {
      await removeImageSafe(doc.imageName);

      doc.imageUrl = isProd ? req.imageUrl : req.file.filename;
      doc.imageName = isProd ? req.imagePublicId : req.file.filename;
    }

    await doc.save();

    return res.json({
      success: true,
      message: "Most Sales item updated",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    if (isProd && req.imagePublicId) {
      await removeImageSafe(req.imagePublicId);
    }
    return res.status(500).json({
      success: false,
      message: "Failed to update item",
    });
  }
};

/* =========================
   DELETE
========================= */
export const deleteMostSalesBySlug = async (req, res) => {
  try {
    const doc = await MostSales.findOne({
      slug: { $regex: `^${escapeRegex(req.params.slug)}$`, $options: "i" },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    await removeImageSafe(doc.imageName);
    await doc.deleteOne();

    return res.json({
      success: true,
      message: "Most Sales item deleted",
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Failed to delete item",
    });
  }
};
