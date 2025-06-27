// routes/tasks.ts - Updated with optimized endpoints and availability checks
import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { z } from "zod";
import { authenticateToken, requireManager } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// Function to update task statuses based on time slots
const updateTaskStatuses = async () => {
  try {
    const currentTime = new Date();
    
    // Get all active tasks
    const activeTasks = await prisma.task.findMany({
      where: {
        status: 'ACTIVE'
      }
    });

    const tasksToComplete = [];

    for (const task of activeTasks) {
      const timeSlots = task.timeSlots as Array<{startDateTime: string, endDateTime: string}>;
      
      // Check if all time slots are in the past
      const allSlotsInPast = timeSlots.every(slot => {
        const endDateTime = new Date(slot.endDateTime);
        return endDateTime <= currentTime;
      });

      if (allSlotsInPast && timeSlots.length > 0) {
        tasksToComplete.push(task.id);
      }
    }

    // Update tasks to COMPLETED status
    if (tasksToComplete.length > 0) {
      await prisma.task.updateMany({
        where: {
          id: { in: tasksToComplete }
        },
        data: {
          status: 'COMPLETED'
        }
      });

      console.log(`Updated ${tasksToComplete.length} tasks to COMPLETED status`);
    }

    return tasksToComplete.length;
  } catch (error) {
    console.error('Error updating task statuses:', error);
    return 0;
  }
};

