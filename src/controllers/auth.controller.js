import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import transporter from "../config/mailer.js";
import { generateToken } from "../utils/generateToken.js";
import { emailTemplate } from "../utils/emailTemplates.js";

// ---------------- LOGIN ----------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation → 400
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Your email is not registered yet",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isVerified) {
      await sendVerificationEmail(user, req, res);
      return res.status(403).json({
        success: false,
        message:
          "Email not verified. A new verification email has been sent to your inbox.",
      });
    }

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified, // ✅ added field here
      },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// ---------------- REGISTER ----------------
export const register = async (req, res) => {
  try {
    // ❌ do NOT accept role from body
    const { name, email, phone, password } = req.body;

    // Conflict → 409
    let user = await User.findOne({ email: String(email).toLowerCase() });
    if (user) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      password: hashedPassword,
      // role is omitted → defaults to "user" by schema
    });

    await sendVerificationEmail(user, req, res);

    return res.status(201).json({
      success: true,
      message: "User registered successfully. Verification email sent!",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};

// ---------------- SEND VERIFICATION ----------------
const sendVerificationEmail = async (user, req, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  // If your frontend handles the route, keep CLIENT_URL.
  // If the backend verifies directly, prefer SERVER_URL hitting this API.
  const verifyURL = `https://wohoo-3495d51dbaaf.herokuapp.com/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: `"Auth System" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: "Verify your email",
    html: emailTemplate(user, verifyURL),
  };

  await transporter.sendMail(mailOptions);
};

// ---------------- VERIFY EMAIL ----------------
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or invalid token",
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
      });
    }

    user.isVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Invalid or expired verification token",
    });
  }
};

// ---------------- forget password ----------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "No user found with that email" });

    // Create reset token valid for 15 minutes
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const resetURL = `${process.env.SERVER_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Auth System" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>Hello ${user.name},</p>
        <p>Click below to reset your password (valid for 15 minutes):</p>
        <a href="${resetURL}">${resetURL}</a>
        <p>If you didn’t request this, you can ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Password reset email sent successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to send reset email",
      error: err.message,
    });
  }
};

// ---------------- RESET PASSWORD ----------------
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res
        .status(400)
        .json({ success: false, message: "Token and new password required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ success: false, message: "Invalid token or user not found" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password reset successful!" });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset token",
      error: err.message,
    });
  }
};

export const me = async (req, res) => {
  try {
    // req.user.id is set by the auth middleware
    const user = await User.findById(req.user.id)
      .select("-password") // hide password
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user, // { _id, name, email, phone, role, isVerified, createdAt, updatedAt }
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error", error: err.message });
  }
};

