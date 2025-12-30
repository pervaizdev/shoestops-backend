export const publicUrl = (req, filename) => {
  const base =
    (process.env.BASE_URL && process.env.BASE_URL.replace(/\/$/, "")) ||
    `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${filename}`;
};
