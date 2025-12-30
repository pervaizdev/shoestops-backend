import jwt from "jsonwebtoken";
import User from "../models/User.js";

// 1️⃣ Verify token & attach user
export const protect = async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid token user" });

    req.user = user; // attach the user to the request
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

// 2️⃣ Generic role guard
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "contact admin to access the data" });
    }
    next();
  };

// 3️⃣ Specific "admin-only" guard
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Access denied: admin only" });
  }
  next();
};
