import {
  classGroups,
  classGroupMembers,
  userExclusions,
  scheduleAssignments,
  syncLogs,
  type ClassGroup,
  type InsertClassGroup,
  type ClassGroupMember,
  type InsertClassGroupMember,
  type UserExclusion,
  type InsertUserExclusion,
  type ScheduleAssignment,
  type InsertScheduleAssignment,
  type SyncLog,
  type InsertSyncLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // Class Groups
  getClassGroups(): Promise<Array<ClassGroup & { memberCount: number; members: Array<{ authentikUserId: string }> }>>;
  getClassGroup(id: string): Promise<ClassGroup | undefined>;
  createClassGroup(group: InsertClassGroup): Promise<ClassGroup>;
  deleteClassGroup(id: string): Promise<void>;

  // Class Group Members
  getGroupMembers(classGroupId: string): Promise<ClassGroupMember[]>;
  addGroupMember(member: InsertClassGroupMember): Promise<ClassGroupMember>;
  addGroupMembers(members: InsertClassGroupMember[]): Promise<void>;
  removeGroupMember(id: string, groupId: string): Promise<void>;

  // User Exclusions
  getUserExclusions(): Promise<UserExclusion[]>;
  createUserExclusion(exclusion: InsertUserExclusion): Promise<UserExclusion>;
  deleteUserExclusion(id: string): Promise<void>;
  isUserExcluded(authentikUserId: string): Promise<boolean>;

  // Schedule Assignments
  getAllScheduleAssignments(): Promise<ScheduleAssignment[]>;
  getScheduleAssignment(id: string): Promise<ScheduleAssignment | undefined>;
  getScheduleAssignmentsForSlot(dayOfWeek: number, blockNumber: number): Promise<ScheduleAssignment[]>;
  createScheduleAssignment(assignment: InsertScheduleAssignment): Promise<ScheduleAssignment>;
  deleteScheduleAssignment(id: string): Promise<void>;

  // Sync Logs
  createSyncLog(log: InsertSyncLog): Promise<SyncLog>;
  getRecentSyncLogs(limit: number): Promise<SyncLog[]>;
}

export class DatabaseStorage implements IStorage {
  // Class Groups
  async getClassGroups(): Promise<Array<ClassGroup & { memberCount: number; members: Array<{ authentikUserId: string }> }>> {
    const groups = await db.select().from(classGroups);
    
    const groupsWithMembers = await Promise.all(
      groups.map(async (group: any) => {
        const members = await db
          .select()
          .from(classGroupMembers)
          .where(eq(classGroupMembers.classGroupId, group.id));
        
        return {
          ...group,
          memberCount: members.length,
          members: members.map((m: any) => ({ authentikUserId: m.authentikUserId })),
        };
      })
    );
    
    return groupsWithMembers;
  }

  async getClassGroup(id: string): Promise<ClassGroup | undefined> {
    const [group] = await db.select().from(classGroups).where(eq(classGroups.id, id));
    return group || undefined;
  }

  async createClassGroup(insertGroup: InsertClassGroup): Promise<ClassGroup> {
    const [group] = await db
      .insert(classGroups)
      .values(insertGroup)
      .returning();
    return group;
  }

  async deleteClassGroup(id: string): Promise<void> {
    await db.delete(classGroups).where(eq(classGroups.id, id));
  }

  // Class Group Members
  async getGroupMembers(classGroupId: string): Promise<ClassGroupMember[]> {
    return await db
      .select()
      .from(classGroupMembers)
      .where(eq(classGroupMembers.classGroupId, classGroupId));
  }

  async addGroupMember(member: InsertClassGroupMember): Promise<ClassGroupMember> {
    const [newMember] = await db
      .insert(classGroupMembers)
      .values(member)
      .returning();
    return newMember;
  }

  async addGroupMembers(members: InsertClassGroupMember[]): Promise<void> {
    if (members.length > 0) {
      await db.insert(classGroupMembers).values(members);
    }
  }

  async removeGroupMember(UserId: string, groupId: string): Promise<void> {
    console.log(`Removing user ${UserId} from group ${groupId} in storage layer`);
    await db.delete(classGroupMembers).where(
      and(
        eq(classGroupMembers.authentikUserId, UserId),
        eq(classGroupMembers.classGroupId, groupId)
      )
    );
  }

  // User Exclusions
  async getUserExclusions(): Promise<UserExclusion[]> {
    return await db.select().from(userExclusions);
  }

  async createUserExclusion(exclusion: InsertUserExclusion): Promise<UserExclusion> {
    const [newExclusion] = await db
      .insert(userExclusions)
      .values(exclusion)
      .returning();
    return newExclusion;
  }

  async deleteUserExclusion(id: string): Promise<void> {
    await db.delete(userExclusions).where(eq(userExclusions.id, id));
  }

  async isUserExcluded(authentikUserId: string): Promise<boolean> {
    const [exclusion] = await db
      .select()
      .from(userExclusions)
      .where(eq(userExclusions.authentikUserId, authentikUserId));
    return !!exclusion;
  }

  // Schedule Assignments
  async getAllScheduleAssignments(): Promise<ScheduleAssignment[]> {
    return await db.select().from(scheduleAssignments);
  }

  async getScheduleAssignment(id: string): Promise<ScheduleAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.id, id));
    return assignment || undefined;
  }

  async getScheduleAssignmentsForSlot(dayOfWeek: number, blockNumber: number): Promise<ScheduleAssignment[]> {
    return await db
      .select()
      .from(scheduleAssignments)
      .where(
        and(
          eq(scheduleAssignments.dayOfWeek, dayOfWeek),
          eq(scheduleAssignments.blockNumber, blockNumber)
        )
      );
  }

  async createScheduleAssignment(assignment: InsertScheduleAssignment): Promise<ScheduleAssignment> {
    const [newAssignment] = await db
      .insert(scheduleAssignments)
      .values(assignment)
      .returning();
    return newAssignment;
  }

  async deleteScheduleAssignment(id: string): Promise<void> {
    await db.delete(scheduleAssignments).where(eq(scheduleAssignments.id, id));
  }

  // Sync Logs
  async createSyncLog(log: InsertSyncLog): Promise<SyncLog> {
    const [newLog] = await db
      .insert(syncLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getRecentSyncLogs(limit: number): Promise<SyncLog[]> {
    return await db
      .select()
      .from(syncLogs)
      .orderBy(sql`${syncLogs.timestamp} DESC`)
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
