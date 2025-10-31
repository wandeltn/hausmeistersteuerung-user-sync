# SchoolSync - Student Schedule & Authentik Access Management

## Overview
SchoolSync is a student scheduling system that manages time-based access control for lesson blocks by automatically synchronizing student group memberships in Authentik. The system provides a visual interface for creating class groups, assigning students to weekly lesson schedules, and automatically grants/revokes access 15 minutes before and after scheduled lessons.

## Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with Wouter for routing
- **UI Components**: Shadcn UI with Material Design 3 principles
- **State Management**: TanStack Query v5 for server state
- **Styling**: Tailwind CSS with custom design tokens
- **Key Pages**:
  - Dashboard: Overview of stats and currently active lesson blocks
  - Schedule: Weekly grid showing all lesson assignments (Monday-Friday, 4 blocks per day)
  - Students: Directory of students from Authentik with search and assignment capabilities
  - Class Groups: Manage reusable student collections
  - Settings: User exclusions and system configuration

### Backend (Express + TypeScript)
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **External Integration**: Authentik API client for user and group management
- **Background Service**: Node-cron based sync service running every minute
- **API Endpoints**:
  - `/api/dashboard/stats` - Dashboard statistics
  - `/api/sync/status` - Sync service health check
  - `/api/students` - Filtered student list (excluding exclusions)
  - `/api/groups` - Class group CRUD operations
  - `/api/schedule` - Schedule assignment CRUD operations
  - `/api/exclusions` - User exclusion management

### Database Schema
- **class_groups**: Reusable student collections
- **class_group_members**: Student membership in groups
- **user_exclusions**: Non-student accounts to hide from interface
- **schedule_assignments**: Student/group assignments to time slots
- **sync_logs**: Authentik synchronization audit trail

## Key Features

### 1. Class Group Management
- Create named groups of students (e.g., "Math Class A", "Science Period 2")
- Add/remove students from groups
- Assign entire groups to lesson blocks at once

### 2. Weekly Schedule Grid
- Visual 5-day × 4-block grid (Monday-Friday)
- Lesson blocks: 8:00-9:30, 9:45-11:15, 11:30-13:00, 13:15-14:45
- Assign individual students or entire class groups to specific time slots
- Remove assignments with confirmation dialogs

### 3. Automatic Access Control
- Background sync service runs every minute
- Creates Authentik groups per lesson block (e.g., "Lesson-Monday-Block 1")
- Adds students to groups 15 minutes before their lesson starts
- Removes students from groups 15 minutes after their lesson ends
- Logs all sync operations for audit trail

### 4. User Filtering
- Exclude non-student accounts (staff, external users) from the interface
- Filtered students don't appear in assignment dialogs
- Can re-include users from Settings page

### 5. Real-time Dashboard
- Live stats: total students, class groups, assignments
- Currently active lesson blocks with student counts
- Sync service health indicator in header

## Environment Configuration

Required secrets (configured in Replit Secrets):
- `AUTHENTIK_API_URL`: Base URL of Authentik instance (e.g., https://auth.school.com)
- `AUTHENTIK_API_TOKEN`: Authentik API bearer token with user/group management permissions
- `DATABASE_URL`: PostgreSQL connection string (auto-configured by Replit)

## User Workflows

### Creating a Class Group and Assigning to Schedule
1. Navigate to "Class Groups" page
2. Click "Create Group", enter name and description
3. Click "Manage Members" on the new group
4. Select students to add to the group
5. Click "Assign" button on the group
6. Select day of week and lesson block
7. Confirm assignment

### Assigning Individual Students
1. Navigate to "Students" page
2. Find student using search
3. Click menu (⋮) button on student card
4. Select "Assign to Schedule"
5. Choose day and lesson block
6. Confirm assignment

### Excluding Users from Interface
1. Navigate to "Students" page
2. Find user to exclude
3. Click menu (⋮) button
4. Select "Exclude from Interface"
5. User will no longer appear in student lists

## Recent Changes
- 2025-10-31: Initial implementation with full MVP features
  - Complete frontend with all pages and components
  - Backend API with Authentik integration
  - Background sync service for automatic access control
  - PostgreSQL database with Drizzle ORM
  - Material Design 3 inspired UI with dark mode support

## Technical Decisions
- **Material Design 3**: Chosen for data-dense administrative interfaces with clear information hierarchy
- **PostgreSQL**: Reliable storage for schedule assignments and group configurations
- **Minute-based sync**: Balance between responsiveness and API load
- **15-minute access window**: Allows students to prepare before and complete work after lessons
- **Automatic group creation**: Prevents manual configuration errors

## Development Commands
- `npm run dev`: Start development server (frontend + backend)
- `npm run db:push`: Push database schema changes
- `npm run build`: Build for production

## Notes
- The sync service automatically handles Authentik group creation
- All times are in the server's local timezone
- Weekend days (Saturday, Sunday) are automatically skipped by the sync service
- Delete operations on class groups cascade to remove all schedule assignments
