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
    
    // Skip if it's weekend
    if (adjustedDay < 0 || adjustedDay > 4) {
      console.log("Weekend - no sync needed");
      return;
    }

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
    await storage.createSyncLog({
      action: "error",
      details: `Sync error: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    });
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

  console.log("Sync service started - running every minute");
}
