import { Router } from "express";
import tasksRouter from "./tasks";
import authRouter from "./auth";
import engineersRouter from "./engineer";

const router = Router();

// Route example: /api/v1/tasks
router.use("/tasks", tasksRouter);

// Route example: /api/v1/auth
router.use("/auth", authRouter);

// Route example: /api/v1/engineers
router.use("/engineers", engineersRouter);

export default router;