import type { AuthentikUser, AuthentikGroup } from "@shared/schema";
import { Configuration, CoreApi } from "@goauthentik/api";
import type { User as GenUser, Group as GenGroup, PaginatedUserList as GenPaginatedUserList, PaginatedGroupList as GenPaginatedGroupList } from "@goauthentik/api";

const AUTHENTIK_API_URL = process.env.AUTHENTIK_API_URL;
const AUTHENTIK_API_TOKEN = process.env.AUTHENTIK_API_TOKEN;

if (!AUTHENTIK_API_URL || !AUTHENTIK_API_TOKEN) {
  console.warn("Authentik credentials not configured. Some features will not work.");
}

// The generated client expects a basePath that points to the API root.
// If the supplied AUTHENTIK_API_URL points to the UI root (e.g. https://auth.example.com),
// append the API prefix so requests go to e.g. https://auth.example.com/api/v3
function getApiBase(url?: string) {
  if (!url) return url;
  const u = url.replace(/\/$/, '');
  // if url already contains '/api', assume it's the API base
  if (/\/api(\/|$)/.test(u)) return u;
  return `${u}/api/v3`;
}

const authentikConfig = new Configuration({
  basePath: getApiBase(AUTHENTIK_API_URL),
  // accessToken must return a string (or Promise<string>) per generated types
  accessToken: () => AUTHENTIK_API_TOKEN || "",
});

class AuthentikClient {
  private api: CoreApi;

  constructor() {
    this.api = new CoreApi(authentikConfig);
  }

  // Helper: normalize errors from the generated client / fetch
  private async normalizeError(err: unknown) {
    const out: { message: string; status?: number; body?: unknown } = { message: String(err) };
    // If error has a response (ResponseError from runtime), include status and body if possible
    try {
      const anyErr = err as any;
      if (anyErr?.response instanceof Response) {
        out.status = anyErr.response.status;
        try {
          out.body = await anyErr.response.text();
        } catch (_) {
          /* ignore */
        }
      }
    } catch (_) {
      // ignore
    }
    return out;
  }

