import cron from "node-cron";
import { storage } from "./storage";
import { authentikClient } from "./authentik-client";
import { getGroupNameForSlot, LESSON_BLOCKS } from "@shared/schema";

// Track which students are currently in which groups to minimize API calls
const currentGroupMemberships = new Map<string, Set<string>>(); // groupName -> Set of userIds

async function syncAccessForCurrentTime() {
  try {
    const now = new Date();
    const currentDay = now.getDay();
    
    // Convert to our 0-4 day system (Monday=0, Friday=4)
    const adjustedDay = currentDay === 0 ? -1 : currentDay === 6 ? -1 : currentDay - 1;

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Get all schedule assignments
    const allAssignments = await storage.getAllScheduleAssignments();

    // Track which groups should have which users
    const desiredGroupMemberships = new Map<string, Set<string>>(); // groupName -> Set of userIds

    // Check each lesson block for current day
    for (const block of LESSON_BLOCKS) {
      const [startHour, startMin] = block.start.split(':').map(Number);
      const [endHour, endMin] = block.end.split(':').map(Number);
      
      // Students get access 15 minutes before and after
      const startMinutes = startHour * 60 + startMin - 15;
      const endMinutes = endHour * 60 + endMin + 15;

      const groupName = getGroupNameForSlot(adjustedDay, block.number);

      // Initialize the set for this group
      if (!desiredGroupMemberships.has(groupName)) {
        desiredGroupMemberships.set(groupName, new Set());
      }

      // Check if we're currently in the access window for this block
      if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
        // Get assignments for this slot
        const slotAssignments = allAssignments.filter(
          a => a.dayOfWeek === adjustedDay && a.blockNumber === block.number
        );

        const targetUsers = desiredGroupMemberships.get(groupName)!;

        // Add all students from assignments
        for (const assignment of slotAssignments) {
          if (assignment.authentikUserId) {
            targetUsers.add(assignment.authentikUserId);
          } else if (assignment.classGroupId) {
            // Get all members of the class group
            const members = await storage.getGroupMembers(assignment.classGroupId);
            for (const member of members) {
              targetUsers.add(member.authentikUserId);
            }
          }
        }
      }
    }

    // Now sync the actual Authentik groups
    for (const [groupName, desiredUsers] of desiredGroupMemberships) {
      const currentUsers = currentGroupMemberships.get(groupName) || new Set();

      // Find users to add (in desired but not in current)
      const usersToAdd = [...desiredUsers].filter(u => !currentUsers.has(u));
      
      // Find users to remove (in current but not in desired)
      const usersToRemove = [...currentUsers].filter(u => !desiredUsers.has(u));

      // Add users
      for (const userId of usersToAdd) {
        const success = await authentikClient.addUserToGroup(userId, groupName);
        if (success) {
          await storage.createSyncLog({
            action: "add_user",
            authentikUserId: userId,
            authentikGroupName: groupName,
            details: `Added user to group for current lesson`,
            success: true,
          });
          console.log(`✓ Added user ${userId} to group ${groupName}`);
        } else {
          await storage.createSyncLog({
            action: "add_user",
            authentikUserId: userId,
            authentikGroupName: groupName,
            details: `Failed to add user to group`,
            success: false,
          });
          console.error(`✗ Failed to add user ${userId} to group ${groupName}`);
        }
      }

      // Remove users
      for (const userId of usersToRemove) {
        const success = await authentikClient.removeUserFromGroup(userId, groupName);
        if (success) {
          await storage.createSyncLog({
            action: "remove_user",
            authentikUserId: userId,
            authentikGroupName: groupName,
            details: `Removed user from group after lesson ended`,
            success: true,
          });
          console.log(`✓ Removed user ${userId} from group ${groupName}`);
        } else {
          await storage.createSyncLog({
            action: "remove_user",
            authentikUserId: userId,
            authentikGroupName: groupName,
            details: `Failed to remove user from group`,
            success: false,
          });
          console.error(`✗ Failed to remove user ${userId} from group ${groupName}`);
        }
      }

      // Update our tracking
      currentGroupMemberships.set(groupName, desiredUsers);
    }

    // Also remove users from groups that are no longer active
    for (const [groupName, currentUsers] of currentGroupMemberships) {
      if (!desiredGroupMemberships.has(groupName) || desiredGroupMemberships.get(groupName)!.size === 0) {
        // This group should be empty
        for (const userId of currentUsers) {
          const success = await authentikClient.removeUserFromGroup(userId, groupName);
          if (success) {
            await storage.createSyncLog({
              action: "remove_user",
              authentikUserId: userId,
              authentikGroupName: groupName,
              details: `Removed user from inactive group`,
              success: true,
            });
            console.log(`✓ Removed user ${userId} from inactive group ${groupName}`);
          }
        }
        currentGroupMemberships.delete(groupName);
      }
    }

    console.log(`Sync completed at ${now.toLocaleTimeString()}`);
  } catch (error) {
    console.error("Error during sync:", error);
    try {
      await storage.createSyncLog({
        action: "error",
        details: `Sync error: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      });
    } catch (logErr) {
      // If writing to the database fails (e.g. DB is down), log locally and continue.
      console.error("Failed to write sync log to DB:", logErr);
    }
  }
}

/**
 * Perform a full sync across all schedule assignments.
 * This will ensure Authentik groups reflect the desired membership for all configured slots.
 */
export async function fullSync() {
  try {
    const allAssignments = await storage.getAllScheduleAssignments();

    const desiredGroupMemberships = new Map<string, Set<string>>();

    // Build desired membership for every assignment
    for (const assignment of allAssignments) {
      const groupName = getGroupNameForSlot(assignment.dayOfWeek, assignment.blockNumber);
      if (!desiredGroupMemberships.has(groupName)) desiredGroupMemberships.set(groupName, new Set());
      const target = desiredGroupMemberships.get(groupName)!;

      if (assignment.authentikUserId) {
        target.add(assignment.authentikUserId);
      } else if (assignment.classGroupId) {
        const members = await storage.getGroupMembers(assignment.classGroupId);
        for (const m of members) target.add(m.authentikUserId);
      }
    }

    // Union groups to consider: desired groups + any currently tracked groups
    const allGroupNames = new Set<string>([...desiredGroupMemberships.keys(), ...currentGroupMemberships.keys()]);

    for (const groupName of allGroupNames) {
      const desired = desiredGroupMemberships.get(groupName) || new Set<string>();

      // Fetch actual members from Authentik
      const actual = new Set<string>(await authentikClient.getGroupMembers(groupName));

      const toAdd = [...desired].filter(u => !actual.has(u));
      const toRemove = [...actual].filter(u => !desired.has(u));

      for (const userId of toAdd) {
        const ok = await authentikClient.addUserToGroup(userId, groupName);
        await storage.createSyncLog({
          action: "add_user",
          authentikUserId: userId,
          authentikGroupName: groupName,
          details: ok ? "Full sync: added user" : "Full sync: failed to add user",
          success: ok,
        });
        if (ok) console.log(`✓ Full sync: added ${userId} to ${groupName}`);
        else console.error(`✗ Full sync: failed to add ${userId} to ${groupName}`);
      }

      for (const userId of toRemove) {
        const ok = await authentikClient.removeUserFromGroup(userId, groupName);
        await storage.createSyncLog({
          action: "remove_user",
          authentikUserId: userId,
          authentikGroupName: groupName,
          details: ok ? "Full sync: removed user" : "Full sync: failed to remove user",
          success: ok,
        });
        if (ok) console.log(`✓ Full sync: removed ${userId} from ${groupName}`);
        else console.error(`✗ Full sync: failed to remove ${userId} from ${groupName}`);
      }

      // Update local tracking
      if (desired.size > 0) currentGroupMemberships.set(groupName, desired);
      else currentGroupMemberships.delete(groupName);
    }

    console.log(`Full sync completed at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error("Error during full sync:", err);
    try {
      await storage.createSyncLog({ action: "error", details: `Full sync error: ${err instanceof Error ? err.message : String(err)}`, success: false });
    } catch (logErr) {
      console.error("Failed to write full sync log to DB:", logErr);
    }
  }
}

// Run sync every minute
export function startSyncService() {
  console.log("Starting background sync service...");
  
  // Run immediately on startup
  syncAccessForCurrentTime();

  // Then run every minute
  cron.schedule("* * * * *", () => {
    syncAccessForCurrentTime();
  });

  // Also run a full sync every hour at minute 0
  cron.schedule("0 * * * *", () => {
    fullSync();
  });

  console.log("Sync service started - running every minute");
}
