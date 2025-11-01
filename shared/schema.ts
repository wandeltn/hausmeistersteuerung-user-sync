import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Class groups (reusable student collections)
export const classGroups = pgTable("class_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClassGroupSchema = createInsertSchema(classGroups).omit({
  id: true,
  createdAt: true,
});

export type ClassGroup = typeof classGroups.$inferSelect;
export type InsertClassGroup = z.infer<typeof insertClassGroupSchema>;

// Class group members (students in each group)
export const classGroupMembers = pgTable("class_group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classGroupId: varchar("class_group_id").notNull().references(() => classGroups.id, { onDelete: "cascade" }),
  authentikUserId: text("authentik_user_id").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertClassGroupMemberSchema = createInsertSchema(classGroupMembers).omit({
  id: true,
  addedAt: true,
});

export type ClassGroupMember = typeof classGroupMembers.$inferSelect;
export type InsertClassGroupMember = z.infer<typeof insertClassGroupMemberSchema>;

// User exclusions (non-student accounts to hide from interface)
export const userExclusions = pgTable("user_exclusions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authentikUserId: text("authentik_user_id").notNull().unique(),
  reason: text("reason"),
  excludedAt: timestamp("excluded_at").defaultNow().notNull(),
});

export const insertUserExclusionSchema = createInsertSchema(userExclusions).omit({
  id: true,
  excludedAt: true,
});

export type UserExclusion = typeof userExclusions.$inferSelect;
export type InsertUserExclusion = z.infer<typeof insertUserExclusionSchema>;

// Schedule assignments (students/groups assigned to specific time slots)
export const scheduleAssignments = pgTable("schedule_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Monday, 1=Tuesday, ..., 4=Friday
  blockNumber: integer("block_number").notNull(), // 0-3 for the four daily blocks
  // Either a student OR a class group is assigned
  authentikUserId: text("authentik_user_id"),
  classGroupId: varchar("class_group_id").references(() => classGroups.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduleAssignmentSchema = createInsertSchema(scheduleAssignments).omit({
  id: true,
  createdAt: true,
}).refine(
  (data) => (data.authentikUserId && !data.classGroupId) || (!data.authentikUserId && data.classGroupId),
  { message: "Either authentikUserId or classGroupId must be provided, but not both" }
);

export type ScheduleAssignment = typeof scheduleAssignments.$inferSelect;
export type InsertScheduleAssignment = z.infer<typeof insertScheduleAssignmentSchema>;

// Sync log (track Authentik group synchronization events)
export const syncLogs = pgTable("sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  action: text("action").notNull(), // 'add_user', 'remove_user', 'create_group', 'error'
  authentikUserId: text("authentik_user_id"),
  authentikGroupName: text("authentik_group_name"),
  details: text("details"),
  success: boolean("success").notNull().default(true),
});

export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({
  id: true,
  timestamp: true,
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;

// Relations
export const classGroupsRelations = relations(classGroups, ({ many }) => ({
  members: many(classGroupMembers),
  scheduleAssignments: many(scheduleAssignments),
}));

export const classGroupMembersRelations = relations(classGroupMembers, ({ one }) => ({
  classGroup: one(classGroups, {
    fields: [classGroupMembers.classGroupId],
    references: [classGroups.id],
  }),
}));

export const scheduleAssignmentsRelations = relations(scheduleAssignments, ({ one }) => ({
  classGroup: one(classGroups, {
    fields: [scheduleAssignments.classGroupId],
    references: [classGroups.id],
  }),
}));

// TypeScript interfaces for Authentik API responses
export interface AuthentikUser {
  pk: number;
  username: string;
  name: string;
  email: string;
  avatar?: string;
  is_active: boolean;
  groups?: string[];
}

export interface AuthentikGroup {
  pk: string;
  name: string;
  num_users: number;
  parent?: string;
}

export interface AuthentikPaginatedResponse<T> {
  pagination: {
    next: number;
    previous: number;
    count: number;
    current: number;
    total_pages: number;
    start_index: number;
    end_index: number;
  };
  results: T[];
}

// Lesson block time definitions
export const LESSON_BLOCKS = [
  { number: 0, start: "08:00", end: "09:40", label: "Block 1" },
  { number: 1, start: "10:05", end: "11:35", label: "Block 2" },
  { number: 2, start: "11:50", end: "13:20", label: "Block 3" },
  { number: 3, start: "14:15", end: "15:45", label: "Block 4" },
] as const;

export const DAYS_OF_WEEK = [
  { number: 0, label: "Monday", short: "Mon" },
  { number: 1, label: "Tuesday", short: "Tue" },
  { number: 2, label: "Wednesday", short: "Wed" },
  { number: 3, label: "Thursday", short: "Thu" },
  { number: 4, label: "Friday", short: "Fri" },
] as const;

// Helper to get Authentik group name for a time slot
export function getGroupNameForSlot(dayOfWeek: number, blockNumber: number): string {
  const day = DAYS_OF_WEEK.find(d => d.number === dayOfWeek)?.label || "Unknown";
  const block = LESSON_BLOCKS.find(b => b.number === blockNumber)?.label || "Unknown";
  //return `Lesson-${day}-${block}`;
  return "Hausmeistersteuerung Temp"; // Temporary hardcoded group name for testing
}