// Function to check if engineers are available during specified time slots
const checkEngineersAvailability = async (engineerIds: string[], timeSlots: Array<{startDateTime: string, endDateTime: string}>) => {
  if (engineerIds.length === 0) return { available: true, conflicts: [] };

  // Get all active tasks that involve any of the specified engineers
  const conflictingTasks = await prisma.task.findMany({
    where: {
      status: 'ACTIVE',
      assignedTo: {
        hasSome: engineerIds
      }
    },
    select: {
      id: true,
      project: true,
      assignedTo: true,
      timeSlots: true
    }
  });

  const conflicts = [];

  // Check each requested time slot against existing tasks
  for (const requestedSlot of timeSlots) {
    const requestedStart = new Date(requestedSlot.startDateTime);
    const requestedEnd = new Date(requestedSlot.endDateTime);

    for (const task of conflictingTasks) {
      const taskTimeSlots = task.timeSlots as Array<{startDateTime: string, endDateTime: string}>;
      
      for (const taskSlot of taskTimeSlots) {
        const taskStart = new Date(taskSlot.startDateTime);
        const taskEnd = new Date(taskSlot.endDateTime);
        
        // Check for overlap: tasks overlap if start1 < end2 && start2 < end1
        if (requestedStart < taskEnd && taskStart < requestedEnd) {
          // Find which specific engineers have conflicts
          const conflictingEngineers = task.assignedTo.filter(id => engineerIds.includes(id));
          
          conflicts.push({
            taskId: task.id,
            taskProject: task.project,
            conflictingEngineers,
            conflictTimeSlot: {
              existing: {
                start: taskStart.toISOString(),
                end: taskEnd.toISOString()
              },
              requested: {
                start: requestedStart.toISOString(),
                end: requestedEnd.toISOString()
              }
            }
          });
        }
      }
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts
  };
};

// Validation schemas
const createTaskSchema = z.object({
  project: z.string().min(1, "Project is required"),
  timeSlots: z.array(z.object({
    startDateTime: z.string(),
    endDateTime: z.string()
  })).min(1, "At least one time slot is required"),
  assignedTo: z.array(z.string()).default([]), // Array of user IDs (0 to n)
  contactNo: z.string().min(1, "Contact number is required"),
  priority: z.enum(["HIGH", "NORMAL"]).default("NORMAL"),
  remarks: z.string().optional().default("")
});

// POST /api/v1/tasks - Create new task with availability check (Manager only)
router.post("/", authenticateToken, requireManager, async (req: any, res: any) => {
  try {
    const taskData = createTaskSchema.parse(req.body);
    const createdById = req.user.id;

    // Validate time slots
    for (const slot of taskData.timeSlots) {
      const startDate = new Date(slot.startDateTime);
      const endDate = new Date(slot.endDateTime);
      
      if (startDate >= endDate) {
        return res.status(400).json({ 
          error: "End time must be after start time for all time slots" 
        });
      }
      
      if (startDate < new Date()) {
        return res.status(400).json({ 
          error: "Start time cannot be in the past" 
        });
      }
    }

    // Validate assigned users exist and are engineers
    if (taskData.assignedTo.length > 0) {
      const assignedUsers = await prisma.user.findMany({
        where: {
          id: { in: taskData.assignedTo },
          role: 'ENGINEER'
        }
      });

      if (assignedUsers.length !== taskData.assignedTo.length) {
        return res.status(400).json({ 
          error: "One or more assigned users not found or not engineers" 
        });
      }

      // Check engineer availability during specified time slots
      const availabilityCheck = await checkEngineersAvailability(taskData.assignedTo, taskData.timeSlots);
      
      if (!availabilityCheck.available) {
        return res.status(409).json({ 
          error: "One or more engineers are not available during the specified time slots",
          conflicts: availabilityCheck.conflicts
        });
      }
    }

    // Determine initial status based on time slots
    const currentTime = new Date();
    const allSlotsInPast = taskData.timeSlots.every(slot => {
      const endDateTime = new Date(slot.endDateTime);
      return endDateTime <= currentTime;
    });

    const initialStatus = allSlotsInPast ? 'COMPLETED' : 'ACTIVE';

    // Create task
    const task = await prisma.task.create({
      data: {
        project: taskData.project,
        timeSlots: taskData.timeSlots,
        assignedTo: taskData.assignedTo,
        contactNo: taskData.contactNo,
        priority: taskData.priority,
        remarks: taskData.remarks,
        status: initialStatus,
        createdById
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    console.error("Create task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/tasks/my-tasks - Get tasks assigned to current user (Engineers)
router.get("/my-tasks", authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    // Build where clause for filtering
    let whereClause: any = {
      assignedTo: {
        has: userId // PostgreSQL array contains check
      }
    };

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }

    // Fetch tasks assigned to current user
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // ACTIVE first, then COMPLETED
        { createdAt: 'desc' }
      ]
    });

    // Enhance tasks with assigned user details (useful for engineers working in teams)
    const tasksWithAssignedUsers = await Promise.all(
      tasks.map(async (task) => {
        if (task.assignedTo && task.assignedTo.length > 0) {
          const assignedUsers = await prisma.user.findMany({
            where: {
              id: { in: task.assignedTo }
            },
            select: {
              id: true,
              name: true,
              username: true
            }
          });
          
          return {
            ...task,
            assignedUsers
          };
        }
        
        return {
          ...task,
          assignedUsers: []
        };
      })
    );

    res.json({
      success: true,
      tasks: tasksWithAssignedUsers
    });

  } catch (error) {
    console.error("Get my tasks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/tasks - Get all tasks (Managers/Admins)
router.get("/", authenticateToken, async (req: any, res: any) => {
  try {
    const { status } = req.query;
    
    const whereClause = status ? { status } : {};
    
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Enhance tasks with assigned user details
    const tasksWithAssignedUsers = await Promise.all(
      tasks.map(async (task) => {
        if (task.assignedTo && task.assignedTo.length > 0) {
          const assignedUsers = await prisma.user.findMany({
            where: {
              id: { in: task.assignedTo }
            },
            select: {
              id: true,
              name: true,
              username: true
            }
          });
          
          return {
            ...task,
            assignedUsers
          };
        }
        
        return {
          ...task,
          assignedUsers: []
        };
      })
    );

    res.json({
      success: true,
      tasks: tasksWithAssignedUsers
    });

  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/tasks/:id - Get single task
router.get("/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get assigned user details
    let assignedUsers: any = [];
    if (task.assignedTo && task.assignedTo.length > 0) {
      assignedUsers = await prisma.user.findMany({
        where: {
          id: { in: task.assignedTo }
        },
        select: {
          id: true,
          name: true,
          username: true
        }
      });
    }

    const taskWithAssignedUsers = {
      ...task,
      assignedUsers
    };

    res.json({
      success: true,
      task: taskWithAssignedUsers
    });

  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/v1/tasks/:id - Update task with availability check and completed task protection
router.put("/:id", authenticateToken, requireManager, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const updateData = createTaskSchema.partial().parse(req.body);

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Prevent editing completed tasks
    if (existingTask.status === 'COMPLETED') {
      return res.status(400).json({ 
        error: "Cannot edit completed tasks. Completed tasks are read-only." 
      });
    }

    // Validate assigned users if provided
    if (updateData.assignedTo && updateData.assignedTo.length > 0) {
      const assignedUsers = await prisma.user.findMany({
        where: {
          id: { in: updateData.assignedTo },
          role: 'ENGINEER'
        }
      });

      if (assignedUsers.length !== updateData.assignedTo.length) {
        return res.status(400).json({ 
          error: "One or more assigned users not found or not engineers" 
        });
      }

      // Check engineer availability if time slots are being updated
      const timeSlots = updateData.timeSlots || existingTask.timeSlots;
      const availabilityCheck = await checkEngineersAvailability(
        updateData.assignedTo, 
        timeSlots as Array<{startDateTime: string, endDateTime: string}>
      );
      
      if (!availabilityCheck.available) {
        // Filter out conflicts with the current task being updated
        const relevantConflicts = availabilityCheck.conflicts.filter(conflict => conflict.taskId !== id);
        
        if (relevantConflicts.length > 0) {
          return res.status(409).json({ 
            error: "One or more engineers are not available during the specified time slots",
            conflicts: relevantConflicts
          });
        }
      }
    }

    // Determine status based on time slots if time slots are being updated
    let statusUpdate = {};
    if (updateData.timeSlots) {
      const currentTime = new Date();
      const allSlotsInPast = updateData.timeSlots.every(slot => {
        const endDateTime = new Date(slot.endDateTime);
        return endDateTime <= currentTime;
      });

      statusUpdate = { status: allSlotsInPast ? 'COMPLETED' : 'ACTIVE' };
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...updateData,
        ...statusUpdate
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: "Task updated successfully",
      task: updatedTask
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    console.error("Update task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/v1/tasks/update-statuses - Manual endpoint to update all task statuses
router.put("/update-statuses", authenticateToken, async (req: any, res: any) => {
  try {
    const updatedCount = await updateTaskStatuses();
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} tasks to COMPLETED status`
    });
  } catch (error) {
    console.error("Manual status update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/v1/tasks/:id - Delete task with completed task protection
router.delete("/:id", authenticateToken, requireManager, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Prevent deleting completed tasks
    if (task.status === 'COMPLETED') {
      return res.status(400).json({ 
        error: "Cannot delete completed tasks. Completed tasks are read-only for record keeping." 
      });
    }

    await prisma.task.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "Task deleted successfully"
    });

  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;