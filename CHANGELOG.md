# CRM Pro — Frontend Changes Changelog

## Summary of All Changes Made

This document lists every file that was **created or modified** during the UI modernization effort, what changed, and what (if anything) a backend integration would need to account for.

---

### Files Created (New)

| File | Purpose |
|------|---------|
| `src/app/components/shared/AppSidebar.tsx` | Persistent sidebar navigation with dark mode toggle, notifications badge, **Report Bug** dialog with form, user avatar footer, and portal branding. Uses `collapsible="icon"` mode. |
| `src/app/components/shared/DashboardLayout.tsx` | Layout wrapper combining `SidebarProvider`, `AppSidebar`, a static top bar (with trigger, separator, and portal breadcrumb label), and `<main>` content area. |
| `src/app/components/shared/DashboardHeader.tsx` | Portal header with gradient background, animated portal badge (pulsing dot + accent-colored chip), greeting with user name, and date display. |
| `src/app/components/shared/WelcomeHero.tsx` | Themed hero card with accent left border, subtle background tint, decorative circles, and hover shadow transition. Accepts children as slot content. |
| `src/app/components/shared/StatCard.tsx` | Reusable stat widget with icon, title, value, subtitle, optional trend pill (up/down with percentage), top accent bar, glow gradient, and hover elevation (`-translate-y-1`). |
| `src/app/components/shared/StarRating.tsx` | Star rating display component (read-only). |
| `src/app/components/figma/ImageWithFallback.tsx` | Image component with fallback handling. |
| `src/app/styles/portal-themes.ts` | `PortalTheme` interface and `PORTAL_THEMES` record — per-role header gradients, accent colors, icon/badge classes, and Tailwind tokens for 6 roles (admin, sales, sales_manager, finance, cst, cst_manager). |
| `src/app/styles/classes.ts` | Centralized Tailwind class constants (`cls` object) for layout, containers, spacing, grids, typography, avatars, tables, forms, and section headers. |
| `src/styles/theme.css` | CSS custom properties for light/dark mode — backgrounds (soft blue-gray, not pure white), foreground, card, muted, accent, border, table-stripe/hover, input-background, heading colors, card shadows, plus base typography for h1–h4, labels, buttons, and inputs. |
| `CHANGELOG.md` | This file. |

---

### Files Modified

| File | What Changed |
|------|-------------|
| **`src/styles/index.css`** | Added dark mode variables with soft blue-gray tints instead of pure white backgrounds. |
| **`src/styles/theme.css`** | Added `antialiased` text rendering on body, `scroll-behavior: smooth` on html, refined `--card-shadow` for both light/dark modes, heading typography hierarchy (h1-h4 with tracking and weight). |
| **`src/app/components/shared/DashboardHeader.tsx`** | Gradient header with animated portal badge (pulsing `animate-pulse` container + `animate-ping` dot). Displays greeting, user name, and formatted date. |
| **`src/app/components/shared/DashboardLayout.tsx`** | Static top bar (`h-12`) with sidebar trigger, vertical separator, and portal label breadcrumb. Uses `backdrop-blur-sm` and `bg-background/80`. |
| **`src/app/components/shared/AppSidebar.tsx`** | User avatar with initials in footer (accent-colored circle), border-top separator on footer, Report Bug dialog, dark mode toggle, notifications with red dot badge. Logo alignment refined for collapsed state. |
| **`src/app/components/shared/StatCard.tsx`** | Top accent bar via `borderTop` inline style, subtle glow gradient background, hover elevation with `-translate-y-1` and `shadow-md` transition. |
| **`src/app/components/shared/WelcomeHero.tsx`** | Added `border-border/50`, `shadow-sm`, `hover:shadow-md` transition, decorative accent circles, and subtle accent tint overlay. |
| **`src/app/components/ui/tabs.tsx`** | `TabsContent` now includes `animate-in fade-in-0 duration-300` for smooth content transitions on tab switch. |
| **`src/app/components/ui/table.tsx`** | Added zebra striping (`even:bg-table-stripe`), sticky headers, rounded container, and hover row highlights. |
| **`src/app/pages/Dashboard.tsx`** | Wraps role-specific dashboards inside `DashboardLayout` with portal theme. |
| **`src/app/pages/ClockIn.tsx`** | Added weekly attendance history table with grid layout, progress bar for weekly hours tracking, status dot indicators (present/absent/today), and stale session warning. |
| **`src/app/pages/admin/AdminDashboard.tsx`** | Uses `DashboardHeader`, `WelcomeHero`, `StatCard`, updated table classes, dark mode–safe badge colors. |
| **`src/app/pages/sales/SalesDashboard.tsx`** | Uses `DashboardHeader`, `WelcomeHero`, updated tab styling with icons, `animate-fade-in`. |
| **`src/app/pages/sales/FollowUpLeads.tsx`** | Dark mode–safe badge colors for lead statuses. |
| **`src/app/pages/sales-manager/SalesManagerDashboard.tsx`** | Uses `DashboardHeader`, `WelcomeHero`, `StatCard`. |
| **`src/app/pages/finance/FinanceDashboard.tsx`** | Uses `DashboardHeader`, `WelcomeHero`, `StatCard`, dark mode payment status badges, salary calculator. |
| **`src/app/pages/cst/CSTDashboard.tsx`** | Uses `DashboardHeader`, `WelcomeHero`, dark mode badge/status colors. |
| **`src/app/pages/cst-manager/CSTManagerDashboard.tsx`** | Uses `DashboardHeader`, `WelcomeHero`. |

