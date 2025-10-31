# Design Guidelines: Student Scheduling & Authentik Access Management System

## Design Approach

**Selected Approach:** Design System - Material Design 3

**Justification:** This is a data-intensive administrative tool requiring efficient workflows, clear information hierarchy, and consistent interaction patterns. Material Design provides excellent components for scheduling interfaces, data tables, and drag-and-drop functionality while maintaining professional aesthetics.

## Core Design Elements

### A. Typography

**Font Family:** Roboto (via Google Fonts CDN)
- Primary: Roboto Regular (400) for body text and data
- Medium: Roboto Medium (500) for table headers and labels
- Bold: Roboto Bold (700) for page headings and emphasis

**Type Scale:**
- Page Titles: text-3xl font-bold (36px)
- Section Headers: text-xl font-medium (20px)
- Card Headers: text-lg font-medium (18px)
- Body/Data: text-base (16px)
- Labels/Captions: text-sm (14px)
- Time Indicators: text-xs font-medium (12px)

### B. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4
- Grid gutters: gap-6

**Grid Structure:**
- Dashboard: 12-column responsive grid (grid-cols-12)
- Schedule View: 6-column week grid (grid-cols-6) with time column
- Student Lists: Single column with max-width constraints (max-w-7xl)
- Settings: 2-column layout (grid-cols-2) for form sections

### C. Component Library

**Navigation:**
- Sidebar Navigation: Fixed left sidebar (w-64) with collapsible sections
- Top Bar: Full-width header with breadcrumbs, user info, and active lesson indicator
- Navigation items: icon + label pattern with active state highlighting

**Schedule Grid:**
- Weekly View: 5-day grid (Monday-Friday) with 4 time blocks per day
- Time Block Cells: Rounded containers (rounded-lg) showing assigned students/groups
- Drop Zones: Dashed border indicators (border-2 border-dashed) when dragging
- Time Labels: Fixed left column showing block times (8:00-9:30, 9:45-11:15, etc.)
- Color Coding: Distinct background shades for different lesson blocks

**Student Management:**
- Student Cards: Compact cards (rounded-lg) with avatar, name, and group badges
- Draggable Items: Cursor indication and subtle elevation on hover
- Search/Filter Bar: Prominent search with filter chips below
- Group Badges: Pill-shaped tags (rounded-full) in muted colors

**Class Group Management:**
- Group Cards: Larger containers showing group name, student count, and quick actions
- Member Lists: Avatar stacks with overflow indicators (+3 more)
- Drag-and-Drop Zones: Clear visual distinction between source and target areas

**Dashboard Components:**
- Active Lessons Widget: Real-time status card showing current blocks and access count
- Quick Stats: Metric cards displaying total students, active groups, scheduled blocks
- Recent Activity Feed: Chronological list of sync events and changes

**Data Tables:**
- Sortable Columns: Clear sort indicators with hover states
- Row Actions: Icon buttons aligned to the right
- Pagination: Bottom-aligned with page size selector
- Sticky Headers: Fixed position when scrolling

**Forms & Settings:**
- Input Fields: Material-style outlined inputs with floating labels
- Toggle Switches: For user exclusion rules and sync settings
- Action Buttons: Primary (filled) for save/submit, outlined for cancel
- Validation Messages: Inline feedback below fields

**Modals & Overlays:**
- Confirmation Dialogs: Centered modals for destructive actions
- Detail Panels: Slide-in panels from right for student/group details
- Toast Notifications: Top-right positioned for sync confirmations and errors

**Status Indicators:**
- Access Status: Badge/dot indicators (green=active access, gray=no access, orange=pending)
- Sync Status: Icon with tooltip showing last sync time
- Connection Indicator: Authentik API connection status in top bar

### D. Interaction Patterns

**Drag-and-Drop Behavior:**
- Visual feedback: Opacity change (opacity-50) on dragged items
- Drop zone highlighting: Border color change and subtle background tint
- Ghost preview: Semi-transparent copy following cursor
- Snap-to-grid: Items align to schedule grid cells

**Real-Time Updates:**
- Subtle animations for status changes (transition-all duration-300)
- Pulse effect on active lesson indicators
- Auto-refresh indicators for background sync operations

**Navigation Flow:**
- Primary workflow: Dashboard → Schedule Grid → Student/Group Management → Settings
- Breadcrumb navigation for context awareness
- Quick access shortcuts in top bar for common actions

## Icon Library

**Selected:** Material Icons (via CDN)
- Navigation: dashboard, schedule, groups, settings, person
- Actions: drag_indicator, add, edit, delete, refresh
- Status: check_circle, error, pending, sync
- Time: schedule, access_time, event

## Accessibility Standards

- ARIA labels on all interactive schedule cells
- Keyboard navigation for drag-and-drop (arrow keys + space/enter)
- Focus indicators on all interactive elements (ring-2 ring-offset-2)
- Screen reader announcements for status changes
- High contrast mode support
- Minimum touch target size of 44x44px for mobile interactions

## Responsive Behavior

- Desktop (lg+): Full sidebar, multi-column schedule grid
- Tablet (md): Collapsible sidebar, 3-day schedule view with horizontal scroll
- Mobile (sm): Bottom navigation, single-day schedule view with day selector