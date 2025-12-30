export const slugify = (str) =>
  str
    .toString()
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");

export async function uniqueSlug(Model, base, excludeId) {
  const root = slugify(base);
  let candidate = root;
  let i = 1;

  const conflict = async (slug) =>
    Model.exists(excludeId ? { _id: { $ne: excludeId }, slug } : { slug });

  while (await conflict(candidate)) {
    i += 1;
    candidate = `${root}-${i}`;
  }
  return candidate;
}
