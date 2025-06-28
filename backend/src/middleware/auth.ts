// backend/src/middleware/auth.ts
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        name: string;
        role: string;
      };
    }
  }
}

// Interface for JWT payload
interface JWTPayload {
  id: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Middleware to verify JWT token AND check database
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }

    // Verify JWT token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    // Check if user still exists in database and get current data
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        updatedAt: true
      }
    });

    if (!user) {
      res.status(403).json({ 
        error: "User no longer exists. Please login again." 
      });
      return;
    }

    // Check if user's role in token matches current role in database
    if (user.role !== decoded.role) {
      res.status(403).json({ 
        error: "User role has changed. Please login again." 
      });
      return;
    }

    // Check if username in token matches current username in database
    if (user.username !== decoded.username) {
      res.status(403).json({ 
        error: "User credentials have changed. Please login again." 
      });
      return;
    }

    // Optional: Check if token was issued before last password change
    // You could add a 'lastPasswordChange' field to your User model to track this
    // const tokenIssuedAt = new Date((decoded.iat || 0) * 1000);
    // if (user.lastPasswordChange && tokenIssuedAt < user.lastPasswordChange) {
    //   res.status(403).json({ 
    //     error: "Password has been changed. Please login again." 
    //   });
    //   return;
    // }

    // Set user data from database (current/fresh data)
    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };

    next();

  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ error: "Authentication service error" });
  }
};

// Middleware to check if user is admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};

// Middleware to check if user is manager or admin
export const requireManager = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN')) {
    res.status(403).json({ error: "Manager or Admin access required" });
    return;
  }
  next();
};

// Middleware to check if user is engineer (for engineer-specific endpoints)
export const requireEngineer = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'ENGINEER') {
    res.status(403).json({ error: "Engineer access required" });
    return;
  }
  next();
};

// Middleware to check if user is authenticated (any valid role)
export const requireAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

// Middleware to check if user can access engineer data (engineer themselves, or manager/admin)
export const requireEngineerAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { engineerId } = req.params;
  const isAdmin = req.user.role === 'ADMIN';
  const isManager = req.user.role === 'MANAGER';
  const isSameEngineer = req.user.role === 'ENGINEER' && req.user.id === engineerId;

  if (!isAdmin && !isManager && !isSameEngineer) {
    res.status(403).json({ 
      error: "Access denied. You can only access your own data or need manager/admin privileges." 
    });
    return;
  }
  
  next();
};