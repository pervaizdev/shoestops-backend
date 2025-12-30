import User from "../models/User.js";

const ALLOWED_ROLES = ["user", "moderator", "admin"]; 

export const getAllUsers = async (req, res) => {
  try {
    // query params: ?page=1&pageSize=15&q=ali&role=user
    const page     = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize ?? "15", 10), 1), 100); 
    const q        = (req.query.q ?? "").trim();
    const role     = (req.query.role ?? "").trim().toLowerCase(); 

    // Build filter
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); 
      filter.$or = [
        { name:  rx },
        { email: rx },
        { phone: rx },
      ];
    }
    if (role && ["user", "moderator", "admin"].includes(role)) {
      filter.role = role;
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return res.json({
      success: true,
         users,
        page,
        pageSize,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
   
      
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateUserRoleByEmail = async (req, res) => {
  try {
    // req.user is available because route uses protect + requireRole('admin')
    let { email, role } = req.body;
    if (!email || !role) {
      return res.status(400).json({ success: false, message: "email and role are required" });
    }

    email = String(email).trim().toLowerCase();
    role  = String(role).trim().toLowerCase();

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: { role } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      message: "User role updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (err) {
    console.error("Error updating user role:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteUserByEmail = async (req, res) => {
  try {
    const requester = req.user;                 // from protect()
    const { email }  = req.params;

    // Find target user
    const target = await User.findOne({ email: String(email).toLowerCase() });
    if (!target) return res.status(404).json({ success: false, message: "User not found" });

    // Optional: prevent self-deletion
    if (String(target._id) === String(requester._id)) {
      return res.status(403).json({ success: false, message: "You cannot delete your own account" });
    }

    // Role-based deletion policy
    // - moderators can delete only 'user'
    // - only admin can delete 'moderator' or 'admin'
    if (requester.role === "moderator" && target.role !== "user") {
      return res.status(403).json({ success: false, message: "Moderators can delete only user accounts" });
    }
    // admins can delete anyone (except the optional self-block above)

    await User.deleteOne({ _id: target._id });

    return res.json({
      success: true,
      message: `Deleted ${target.email} (${target.role}) successfully`,
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
