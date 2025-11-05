import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authentikClient } from "./authentik-client";
import { fullSync } from "./sync-service";
import {
  insertClassGroupSchema,
  insertUserExclusionSchema,
  insertScheduleAssignmentSchema,
  getGroupNameForSlot,
  LESSON_BLOCKS,
  DAYS_OF_WEEK,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // simple auth middleware
  function requireAuth(req: any, res: any, next: any) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'Not authenticated' });
  }

  app.get('/api/me', (req, res) => {
    res.json({ user: (req as any).session?.user || null });
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const users = await authentikClient.getUsers();
      const exclusions = await storage.getUserExclusions();
      const excludedIds = new Set(exclusions.map(e => e.authentikUserId));
      const students = users.filter(u => !excludedIds.has(String(u.pk)));

      const groups = await storage.getClassGroups();
      const assignments = await storage.getAllScheduleAssignments();

      // Get currently active blocks
      const now = new Date();
      const currentDay = now.getDay();
      const adjustedDay = currentDay === 0 ? -1 : currentDay === 6 ? -1 : currentDay - 1;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const activeBlocks = [];
      if (adjustedDay >= 0 && adjustedDay <= 4) {
        for (const block of LESSON_BLOCKS) {
          const [startHour, startMin] = block.start.split(':').map(Number);
          const [endHour, endMin] = block.end.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin - 15;
          const endMinutes = endHour * 60 + endMin + 15;

          if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
            const slotAssignments = await storage.getScheduleAssignmentsForSlot(adjustedDay, block.number);
            let studentCount = 0;

            for (const assignment of slotAssignments) {
              if (assignment.authentikUserId) {
                studentCount++;
              } else if (assignment.classGroupId) {
                const members = await storage.getGroupMembers(assignment.classGroupId);
                studentCount += members.length;
              }
            }

            activeBlocks.push({
              dayOfWeek: adjustedDay,
              blockNumber: block.number,
              studentCount,
            });
          }
        }
      }

      res.json({
        totalStudents: students.length,
        totalClassGroups: groups.length,
        totalAssignments: assignments.length,
        activeBlocks,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Sync status
  app.get("/api/sync/status", async (req, res) => {
    try {
      const logs = await storage.getRecentSyncLogs(10);
      const lastLog = logs[0];
      const isHealthy = !lastLog || lastLog.success;

      const now = new Date();
      const currentDay = now.getDay();
      const adjustedDay = currentDay === 0 ? -1 : currentDay === 6 ? -1 : currentDay - 1;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      let activeBlocks = 0;
      if (adjustedDay >= 0 && adjustedDay <= 4) {
        for (const block of LESSON_BLOCKS) {
          const [startHour, startMin] = block.start.split(':').map(Number);
          const [endHour, endMin] = block.end.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin - 15;
          const endMinutes = endHour * 60 + endMin + 15;

          if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
            activeBlocks++;
          }
        }
      }

      res.json({
        lastSync: lastLog?.timestamp?.toISOString() || null,
        isHealthy,
        activeBlocks,
      });
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  // Trigger a full sync on-demand
  app.post("/api/sync/full", requireAuth, async (req, res) => {
    try {
      // Start full sync asynchronously but acknowledge the request immediately
      fullSync()
        .then(() => console.log("Manual full sync completed"))
        .catch((e) => console.error("Manual full sync failed:", e));
      res.json({ success: true, message: "Full sync started" });
    } catch (error) {
      console.error("Error starting full sync:", error);
      res.status(500).json({ error: "Failed to start full sync" });
    }
  });

  // Students
  app.get("/api/students", async (req, res) => {
    try {
      const users = await authentikClient.getUsers();
      const exclusions = await storage.getUserExclusions();
      const excludedIds = new Set(exclusions.map(e => e.authentikUserId));
      const students = users.filter(u => !excludedIds.has(String(u.pk)));
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.get("/api/students/all", async (req, res) => {
    try {
      const users = await authentikClient.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Class Groups
  app.get("/api/groups", async (req, res) => {
    try {
      const groups = await storage.getClassGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const data = insertClassGroupSchema.parse(req.body);
      const group = await storage.createClassGroup(data);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating group:", error);
        res.status(500).json({ error: "Failed to create group" });
      }
    }
  });

  app.delete("/api/groups/:id", async (req, res) => {
    try {
      await storage.deleteClassGroup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  app.post("/api/groups/:id/members", async (req, res) => {
    try {
      const { studentIds } = req.body;
      if (!Array.isArray(studentIds)) {
        return res.status(400).json({ error: "studentIds must be an array" });
      }

      const members = studentIds.map(id => ({
        classGroupId: req.params.id,
        authentikUserId: id,
      }));

      await storage.addGroupMembers(members);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding group members:", error);
      res.status(500).json({ error: "Failed to add group members" });
    }
  });

  // Remove group member
  app.delete("/api/groups/:groupId/members", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { userIds } = req.body.studentIds ? { userIds: req.body.studentIds } : req.body;
      console.log(`Received request to remove users from group ${groupId}:`, userIds);
      for (const id of userIds) {
        if (typeof id !== 'string') {
          return res.status(400).json({ error: "userIds must be an array of strings" });
        }
        console.log(`Removing user ${id} from group ${groupId}`);
        await storage.removeGroupMember(id, groupId);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing group member:", error);
      res.status(500).json({ error: "Failed to remove group member" });
    }
  });

  app.delete("/api/groups/:groupId/members/:userId", async (req, res) => {
    try {
      const { groupId, userId } = req.params;
      console.log(`Removing user ${userId} from group ${groupId}`);
      await storage.removeGroupMember(userId, groupId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing group member:", error);
      res.status(500).json({ error: "Failed to remove group member" });
    } 
  });

  // User Exclusions
  app.get("/api/exclusions", async (req, res) => {
    try {
      const exclusions = await storage.getUserExclusions();
      res.json(exclusions);
    } catch (error) {
      console.error("Error fetching exclusions:", error);
      res.status(500).json({ error: "Failed to fetch exclusions" });
    }
  });

  app.post("/api/exclusions", async (req, res) => {
    try {
      const data = insertUserExclusionSchema.parse(req.body);
      const exclusion = await storage.createUserExclusion(data);
      res.json(exclusion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating exclusion:", error);
        res.status(500).json({ error: "Failed to create exclusion" });
      }
    }
  });

  app.delete("/api/exclusions/:id", async (req, res) => {
    try {
      await storage.deleteUserExclusion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting exclusion:", error);
      res.status(500).json({ error: "Failed to delete exclusion" });
    }
  });

  // Schedule Assignments
  app.get("/api/schedule", async (req, res) => {
    try {
      const assignments = await storage.getAllScheduleAssignments();
      const groups = await storage.getClassGroups();
      const users = await authentikClient.getUsers();

      // Group assignments by slot
      const scheduleData: Record<string, any> = {};

      for (const assignment of assignments) {
        const slotKey = `${assignment.dayOfWeek}-${assignment.blockNumber}`;
        
        if (!scheduleData[slotKey]) {
          scheduleData[slotKey] = { assignments: [] };
        }

        let assignmentData: any = { ...assignment };

        if (assignment.authentikUserId) {
          const user = users.find(u => String(u.pk) === assignment.authentikUserId);
          assignmentData.studentName = user?.name || user?.username;
        } else if (assignment.classGroupId) {
          const group = groups.find(g => g.id === assignment.classGroupId);
          assignmentData.groupName = group?.name;
        }

        scheduleData[slotKey].assignments.push(assignmentData);
      }

      res.json(scheduleData);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    try {
      const data = insertScheduleAssignmentSchema.parse(req.body);
      const assignment = await storage.createScheduleAssignment(data);
      res.json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating schedule assignment:", error);
        res.status(500).json({ error: "Failed to create schedule assignment" });
      }
    }
  });

  app.delete("/api/schedule/:id", async (req, res) => {
    try {
      await storage.deleteScheduleAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting schedule assignment:", error);
      res.status(500).json({ error: "Failed to delete schedule assignment" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