---

### Files NOT Modified (Unchanged)

- `src/app/routes.ts` — routing structure unchanged (`/login`, `/clock-in`, `/dashboard`)
- `src/app/context/*.tsx` — all context files (Auth, Employee, Client, AgentTarget, ClientInbox, ManagerTask, CSTManagerTask) unchanged
- `src/app/data/mockData.ts` — mock data unchanged
- `src/app/types/crm.ts` — TypeScript types unchanged
- `src/app/App.tsx` — context providers remained the same
- All `src/app/components/ui/*.tsx` — shadcn primitives unchanged (except `table.tsx` and `tabs.tsx`)

---

## UI/UX Improvements Summary

### Visual Enhancements
- **Soft backgrounds**: Replaced pure white with `hsl(220 20% 97%)` (light) and `hsl(222 47% 8%)` (dark) to reduce glare
- **Card depth**: Cards have refined shadows (`--card-shadow`), hover elevation transitions, and subtle glow gradients on stat cards
- **Typography hierarchy**: Headings use tracked letter-spacing, weights 700/600, and `antialiased` rendering
- **Table polish**: Zebra striping, sticky headers, hover highlights, rounded containers
- **Tab transitions**: Smooth `fade-in` animation when switching between tab content
- **Smooth scrolling**: `scroll-behavior: smooth` on root element

### Navigation & Layout
- **Sidebar**: Persistent sidebar with `collapsible="icon"` mode, portal-branded logo, navigation items (Dashboard, Attendance), preferences (Dark Mode, Notifications, Report Bug), and user avatar footer
- **Top bar**: Static bar with sidebar trigger, vertical separator, and portal label breadcrumb — never overlaps content
- **Portal headers**: Gradient headers with animated badge (pulsing dot) showing portal identity

### Dark Mode
- Full dark mode support via CSS custom properties
- Toggle in sidebar (persisted to `localStorage`)
- All badges, status indicators, and tables use dark-safe color variants

---

## Backend Integration Notes

Since all changes were **purely visual/layout**, there is very little backend impact.

### No Backend Changes Needed For:

| Change | Why |
|--------|-----|
| Sidebar navigation | Client-side only — routes remain `/login`, `/clock-in`, `/dashboard` |
| Dark mode toggle | Uses `localStorage` + CSS class on `<html>` — no server interaction |
| Portal themes & colors | Static config in `portal-themes.ts` — no API calls |
| Table styling (zebra, sticky headers) | Pure CSS/Tailwind changes |
| Typography & heading hierarchy | Pure CSS changes |
| Tab content transitions | Pure CSS animation |
| `WelcomeHero`, `StatCard`, `DashboardHeader` | Presentational only — consume same props as before |
| Portal badge in header | Reads from static `PortalTheme` config |
| Sidebar user avatar | Reads from existing `useAuth()` context |
| Top bar breadcrumb label | Reads from `theme.label` prop |

### Potential Backend Changes If You Build On These Features:

| Feature | What You'd Need |
|---------|----------------|
| **Report Bug** (sidebar dialog) | Currently shows a toast on submit. To persist: add a `bug_reports` table with columns `id`, `user_id`, `title`, `description`, `created_at` and a POST endpoint. The form already captures `title` and `description`. |
| **Attendance / Clock-in** | The weekly history table uses mock data (`WEEKLY_ATTENDANCE` array in `ClockIn.tsx`). Replace with a `clock_sessions` or `attendance` table and fetch via API. The `clockIn()` / `clockOut()` functions in `AuthContext.tsx` use `localStorage` — swap for API calls. |
| **Notifications** (sidebar bell icon) | Currently a static icon with a red dot. To make functional: add a `notifications` table, poll/subscribe for unread count, and render a dropdown list. |

### Data Flow Summary

```
Frontend (unchanged contracts)     Backend (your existing)
────────────────────────────       ──────────────────────
AuthContext.login()           →    Your auth endpoint (no change needed)
AuthContext.clockIn()         →    Your clock session endpoint (no change needed)
useClients()                  →    Your clients API (no change needed)
useEmployees()                →    Your employees API (no change needed)
useAgentTargets()             →    Your targets API (no change needed)
useClientInbox()              →    Your inbox API (no change needed)
useCSTManagerTasks()          →    Your CST tasks API (no change needed)
useManagerTasks()             →    Your manager tasks API (no change needed)

NEW (currently client-only, needs backend if you want persistence):
Report Bug form               →    POST /api/bugs (new endpoint)
Notifications                 →    GET /api/notifications (new endpoint)
Clock-in attendance history   →    GET /api/attendance (new endpoint)
```

All context hooks (`useAuth`, `useClients`, `useEmployees`, etc.) have the **same interface** as before — the UI just consumes their data with better cards, tables, and layout. Your backend API contracts don't need to change.
