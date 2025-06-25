// services/taskStatusService.ts
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

interface TaskStatusServiceStatus {
  isRunning: boolean;
  intervalId: NodeJS.Timeout | null;
}

export class TaskStatusService {
  private intervalId: NodeJS.Timeout | null;
  private isRunning: boolean;

  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  // Update task statuses based on time slots
  async updateTaskStatuses(): Promise<number> {
    try {
      const currentTime = new Date();
      
      // Get all active tasks
      const activeTasks = await prisma.task.findMany({
        where: {
          status: 'ACTIVE'
        }
      });

      const tasksToComplete: string[] = [];

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
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        });

        console.log(`[${new Date().toISOString()}] Updated ${tasksToComplete.length} tasks to COMPLETED status`);
      }

      return tasksToComplete.length;
    } catch (error) {
      console.error('Error updating task statuses:', error);
      return 0;
    }
  }

  // Start the scheduled task status updates
  startScheduledUpdates(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.log('Task status service is already running');
      return;
    }

    console.log(`Starting task status service with ${intervalMinutes} minute intervals`);
    
    // Run immediately
    this.updateTaskStatuses();
    
    // Then run every N minutes
    this.intervalId = setInterval(() => {
      this.updateTaskStatuses();
    }, intervalMinutes * 60 * 1000);
    
    this.isRunning = true;
  }

  // Stop the scheduled updates
  stopScheduledUpdates(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('Task status service stopped');
    }
  }

  // Get service status
  getStatus(): TaskStatusServiceStatus {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId
    };
  }
}

// Create singleton instance
export const taskStatusService = new TaskStatusService();