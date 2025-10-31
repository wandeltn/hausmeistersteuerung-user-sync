import type { AuthentikUser, AuthentikGroup, AuthentikPaginatedResponse } from "@shared/schema";

const AUTHENTIK_API_URL = process.env.AUTHENTIK_API_URL;
const AUTHENTIK_API_TOKEN = process.env.AUTHENTIK_API_TOKEN;

if (!AUTHENTIK_API_URL || !AUTHENTIK_API_TOKEN) {
  console.warn("Authentik credentials not configured. Some features will not work.");
}

class AuthentikClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = AUTHENTIK_API_URL || "";
    this.token = AUTHENTIK_API_TOKEN || "";
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentik API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getUsers(): Promise<AuthentikUser[]> {
    try {
      const response = await this.request<AuthentikPaginatedResponse<AuthentikUser>>("/api/v3/core/users/");
      return response.results;
    } catch (error) {
      console.error("Failed to fetch users from Authentik:", error);
      return [];
    }
  }

  async getUser(userId: string): Promise<AuthentikUser | null> {
    try {
      return await this.request<AuthentikUser>(`/api/v3/core/users/${userId}/`);
    } catch (error) {
      console.error(`Failed to fetch user ${userId} from Authentik:`, error);
      return null;
    }
  }

  async getGroups(): Promise<AuthentikGroup[]> {
    try {
      const response = await this.request<AuthentikPaginatedResponse<AuthentikGroup>>("/api/v3/core/groups/");
      return response.results;
    } catch (error) {
      console.error("Failed to fetch groups from Authentik:", error);
      return [];
    }
  }

  async getGroup(groupName: string): Promise<AuthentikGroup | null> {
    try {
      const groups = await this.getGroups();
      return groups.find(g => g.name === groupName) || null;
    } catch (error) {
      console.error(`Failed to fetch group ${groupName} from Authentik:`, error);
      return null;
    }
  }

  async createGroup(name: string): Promise<AuthentikGroup | null> {
    try {
      return await this.request<AuthentikGroup>("/api/v3/core/groups/", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      console.error(`Failed to create group ${name} in Authentik:`, error);
      return null;
    }
  }

  async ensureGroupExists(name: string): Promise<AuthentikGroup | null> {
    const existingGroup = await this.getGroup(name);
    if (existingGroup) {
      return existingGroup;
    }
    return await this.createGroup(name);
  }

  async addUserToGroup(userId: string, groupName: string): Promise<boolean> {
    try {
      const group = await this.ensureGroupExists(groupName);
      if (!group) {
        console.error(`Failed to ensure group ${groupName} exists`);
        return false;
      }

      await this.request(`/api/v3/core/groups/${group.pk}/add_user/`, {
        method: "POST",
        body: JSON.stringify({ pk: parseInt(userId) }),
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to add user ${userId} to group ${groupName}:`, error);
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

      await this.request(`/api/v3/core/groups/${group.pk}/remove_user/`, {
        method: "POST",
        body: JSON.stringify({ pk: parseInt(userId) }),
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to remove user ${userId} from group ${groupName}:`, error);
      return false;
    }
  }
}

export const authentikClient = new AuthentikClient();
