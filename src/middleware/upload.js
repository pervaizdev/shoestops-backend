// src/middleware/upload.js
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

// -------------------------
// 🔹 Cloudinary Config
// -------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------------
// 🔹 Local DEV Upload Folder
// -------------------------
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!isProd && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function fileFilter(_req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image uploads are allowed"), false);
  }
  cb(null, true);
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const memoryStorage = multer.memoryStorage();
const storage = isProd ? memoryStorage : diskStorage;

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Middleware to set Cloudinary folder
export const setUploadFolder = (folderName) => (req, _res, next) => {
  req.uploadFolder = folderName;
  next();
};

// -------------------------
// 🔥 processImage Middleware
// -------------------------
export async function processImage(req, _res, next) {
  try {
    if (!req.file) return next();

    // -------------------------
    // 🔥 PRODUCTION → Cloudinary
    // -------------------------
    if (isProd) {
      const folder = req.uploadFolder || "misc";

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      // 🔹 Debug logs (you asked for this)
      console.log("PUBLIC ID:", result.public_id);
      console.log("FULL URL:", result.secure_url);

      // 🔹 Save BOTH values
      req.imagePublicId = result.public_id; // e.g. trending/abc123
      req.imageUrl = result.secure_url;     // FULL Cloudinary URL

      return next();
    }

    // -------------------------
    // 🔧 DEVELOPMENT → Local file system
    // -------------------------
    req.imagePublicId = null;
    req.imageUrl = `/uploads/${req.file.filename}`; // local path

    next();
  } catch (err) {
    next(err);
  }
}
