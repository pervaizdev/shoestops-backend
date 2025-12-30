// controllers/feature.controller.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import Feature from "../models/feature.js";
import { publicUrl } from "../utils/publicUrl.js";
import { uniqueSlug, escapeRegex } from "../utils/slugs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "..", "uploads");

/* =========================
   SAFE FILE DELETE (LOCAL)
========================= */
async function removeFileSafe(filename) {
  if (!filename) return;
  try {
    const fullPath = path.join(uploadsRoot, filename);
    await fs.unlink(fullPath);
  } catch {
    // ignore if file doesn't exist
  }
}

/* =========================
   CREATE
========================= */
export const createFeature = async (req, res) => {
  try {
    const {
      sub = "",
      title = "",
      price,
      sizes = [],
      description = "",
    } = req.body ?? {};

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    if (!title.trim() || price === undefined || !description.trim()) {
      await removeFileSafe(req.file.filename);
      return res.status(400).json({
        success: false,
        message: "Title, price and description are required",
      });
    }

    if (Number(price) < 0) {
      await removeFileSafe(req.file.filename);
      return res.status(400).json({
        success: false,
        message: "Price must be ≥ 0",
      });
    }

    const exists = await Feature.exists({
      title: { $regex: `^${escapeRegex(title.trim())}$`, $options: "i" },
    });

    if (exists) {
      await removeFileSafe(req.file.filename);
      return res.status(409).json({
        success: false,
        message: "Title already exists",
      });
    }

    const slug = await uniqueSlug(Feature, title.trim());

    const normalizedSizes = Array.isArray(sizes)
      ? sizes
      : typeof sizes === "string"
      ? sizes.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    const doc = await Feature.create({
      sub: sub.trim(),
      title: title.trim(),
      price: Number(price),
      sizes: normalizedSizes,
      description: description.trim(),
      slug,
      imageName: req.file.filename,
      imageUrl: publicUrl(req, req.file.filename),
    });

    return res.status(201).json({
      success: true,
      message: "Feature created",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    if (req?.file?.filename) await removeFileSafe(req.file.filename);

    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate feature",
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
export const getAllFeatures = async (_req, res) => {
  try {
    const items = await Feature.find()
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
export const getFeatureBySlug = async (req, res) => {
  try {
    const doc = await Feature.findOne({
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
export const updateFeatureBySlug = async (req, res) => {
  try {
    const doc = await Feature.findOne({
      slug: { $regex: `^${escapeRegex(req.params.slug)}$`, $options: "i" },
    });

    if (!doc) {
      if (req?.file?.filename) await removeFileSafe(req.file.filename);
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const { sub, title, price, sizes, description } = req.body ?? {};

    if (typeof title === "string" && title.trim()) {
      const trimmed = title.trim();
      const exists = await Feature.exists({
        _id: { $ne: doc._id },
        title: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
      });

      if (exists) {
        if (req?.file?.filename) await removeFileSafe(req.file.filename);
        return res.status(409).json({
          success: false,
          message: "Title already exists",
        });
      }

      doc.title = trimmed;
      doc.slug = await uniqueSlug(Feature, trimmed, String(doc._id));
    }

    if (typeof sub === "string") doc.sub = sub.trim();
    if (typeof description === "string" && description.trim()) {
      doc.description = description.trim();
    }

    if (price !== undefined) {
      const p = Number(price);
      if (Number.isNaN(p) || p < 0) {
        if (req?.file?.filename) await removeFileSafe(req.file.filename);
        return res.status(400).json({
          success: false,
          message: "Price must be a number ≥ 0",
        });
      }
      doc.price = p;
    }

    if (sizes !== undefined) {
      doc.sizes = Array.isArray(sizes)
        ? sizes
        : typeof sizes === "string"
        ? sizes.split(",").map(s => s.trim()).filter(Boolean)
        : [];
    }

    if (req.file) {
      await removeFileSafe(doc.imageName);
      doc.imageName = req.file.filename;
      doc.imageUrl = publicUrl(req, req.file.filename);
    }

    await doc.save();

    return res.json({
      success: true,
      message: "Feature updated",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    if (req?.file?.filename) await removeFileSafe(req.file.filename);

    return res.status(500).json({
      success: false,
      message: "Failed to update feature",
    });
  }
};

/* =========================
   DELETE
========================= */
export const deleteFeatureBySlug = async (req, res) => {
  try {
    const doc = await Feature.findOne({
      slug: { $regex: `^${escapeRegex(req.params.slug)}$`, $options: "i" },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    await removeFileSafe(doc.imageName);
    await doc.deleteOne();

    return res.json({
      success: true,
      message: "Feature deleted",
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Failed to delete feature",
    });
  }
};