  // Simple retry helper for idempotent/mutating calls that may experience transient failures
  private async withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 250): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt > retries) throw err;
        const backoff = delayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  async getUsers(): Promise<AuthentikUser[]> {
    try {
      const resp = await this.api.coreUsersList();
      const pag = resp as unknown as GenPaginatedUserList;
      const users = (pag.results || []) as GenUser[];
      // Map generated User -> shared AuthentikUser
      return users.map((u) => ({
        pk: u.pk,
        username: u.username,
        name: u.name,
        email: (u as any).email || "",
        avatar: (u as any).avatar || undefined,
        is_active: !!(u as any).isActive,
        groups: (u.groups || []) as string[],
      }));
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error("Failed to fetch users from Authentik:", e);
      return [];
    }
  }

  async getUser(userId: string): Promise<AuthentikUser | null> {
    try {
      const id = parseInt(userId, 10);
      if (Number.isNaN(id)) return null;
      const resp = await this.api.coreUsersRetrieve({ id });
      const u = resp as GenUser;
      return {
        pk: u.pk,
        username: u.username,
        name: u.name,
        email: (u as any).email || "",
        avatar: (u as any).avatar || undefined,
        is_active: !!(u as any).isActive,
        groups: (u.groups || []) as string[],
      };
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error(`Failed to fetch user ${userId} from Authentik:`, e);
      return null;
    }
  }

  async getGroups(): Promise<AuthentikGroup[]> {
    try {
      const resp = await this.api.coreGroupsList();
      const pag = resp as unknown as GenPaginatedGroupList;
      const groups = (pag.results || []) as GenGroup[];
      return groups.map((g) => ({
        pk: g.pk,
        name: g.name,
        num_users: (g.users && g.users.length) || (g.usersObj && g.usersObj.length) || (g as any).numPk || 0,
        parent: (g.parent as any) || undefined,
      }));
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error("Failed to fetch groups from Authentik:", e);
      return [];
    }
  }

  async getGroup(groupName: string): Promise<AuthentikGroup | null> {
    try {
      const resp = await this.api.coreGroupsList({ name: groupName });
      const pag = resp as unknown as GenPaginatedGroupList;
      const groups = (pag.results || []) as GenGroup[];
      const g = groups.find((x) => x.name === groupName);
      if (!g) return null;
      return {
        pk: g.pk,
        name: g.name,
        num_users: (g.users && g.users.length) || (g.usersObj && g.usersObj.length) || (g as any).numPk || 0,
        parent: (g.parent as any) || undefined,
      };
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error(`Failed to fetch group ${groupName} from Authentik:`, e);
      return null;
    }
  }
  
  /**
   * Return an array of user PKs (as strings) that belong to the named group.
   * Uses the generated client to fetch group details with users included.
   */
  async getGroupMembers(groupName: string): Promise<string[]> {
    try {
      // Find group first (to get pk/uuid)
      const resp = await this.api.coreGroupsList({ name: groupName });
      const pag = resp as unknown as GenPaginatedGroupList;
      const groups = (pag.results || []) as GenGroup[];
      const g = groups.find((x) => x.name === groupName);
      if (!g) return [];

      const groupUuid = g.pk;
      const full = await this.api.coreGroupsRetrieve({ groupUuid, includeUsers: true });
      const gf = full as GenGroup;
      // Prefer numeric array if present, else map usersObj
      const nums: number[] = (gf.users && gf.users.length) ? gf.users : (gf.usersObj && gf.usersObj.map((u: any) => u.pk)) || [];
      return nums.map((n) => String(n));
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error(`Failed to fetch members for group ${groupName}:`, e);
      return [];
    }
  }

  async createGroup(name: string): Promise<AuthentikGroup | null> {
    try {
      const resp = await this.withRetry(() => this.api.coreGroupsCreate({ groupRequest: { name } }));
      const g = resp as GenGroup;
      return {
        pk: g.pk,
        name: g.name,
        num_users: (g.users && g.users.length) || (g.usersObj && g.usersObj.length) || (g as any).numPk || 0,
        parent: (g.parent as any) || undefined,
      };
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error(`Failed to create group ${name} in Authentik:`, e);
      return null;
    }
  }

  async ensureGroupExists(name: string): Promise<AuthentikGroup | null> {
    const existingGroup = await this.getGroup(name);
    if (existingGroup) return existingGroup;
    return await this.createGroup(name);
  }

  async addUserToGroup(userId: string, groupName: string): Promise<boolean> {
    try {
      const group = await this.ensureGroupExists(groupName);
      if (!group) {
        console.error(`Failed to ensure group ${groupName} exists`);
        return false;
      }

      const groupUuid = group.pk;
      const pk = parseInt(userId, 10);
      if (Number.isNaN(pk)) return false;

      await this.withRetry(() => this.api.coreGroupsAddUserCreate({ groupUuid, userAccountRequest: { pk } }));
      return true;
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error(`Failed to add user ${userId} to group ${groupName}:`, e);
      return false;
    }
  }

  async removeUserFromGroup(userId: string, groupName: string): Promise<boolean> {
    try {
      const group = await this.getGroup(groupName);
      if (!group) {
        console.warn(`Group ${groupName} does not exist, nothing to remove`);
        return true;
      }
      const groupUuid = group.pk;
      const pk = parseInt(userId, 10);
      if (Number.isNaN(pk)) return false;

      await this.withRetry(() => this.api.coreGroupsRemoveUserCreate({ groupUuid, userAccountRequest: { pk } }));
      return true;
    } catch (err) {
      const e = await this.normalizeError(err);
      console.error(`Failed to remove user ${userId} from group ${groupName}:`, e);
      return false;
    }
  }
}

export const authentikClient = new AuthentikClient();
