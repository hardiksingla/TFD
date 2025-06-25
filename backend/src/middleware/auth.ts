// middleware/auth.ts
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name?: string;
        role: string;
      };
    }
  }
}

// Middleware to verify JWT token
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = user;
    next();
  });
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

// Middleware to check if user is engineer, manager, or admin
export const requireAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ error: "Authentication required" });
    return;
  }
  next();
};