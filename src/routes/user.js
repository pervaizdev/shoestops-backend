import express from "express";
import { getAllUsers, updateUserRoleByEmail, deleteUserByEmail } from "../controllers/user.controller.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();


router.get("/all",    protect, requireRole("admin", "moderator"), getAllUsers);
router.patch("/role", protect, requireRole("admin"), updateUserRoleByEmail);
router.delete("/:email", protect, requireRole("admin","moderator"), deleteUserByEmail);   

// router.get("/all",protect, getAllUsers);
// router.patch("/role", updateUserRoleByEmail);
// router.delete("/:email" , deleteUserByEmail);   


// {
//     "email":"muhammadpervaiz1250@gmail.com",
//     "password":"testing123@"
// }


export default router;
