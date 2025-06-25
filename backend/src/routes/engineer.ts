// routes/engineers.ts - Engineer availability endpoints (updated)
import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// Validation schema for checking availability
const availabilitySchema = z.object({
  timeSlots: z.array(z.object({
    startDateTime: z.string(),
    endDateTime: z.string()
  })).min(1, "At least one time slot is required")
});

// POST /api/v1/engineers/available - Get available engineers for given time slots
router.post("/available", authenticateToken, async (req:any, res:any) => {
  try {
    const { timeSlots } = availabilitySchema.parse(req.body);

    // Get all engineers (users with role ENGINEER)
    const allEngineers = await prisma.user.findMany({
      where: {
        role: 'ENGINEER'
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true
      }
    });

    // Find engineers who are busy during the specified time slots
    const busyEngineers = new Set();

    // Get all active tasks
    const activeTasks = await prisma.task.findMany({
      where: {
        status: 'ACTIVE'
      },
      select: {
        assignedTo: true,
        timeSlots: true
      }
    });

    // Check for conflicts with existing tasks
    for (const task of activeTasks) {
      if (!task.assignedTo || task.assignedTo.length === 0) continue;
      
      const taskTimeSlots = task.timeSlots as Array<{startDateTime: string, endDateTime: string}>;
      
      // Check if any task time slot overlaps with requested time slots
      for (const taskSlot of taskTimeSlots) {
        const taskStart = new Date(taskSlot.startDateTime);
        const taskEnd = new Date(taskSlot.endDateTime);
        
        for (const requestedSlot of timeSlots) {
          const requestedStart = new Date(requestedSlot.startDateTime);
          const requestedEnd = new Date(requestedSlot.endDateTime);
          
          // Check for overlap
          if (taskStart < requestedEnd && taskEnd > requestedStart) {
            // Time slots overlap, mark assigned engineers as busy
            task.assignedTo.forEach(engineerId => busyEngineers.add(engineerId));
          }
        }
      }
    }

    // Filter out busy engineers
    const availableEngineers = allEngineers.filter(engineer => 
      !busyEngineers.has(engineer.id)
    );

    res.json({
      success: true,
      engineers: availableEngineers,
      message: `Found ${availableEngineers.length} available engineers out of ${allEngineers.length} total engineers`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    console.error("Get available engineers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/engineers - Get all engineers
router.get("/", authenticateToken, async (req:any, res:any) => {
  try {
    const engineers = await prisma.user.findMany({
      where: {
        role: 'ENGINEER'
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      engineers
    });

  } catch (error) {
    console.error("Get engineers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;