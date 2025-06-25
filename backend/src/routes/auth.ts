// routes/auth.ts
import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// Admin credentials stored in code
const ADMIN_CREDENTIALS = {
  id: "admin",
  password: "admin123", // You should change this
  role: "ADMIN"
};

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// routes/auth.ts - Updated for username field and admin password update

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

const createUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["MANAGER", "ENGINEER"], {
    errorMap: () => ({ message: "Role must be MANAGER or ENGINEER" })
  })
});

// POST /api/v1/auth/login - Updated for username
router.post("/login", async (req:any, res:any) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    // Check if it's admin login (stored in code)
    if (username === ADMIN_CREDENTIALS.id) {
      if (password === ADMIN_CREDENTIALS.password) {
        const token = jwt.sign(
          { 
            id: ADMIN_CREDENTIALS.id, 
            username: ADMIN_CREDENTIALS.id,
            name: "Administrator",
            role: ADMIN_CREDENTIALS.role 
          },
          JWT_SECRET
        );
        
        return res.json({
          success: true,
          token,
          user: {
            id: ADMIN_CREDENTIALS.id,
            username: ADMIN_CREDENTIALS.id,
            name: "Administrator",
            role: ADMIN_CREDENTIALS.role
          }
        });
      } else {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    }

    // Check database for regular users using username
    const user = await prisma.user.findFirst({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        name: user.name,
        role: user.role 
      },
      JWT_SECRET
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/v1/auth/users - Create new user (Updated for username)
router.post("/users", authenticateToken, requireAdmin, async (req:any, res:any) => {
  try {
    const { username, name, password, role } = createUserSchema.parse(req.body);

    // Check if username already exists
    const existingUser = await prisma.user.findFirst({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        role: role as "MANAGER" | "ENGINEER"
      }
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: newUser
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/auth/users - Get all users (Updated to include username)
router.get("/users", authenticateToken, requireAdmin, async (req:any, res:any) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/v1/auth/password - Update own password (requires current password)
router.put("/password", authenticateToken, async (req:any, res:any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: "Current password and new password are required" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "New password must be at least 6 characters" 
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/v1/auth/users/:id/password - Admin update user password (no current password required)
router.put("/users/:id/password", authenticateToken, requireAdmin, async (req:any, res:any) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Validation
    if (!newPassword) {
      return res.status(400).json({ 
        error: "New password is required" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "New password must be at least 6 characters" 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: "User password updated successfully"
    });

  } catch (error) {
    console.error("Admin password update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/v1/auth/users/:id - Delete user (Admin only)
router.delete("/users/:id", authenticateToken, requireAdmin, async (req:any, res:any) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/auth/me - Get current user info
router.get("/me", authenticateToken, (req:any, res:any) => {
  res.json({
    success: true,
    user: req.user
  });
});

export default router;