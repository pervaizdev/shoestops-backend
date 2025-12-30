import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";

const SALT_ROUNDS = 12;

export const createUserAndEmailToken = async ({ name, email, phone, password }) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const passwordHash = await bcrypt.hash(password, salt);

  const emailVerifyToken = crypto.randomBytes(32).toString("hex");
  const emailVerifyTokenHash = crypto.createHash("sha256").update(emailVerifyToken).digest("hex");
  const expiresMin = Number(process.env.EMAIL_TOKEN_EXPIRES_MIN || 60);
  const emailVerifyTokenExpiresAt = new Date(Date.now() + expiresMin * 60 * 1000);

  const user = await User.create({
    name,
    email,
    phone,
    passwordHash,
    role: "user",
    isEmailVerified: false,
    emailVerifyTokenHash,
    emailVerifyTokenExpiresAt
  });

  return { user, emailVerifyToken }; // return plaintext token only for email link
};

export const verifyEmailToken = async ({ userId, token }) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    _id: userId,
    emailVerifyTokenHash: tokenHash,
    emailVerifyTokenExpiresAt: { $gt: new Date() }
  });

  if (!user) return null;

  user.isEmailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyTokenExpiresAt = undefined;
  await user.save();

  return user;
};

export const validatePassword = async (plain, hash) => bcrypt.compare(plain, hash);
