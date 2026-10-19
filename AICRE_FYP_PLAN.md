# AICRE Implementation Plan (aligned with the FYP report)

AICRE, the AI Integrated Client Relations Engine, is a multi tenant, web based CRM for small and medium sales and customer success companies. This file tells the coding agent exactly what to build, in what order, and how it must look. It replaces every earlier plan.

---

## 0. How to use this document

### 0.1 Sources of truth, in order

1. **The FYP report.** Chapters 1 to 5 of the final report define the scope. Where this plan quotes the report, the quote wins.
2. **This file.** It turns the report into concrete build steps for the existing codebase.
3. **`crm_info.md`.** It describes the code as it is on `main`. Use it to find files, conventions and existing behaviour.
4. **`docs/design/gui/`.** These are the HTML and CSS mockups behind the report's Graphical User Interface figures. The UI must match them (Section 9).

### 0.2 What is obsolete

* **`future_plan.md` is obsolete.** Do not follow it. In particular, its rule "every write action requires confirmation, no exceptions" is replaced by the auto tier and confirm tier design in Section 10.
* **The old version of this file is replaced completely.** The old `AICRE_FYP_PLAN.md` described an ML side car, a next best action model, synthetic training data and an `ml_predictions` table. None of that is in the report. Section 2.3 lists everything removed.

### 0.3 The two phases

| Phase | Content | Status |
|---|---|---|
| **Phase 1 (build now)** | Everything in the report except the AI assistant. It covers: finishing multi tenancy, a public landing page, the platform administrator module, custom fields, pipeline stages and the Kanban board, table driven navigation, client and employee CSV import, the rule based automations, and the full UI restyle to the report's mockups. | In progress. Multi tenancy, onboarding and the permission dials already exist. |
| **Phase 2 (next)** | The AI assistant: retrieval over the organization's own records, six fixed tools with auto and confirm tiers, the action log, conversation history and the adversarial test suite for the assistant. | Not started. Specified in Section 10 so the design stays consistent, but **do not build any of it in Phase 1.** |

### 0.4 Rules that apply to every change

* **Reuse first.** Build on the existing code, components, contexts, services, migrations and tests. Do not rewrite a working module.
  * Extend existing controllers, routes, context providers and shadcn components.
  * Move logic only when the report requires it to move, for example a calculation that must run on the server.
  * A new file is justified only when nothing existing can hold the feature, such as the Kanban board component or the platform admin pages.
* **Additive schema only.** Add a new numbered migration (`backend/migrations/006_...sql` onwards). Make it idempotent, never edit an applied migration, and never drop a table or column. Every new business table gets `tenant_id` with an index, and RLS enabled like migration `004`.
* **One policy chokepoint.**
  * Every authorization decision goes through `backend/policy/`, using `allow(actionKey)`, `can()`, `scopeFor()`, `ownerScope()` and `applyFieldVisibility()`.
  * Never add a `req.user.role === '...'` check.
  * New actions and field groups are added to `backend/policy/catalog.js`.
* **Tenant filter everywhere.**
  * Every query on a business table carries `tenant_id = $n` from `req.user.tenantId`.
  * Any id from the request body is verified with `assertUsersInTenant` or `getClientInTenant` before use.
* **Raw SQL with `pg`, no ORM.** Match the existing style. Wrap multi row writes (bulk approval, payroll run, imports) in `withTransaction()`.
* **Keep the prototype working.** All existing portal features must keep working, scoped to the organization. Run `npm test` before and after each change. Update a test only where this plan changes behaviour on purpose; each such case is named below.
* **Keep the design extensible.** Adding an organization must need no code change or new server. Adding a seventh portal type must need no change to the tenancy and permission tables, only a `portal_types` row, catalog entries, a `portalNav.ts` entry and the portal's own screens.
* **Performance target.** Ordinary requests respond within 500 ms at the 95th percentile for up to 50 concurrent users per organization in the test environment.
* **Writing style in the UI.** Labels, messages and copy are plain, simple English. Use exactly the texts quoted from the report where given.

---

## 1. Product summary (from the report)

### 1.1 What the platform is

AICRE is one deployment that many small and medium sales and customer success companies can register on. Each company shapes the system around its own teams within fixed limits, keeps its data private, and (in Phase 2) gets an assistant that works only on its own data.

### 1.2 Who uses it

* **Business Owner / Organization Administrator (Org Admin):** registers the organization and completes onboarding. Then manages employees, tasks, reviews, tier labels, custom fields and permissions.
* **Portal staff, one portal each:**
  * Sales agents
  * Sales managers
  * Customer success (CST) agents
  * Customer success managers
  * Finance staff
* **Platform Administrator (AICRE owners and developers):** operates the shared deployment, maintains the fixed catalogs and monitors isolation across organizations. Can view registered organizations and their onboarding status **without access to their records.**

### 1.3 Fixed catalogs

| Catalog | Values |
|---|---|
| Portal types (`portal_types`, not tenant editable) | `admin`, `sales`, `sales_manager`, `cst`, `cst_manager`, `finance`. The Admin portal is always enabled. |
| Tiers | Admin, Manager, Member |
| Row scope, the same in every organization | Member sees its own records, Manager sees its team, Admin sees the whole organization |
| Two permission dials (restrict only, never grant beyond the catalog) | field group visibility, and action permissions, per portal and tier |
| Custom field types | text, number, dropdown, date, checkbox |

Each employee belongs to one organization and holds exactly one portal and one tier.

### 1.4 Objectives (report, Section 2.4)

1. Serve several independent organizations from one deployment with isolated data.
2. Provide generic access tiers and limited customization of fields, stages, portals, labels, field visibility and action permissions.
3. Add a policy layer that governs routes, retrieval and assistant tool calls.
4. Build a retrieval based assistant that answers from the organization's own records and cites them (Phase 2).
5. Build a tool calling layer with six fixed tools, audited automatic actions for reversible tasks and confirmation for all others (Phase 2).
6. Remove frequent manual steps in each portal.

### 1.5 Out of scope (report, Section 2.5)

* Billing and subscription management
* Native mobile applications
* Organization defined record types or permission schemes
* Assistant actions outside the fixed tool catalog

### 1.6 Constraints

* The system is supported as a web application on Windows only.
* It must run on free or low cost hosting.
* Testing uses sample data, never real client data.

---

## 2. Current state and the delta

### 2.1 Already built: keep and reuse

These match the report, per `crm_info.md`. Do not rebuild them.

* **Auth hardening:**
  * Every business route group is behind `protect`.
  * There is no `JWT_SECRET` fallback, and the server refuses to start without `DATABASE_URL` and `JWT_SECRET`.
  * bcrypt is used for passwords, and login is rate limited.
* **Migrations:** numbered migrations `001` to `005` through `backend/scripts/migrate.js`.
* **Multi tenancy:**
  * `organizations`, plus `tenant_id` on all business tables.
  * Every query is tenant filtered.
  * RLS lockdown is in place (migration `004`).
* **Organization structure:** `portal_types`, `organization_portals` (with `custom_label`, `tier_labels`), `user_portal_access` (one portal and one tier per user) and `onboarding_state`.
* **Policy module:** `backend/policy/` with the action catalog, field groups, `allow`, `can`, `allowedActions`, `applyFieldVisibility`, `scopeFor`, plus the row scope helpers in `backend/utils/tenant.js`.
* **The two dials:** `portal_action_permissions`, `portal_field_visibility`, and the Manage Permissions editor (`PermissionsEditor`).
* **Onboarding wizard:**
  * Signup, then portals, labels, employees (form or CSV), review and complete.
  * It is resumable.
* **Organization Settings:** details, portal toggles, labels and permissions (`OrganizationSettings.tsx`, `PortalEditors.tsx`).
* **Tests:** Vitest and supertest on embedded Postgres, covering security, tenancy, IDOR, tiers, policy, onboarding and migrations.

### 2.2 Phase 1 delta

Required by the report, missing or different in the code:

| # | Item | Report source | Current code | Action |
|---|---|---|---|---|
| D1 | Public landing page for AICRE | user request; feature "Organizations can register on the platform" | none, `/` is the login page | **Add** (Section 3) |
| D2 | Platform administrator module | FR System Administrator: "view registered organizations and their onboarding status without access to their records" | none | **Add** (Section 4) |
| D3 | Token carries user, organization, portal and tier | FR All Users 1, Architecture 5.4.2 | token is `{ id, tenantId }` | **Change** (Section 5.1) |
| D4 | Navigation and dashboard dispatch built from the organization's enabled portals | FR All Users 2, Architecture 5.4.1 | per role hardcoded arrays in `AppSidebar.tsx` and `Dashboard.tsx` | **Change** (Section 5.2) |
| D5 | Onboarding CSV: skip invalid rows, list them, save valid rows | UC2 alternative 8B | all or nothing batch | **Change** (Section 5.3) |
| D6 | Registration duplicate email message | UC2 alternative 4A | generic 409 | **Change** text (Section 5.3) |
| D7 | Login messages | UC1 | same 401 for both cases | **Check** exact text (Section 5.3) |
| D8 | Add employees by form or CSV after onboarding | Feature list | CSV only inside the wizard | **Add** (Section 5.4) |
| D9 | Custom client fields (text, number, dropdown, date, checkbox) | FR Org Admin 5 | none | **Add** (Section 6.1) |
| D10 | Pipeline stages: add, rename, reorder | FR Org Admin 6 | none | **Add** (Section 6.2) |
| D11 | Kanban board, stage changes without touching status | FR All Users 8 | none | **Add** (Section 6.3) |
| D12 | Organization Settings tabs as in the mockup | GUI Figure 4.6 | different layout | **Change** (Section 6.4) |
| D13 | Field groups and action labels shown in the permissions mockup | GUI Figure 4.6 | three field groups, generic action labels | **Extend** catalog (Section 6.5) |
| D14 | Follow up auto fill, server side duplicate check and numbering | UC3, FR Automated 9 | client side only | **Add** (Section 7.1) |
| D15 | Least loaded CST agent suggestion | UC4, FR Automated 10 | manual | **Add** (Section 7.2) |
| D16 | Bulk deactivation approval in one transaction; approved clients become **discarded** | UC5, FR All Users 7, NFR Reliability | one at a time; approval sets `deactivated` | **Add and change** (Section 7.3) |
| D17 | Payroll for a month and all salary slips in one run | UC6, FR All Users 9, FR Automated 11 | single slip; write back partly exists | **Add** (Section 7.4) |
| D18 | Sales manager client CSV import with form validation | FR All Users 5 | none | **Add** (Section 7.5) |
| D19 | Whole app UI matches the report mockups | GUI Section 4.8, user request | prototype styling | **Restyle** through theme tokens (Section 9) |

### 2.3 Removed: do not build

* The Python ML side car (`ml/`, FastAPI, `scikit-learn`, XGBoost), synthetic data generation, the next best action model, `mlController`, `mlRoutes` and `ml_predictions`. The report states that no model is trained by the project.
* Every ML backlog item: churn risk, call quality, target attainment, the concern urgency classifier and churn weighted assignment.
* The "risk tiered autonomy is a deviation from the proposal" framing. In the report, auto tier and confirm tier are simply the design (Phase 2).
* Use cases UC28 to UC31 and test cases TC15 from the old plan (predictions, retraining, prediction boundary leakage).
* The AI tool "draft a deactivation reason". It is not one of the six tools in the report.
* Any "four tier architecture" with an ML tier. The report architecture has three tiers plus an external language model provider.

---

## 3. Public landing page (Phase 1)

A separate public page for AICRE, served by the same React app at the site root.

### 3.1 Routes

| Path | Page | Notes |
|---|---|---|
| `/` | Landing page (new, public) | no session needed |
| `/login` | Login (existing `Login`, restyled per Section 9.3) | was also served at `/` |
| `/signup` | Register organization (existing `Signup`) | linked from landing and login |
| `/platform/login`, `/platform/*` | Platform admin (Section 4) | separate from tenant login |

A logged in tenant user who opens `/` is sent to the existing post login route (`nextRouteFor`). A logged out user always sees the landing page at `/`.

### 3.2 File and style

* **File:** `src/app/pages/landing/Landing.tsx`.
* **Components:** build it from the existing shadcn primitives (`Button`, `Card`) and the design tokens of Section 9.
* **No new libraries.**

### 3.3 Content, top to bottom

All copy comes from the report; keep it simple.

1. **Top bar.**
   * Left: the AICRE wordmark (bold, white on the navy `#1e2a44` bar, letter spacing 0.5px).
   * Right: anchor links "Features" and "How it works", a "Log in" outline button (to `/login`) and a primary button "Register your organization" (to `/signup`).
2. **Hero.**
   * Background: the login page gradient (`linear-gradient(135deg,#1e2a44 0%,#2f4170 55%,#3b6fe0 100%)`), white text.
   * Title: "AICRE". Subtitle: "AI Integrated Client Relations Engine".
   * One line: "One CRM that each organization can shape around its own teams, while every organization's data stays private."
   * Two buttons: "Register your organization" (primary, white on blue) and "Log in" (outline, white).
3. **Features**, three white cards on the light background (`#f3f5f9`). Use only features that exist after Phase 1:
   * "Shaped around your teams": choose portals from a fixed list, rename access tiers, add custom client fields and pipeline stages.
   * "Private by design": every record belongs to one organization, and each tier sees only the fields and actions you allow.
   * "Less manual work": follow up auto fill, bulk approvals, salary slips in one run and CSV import.
4. **Portals**, a grid of six cards using the same text as the onboarding portal cards:

   | Portal | Description |
   |---|---|
   | Admin | Employees, tasks, reviews and settings |
   | Sales | Clients, follow ups and calls |
   | Sales Manager | Targets, recordings and imports |
   | Customer Success | Notes, flags, concerns and requests |
   | Customer Success Manager | Assignment, approvals and strategies |
   | Finance | Payroll, salary slips and expenses |

5. **How it works**, four numbered steps in the same circle style as the onboarding stepper:
   1. "Register your organization"
   2. "Choose your portals and tier labels"
   3. "Add your employees"
   4. "Start working in your portals"
6. **Footer.** "AICRE, Final Year Project, FAST NUCES Lahore", plus links to Log in and Register.

### 3.4 Phase 2 addition

Add a fourth feature card, "An assistant that works on your own records", only when the assistant ships.

---

## 4. Platform administrator module (Phase 1)

The report states: "The system shall let the platform administrator view registered organizations and their onboarding status without access to their records." The module is **view only**.

### 4.1 Data

New migration `007_platform_admin.sql` adds:

```sql
CREATE TABLE IF NOT EXISTS platform_admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
```

* **Not a tenant table:** it has no `tenant_id`, and platform admins are not `users` rows.
* **No public signup.** Create accounts with a new script, `npm run platform:create-admin -- --email you@example.com --name "Name"`. Add it as `backend/scripts/createPlatformAdmin.js`. It prompts for the password and hashes it with bcrypt cost 10.

### 4.2 Auth

* **Login endpoint:** `POST /api/platform/auth/login`, public and rate limited like `/api/auth/login`. It uses the same timing safe comparison and the same message "Incorrect email or password.".
* **Token:** signed with the same `JWT_SECRET`, payload `{ id, scope: 'platform' }`.
* **New middleware `protectPlatform`,** in `backend/middleware/platformAuth.js`:
  * It requires `scope === 'platform'`.
  * It reloads the admin row on every request.
  * It returns 401 if the admin is missing or inactive.
* **Token separation, in both directions:**
  * `protect` must reject any token whose `scope` is `platform`.
  * `protectPlatform` must reject tenant tokens.
* **Frontend storage:** the platform token goes in its own `sessionStorage` key, `aicre_platform_token`, separate from `crm_token`.

### 4.3 API

These routes are read only; there are no write routes.

| Route | Returns |
|---|---|
| `GET /api/platform/organizations?search=&status=` | one row per organization: `id`, `name`, `slug`, `industry`, `size`, `created_at`, `onboarding` (`completed`, `current_step`), `enabled_portals` (list of portal type keys with their `custom_label`), `employee_count` (active and total) |
| `GET /api/platform/organizations/:id` | the same fields for one organization, plus per portal: enabled flag, label and number of employees in that portal |
| `GET /api/platform/summary` | total organizations, organizations with onboarding complete, organizations still onboarding |

**Hard rule:** these queries may read `organizations`, `onboarding_state` and `organization_portals`, and may run `COUNT(*)` on `users` and `user_portal_access`. They must **never** select columns from `users`, `clients` or any other business table, so no names, emails, client data, salaries or notes. Put the queries in `backend/services/platformService.js`.

### 4.4 UI

Use the same app shell and design tokens as the portals (Section 9).

* **`/platform/login`:**
  * The login card layout (Section 9.3), with the title "AICRE" and the subtitle "Platform Administration".
  * No register link and no remember me.
* **`/platform` layout:**
  * Navy sidebar with brand "AICRE" and the small caption "Platform Admin".
  * Nav items: "Overview", "Organizations".
  * The top bar shows the page title and the admin's name with an initials avatar.
* **Overview:** three stat cards from `/summary`, reusing the existing `StatCard` component restyled to the tokens.
* **Organizations:**
  * A search box (name or slug) and a filter for onboarding status (All, Completed, In progress).
  * One white card holding the table, with columns: Organization, Industry, Size, Joined, Onboarding, Portals, Employees.
  * Onboarding shows a green tag "Completed" or a yellow tag "Step: Portals / Tier labels / Employees / Finish".
  * Portals shows the count of enabled portals.
  * Clicking a row opens the detail page.
* **Organization detail:**
  * A card with the organization details and onboarding status.
  * A second card listing the six portal types with an enabled tag, the organization's label and the employee count per portal.
  * No buttons that change anything.

### 4.5 Tests

Add `backend/tests/platform.test.js`:

* A platform token reads the organization list.
* A tenant token gets 401 on `/api/platform/*`.
* A platform token gets 401 on tenant routes.
* Responses contain no user email, no user name and no client fields.

---

## 5. Identity, navigation and onboarding changes (Phase 1)

### 5.1 Token claims

The report: "authenticate users by email and password and issue a token carrying the user, organization, portal and tier."

* **Change** `authController.js` login, and the onboarding signup that also issues a token. Sign `{ id, tenantId, portal, tier, organizationPortalId }`.
* **Keep** `protect` reloading the user from the database on every request. The database stays the authority, and the claims are informational.

### 5.2 Table driven navigation and dispatch

The report: "build navigation and dashboard dispatch from the organization's enabled portals", and "each portal is selected by a fixed mapping from portal types to components, never from a role name."

* **Navigation config.**
  * Create one config file, `src/app/config/portalNav.ts`.
  * It maps each portal type key to that portal's dashboard component and its nav items: `{ module, label, icon, actionKey? }`.
  * Fill it with the nav items that `AppSidebar.tsx` hardcodes today. Keep the same modules and labels, and move them into the map.
* **`AppSidebar.tsx`:**
  * Read the user's portal key from the session.
  * Take that portal's entry from `portalNav.ts`.
  * Hide an item when its `actionKey` fails `usePortals().can()`.
  * Show the organization's portal label and tier label from the session.
* **`Dashboard.tsx`:**
  * Dispatch through the same map, keyed by portal type, not through `user.role` comparisons.
  * If the user's portal is disabled, show the existing `PORTAL_DISABLED` message.
* **Badge counts** keep coming from the existing contexts.

### 5.3 Registration and onboarding

Reuse `Signup`, `OnboardingWizard`, `PortalEditors`, `EmployeesStep` and `SetupShell`. Apply the visual design of Section 9.4.

**Stepper.** The stepper shows exactly five steps with these labels:

| # | Step | Existing code step | Done when |
|---|---|---|---|
| 1 | Organization | `/signup` | the organization exists |
| 2 | Portals | `portals` | |
| 3 | Tier labels | `labels` | |
| 4 | Employees | `employees` | |
| 5 | Finish | `review` | `complete` is posted |

* Step 1 shows as done once the organization exists.
* The header reads "Organization setup: <organization name>".

**Portals step.**

* Show the six portal cards in a three column grid. The Admin card is checked and locked with the caption "always on".
* Below the grid, show three inputs: "Member tier label", "Manager tier label" and "Admin tier label". They default to Member, Manager and Admin.
* The values apply to every enabled portal's `tier_labels` unless the Tier labels step overrides them per portal. Reuse `PUT /onboarding/portals`, then `PUT /onboarding/labels`.
* Buttons: "Back" and "Save and continue".

**Tier labels step.** Keep the existing per portal `LabelsEditor`.

**Employees step.** Keep form entry and CSV upload, with one portal and one tier per employee.

**Behaviour changes required by the report:**

* **D5, partial CSV saves.** `POST /onboarding/employees` must create the valid rows and skip the invalid ones.
  * Response: `{ created: [...with tempPassword], rowErrors: [{ row, error }] }`.
  * Do the validation the same way as today, then insert the valid rows in one transaction.
  * The UI shows the created count, the list of skipped rows with reasons, and the one time temporary passwords.
  * Update `onboarding.test.js`, which today asserts all or nothing.
* **D6, duplicate email.** Registering with an email that is already registered returns 409 with the message "An account with this email already exists.". Show it on the form.
* **D7, login messages.**
  * A wrong email or password gives exactly "Incorrect email or password.".
  * An inactive account is refused and gets no token.
* **Resume.** Keep the existing resume behaviour: closing the wizard and returning resumes at the saved step.
* **After login.** Keep the existing post login flow unchanged: change password if required, onboarding if incomplete, clock in, then the portal dashboard.

### 5.4 Employees by form or CSV after onboarding

* **Admin portal.** Add a "Import CSV" button to the existing `EmployeeManagement` module. It opens the same CSV component used by `EmployeesStep`; reuse it, do not copy it.
* **Backend.** Add `POST /api/users/import`, guarded by `user.manage`. It calls the same service function as the onboarding employees step; move the logic from `onboardingController.addEmployees` into `userService` so both routes share it. The same skip and report behaviour applies.

---

## 6. Customization (Phase 1)

### 6.1 Custom client fields

The report: "define custom fields of type text, number, dropdown, date or checkbox on client records."

**Migration `006_customization.sql`** (data dictionary Table "Field Definitions"):

```sql
CREATE TABLE IF NOT EXISTS field_definitions (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type VARCHAR(30) NOT NULL DEFAULT 'client',
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text','number','dropdown','date','checkbox')),
  options JSONB,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_type, field_name)
);
CREATE INDEX IF NOT EXISTS idx_field_definitions_tenant ON field_definitions(tenant_id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_fields JSONB;
ALTER TABLE field_definitions ENABLE ROW LEVEL SECURITY;
```

* **`field_name`** is the label shown in forms and also the key inside `clients.custom_fields`.
* **`options`** holds the allowed values for dropdowns, as a JSON array of strings.

**API** (`organizationController`, guard `org.settings`):

* `GET /organization/custom-fields`
* `POST /organization/custom-fields`
* `PUT /organization/custom-fields/:id`, which edits the name, options and order.
* `PUT /organization/custom-fields/order`
* Reading the definitions for forms is allowed for any authenticated user in the tenant: `GET /clients/custom-fields`.

**Validation.** A shared helper `validateCustomFields(definitions, values)` in `backend/services/customFieldService.js`:

| Type | Valid value |
|---|---|
| number | numeric |
| date | ISO date |
| checkbox | boolean |
| dropdown | one of `options` |
| text | string up to 1000 characters |

Unknown keys are rejected. Use it in client create, client update and client CSV import.

**Forms.**

* `ClientEntryForm`, `EditClientModal` and `ExistingClientForm` render an extra section, "Additional fields", generated from the active definitions in `display_order`.
* Use the existing shadcn inputs: `Input`, `Select`, the date input already used in the forms, and `Checkbox`.
* Fixed fields and their validation are untouched. Values save into `clients.custom_fields`.

### 6.2 Pipeline stages

The report: "add, rename and reorder pipeline stages." It does not include delete, so do not add one.

**Migration `006_customization.sql`, continued:**

```sql
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type VARCHAR(30) NOT NULL DEFAULT 'client',
  stage_name VARCHAR(100) NOT NULL,
  stage_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_type, stage_name)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant ON pipeline_stages(tenant_id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage_id INT REFERENCES pipeline_stages(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
```

* **`stage_changed_at`** is the only column not in the report's data dictionary. It is needed to show "days in stage" on each Kanban card, as the Kanban mockup does.
* **`clients.status` is never changed by stage moves.**

**API:**

* `GET /organization/pipeline-stages`
* `POST /organization/pipeline-stages`
* `PUT /organization/pipeline-stages/:id` to rename
* `PUT /organization/pipeline-stages/order` to reorder

All are guarded by `org.settings`. Reading stages for the board uses `GET /clients/pipeline-stages`, open to any authenticated user in the tenant.

### 6.3 Kanban board

The report: "show clients on a Kanban board and update the stage on drag and drop without changing the client's status." This feature is for customer success teams.

**Component:** `src/app/components/shared/PipelineKanbanBoard.tsx`.

* Native HTML5 drag and drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). No new dependency.
* One column per stage, in `stage_order`. The column header shows the stage name and the card count.
* A "No stage" column appears first, and only while some clients have no stage.
* Each card shows the client company name, the assigned agent's first name and days in stage. Days in stage counts from `stage_changed_at`, falling back to `created_at`.
* Fields hidden by field visibility are never shown.

**Where it mounts.** It is an alternate view with a "Table view / Kanban view" toggle:

* In the CST agent's active clients screen inside `CSTDashboard.tsx`.
* In the CST manager's `ActiveClientsPanel` and `MasterClientTable`.

The default view stays the existing table. If the organization has no stages, the Kanban toggle is disabled with the hint "Add pipeline stages in Organization Settings".

**Hint text** above the board, exactly as in the mockup: "Dragging a card changes the stage only; the client status is not affected."

**API:** `PATCH /api/clients/:id/stage { stage_id }`.

* **Guard:** a new catalog action `client.move_stage`, for portals cst, cst_manager and admin, minimum tier Member.
* **Ownership:** `assertClientAccess`, so a Member moves only its own clients.
* **Validation:** the stage must belong to the tenant.
* **Writes:** it sets `stage_id` and `stage_changed_at = now()`. It never touches `status`.
* **Test:** add a test asserting that `status` is unchanged.

**Table addition.** Add a "Stage" column to `MasterClientTable`, as in the report's assistant panel mockup. Add a "Last contact" column too, showing the latest date among the client's follow ups, notes and call recordings, computed in the existing client list query.

### 6.4 Organization Settings layout

Restructure the existing `OrganizationSettings.tsx` into four tabs, exactly as in the permissions mockup. Reuse the existing editors inside them.

| Tab | Contents |
|---|---|
| **Portals and Labels** | Existing organization details form (name, industry, size) at the top, then the existing `PortalsEditor` and `LabelsEditor` |
| **Custom Fields** | New editor (Section 6.1): table of fields with name, type and options; "Add field" dialog; edit; drag or arrow reorder |
| **Pipeline Stages** | New editor (Section 6.2): ordered list with rename and reorder; "Add stage" input |
| **Permissions** | Existing `PermissionsEditor`, laid out as in Section 9.8 |

* **Tab styling:** the active tab has a navy background (`#1e2a44`) and white text. Inactive tabs are white with a `#e3e7ef` border.
* **Footer** of the Permissions tab: "Both lists come from fixed catalogs; entries can be switched on or off but not created.", with a primary "Save changes" button.

### 6.5 Catalog additions

These make the permissions screen match the mockup. Edit `backend/policy/catalog.js` only. These are catalog changes shipped in a release, which the report allows.

**Field groups.** The mockup shows five; keep the three existing keys and relabel them, then add two.

| Label in UI | Key | Strips | Eligible portals |
|---|---|---|---|
| Client contact details | `client.contact` (existing) | `email, email_2, phone, contact_no_1, contact_no_2` | all |
| Payment details | `client.financial` (existing) | `payment_amount, payment_gateway` | all |
| Salary and payroll | `user.compensation` (existing) | `base_salary` | admin, finance |
| Call recordings and transcripts | `call.transcript` (new) | `transcript, recording_url` on `call_recordings` and `important_call_recordings` | sales, sales_manager, cst, cst_manager, admin |
| Internal notes | `client.internal_notes` (new) | `notes, tips_for_tech, client_concerns` on `clients` | all |

Apply `applyFieldVisibility` to the recordings endpoints for the new `call.transcript` group, on both reads and write responses, like the existing groups.

**Actions.** Show these labels in the UI; keep the existing keys.

| Label in UI | Key |
|---|---|
| Add client note | `note.add` (new: cst, cst_manager, admin, Member). Guard the existing `POST /cst/notes` with it. |
| Flag client | `client.flag` (new: cst, cst_manager, admin, Member). Guard `POST /cst/flags` and the flag branch of status updates. |
| Request deactivation | `deactivation.request` (new: cst, cst_manager, admin, Member). Guard `POST /cst/deactivation-requests`. |
| Approve deactivation | `deactivation.resolve` (existing, relabel) |
| Reassign client | `client.assign` (existing, relabel) |
| Move client stage | `client.move_stage` (new, Section 6.3) |
| Import clients | `client.import` (new: sales_manager, admin, Manager; Section 7.5) |
| Run payroll | `payroll.manage` (existing, relabel) |

All other existing actions keep their keys and get plain labels in the same style. Update `policy.test.js` for the new keys.

---

## 7. Rule based automations (Phase 1)

The report: "plain rules inside the controllers that already handle each task." Implement each one in the existing controller, never in a new service layer just for it.

### 7.1 Follow up auto fill, duplicate check and numbering (UC3)

The table below is Use Case 3, Log Follow up.

| Actor action | System response |
|---|---|
| 1. Sales agent opens the follow up form and selects a client. | 2. System fills the client's name, product, area and contact number. |
| 3. Sales agent sets the due date, adds notes and submits. | 4. System checks for a duplicate, assigns the next follow up number and saves the follow up. |
| Alternative 3. A follow up for the same client and day already exists. | 4A. System rejects the entry and links to the existing follow up. |

**Special requirement:** duplicate detection runs on the server.

**Frontend** (`FollowUpLeads.tsx`, and the follow up form in the Sales Manager team views). On client select, fill:

* `client_name_text` from `customer_name`, falling back to `company_name`
* `product` from `product_sold`
* `area` from `service_area`
* `contact_no` from `phone`, falling back to `contact_no_1`

**Backend** (`salesController` create follow up):

* Verify the client with `getClientInTenant`.
* Fill any missing auto fill fields from the client row.
* **In one transaction:**
  1. Lock the client's follow ups (`SELECT ... FOR UPDATE` on the client row).
  2. Reject with 409 if a follow up exists for the same `tenant_id`, `client_id` and `due_date`. The response is `{ error: 'A follow up for this client already exists on this day.', existingId }`.
  3. Otherwise set `follow_up_number = COALESCE(MAX(follow_up_number),0)+1` for that client.
* Remove the client side numbering.
* The UI shows the 409 message with a link that opens the existing follow up.

**Tests:** duplicate rejected; numbering increments; auto fill applied when fields are omitted.

### 7.2 Least loaded agent suggestion (UC4)

The table below is Use Case 4, Assign Client to Agent.

| Actor action | System response |
|---|---|
| 1. Manager opens the list of unassigned clients. | 2. System shows each client with a suggested agent who has the fewest active clients. |
| 3. Manager accepts the suggestion or selects another agent. | 4. System assigns the client and adds it to the agent's active clients. |
| Alternative 3. Selected agent belongs to another organization. | 4A. System refuses the request. |

* **Backend:** `GET /api/cst-manager/unassigned-clients`, guarded by `client.assign`. It returns the inbox clients with `suggested_agent { id, name, active_count }`.
  * **Candidates:** active users of the tenant in the `cst` portal.
  * **Load:** the count of the agent's clients with `status = 'active'`.
  * **Ties:** broken by first name.
  * **Query:** a single grouped query.
* **Assignment** reuses the existing `PATCH /cst-manager/clients/:id/assign-cst`. `assertUsersInTenant` already refuses other organizations' agents; keep the test.
* **UI** (`InboxPanel`):
  * Each row shows "Suggested: <name> (<n> active)", with an "Accept" button and the existing agent select.

### 7.3 Bulk deactivation approval (UC5)

The table below is Use Case 5, Approve Deactivation Request.

| Actor action | System response |
|---|---|
| 1. Manager opens the deactivation requests screen. | 2. System lists the pending requests of the organization. |
| 3. Manager selects one or more requests and clicks Approve. | 4. System approves each request, marks each client discarded and removes them from the list. |
| Alternative 3. Manager clicks Reject. | 4A. System rejects the requests and the clients stay active. |
| Alternative 3. A user without approval permission tries to approve. | 4B. System refuses the action. |

**Special requirement:** several approvals are saved in one transaction.

**Backend.** Add `POST /api/cst-manager/deactivation-requests/resolve-bulk { ids: [...], decision: 'approved'|'rejected' }`, guarded by `deactivation.resolve`.

* In one `withTransaction()`, each request must be in the tenant and pending, otherwise the whole call fails with 400.
* **Approve** sets the request's status to `approved` and stamps `reviewed_by`. The client gets:
  * `status = 'discarded'`
  * `discard_reason` = the request's reason
  * `discarded_at = now()`
* **Reject** sets the status to `rejected` and stamps `reviewed_by`; the client is unchanged.

**Behaviour change.** Change the existing single `PATCH /cst-manager/deactivation-requests/:id/resolve` the same way: approval now sets `discarded`, not `deactivated`. This follows the report's UC5 and data dictionary ("Set when a deactivation is approved"). Update `idor.test.js` and any test that expects `deactivated`.

**UI** (`DeactivationPanel`), exactly as in the deactivation mockup:

* A checkbox column, with select all in the header.
* Columns: Client, Requested by, Reason, Flag (colored tag), Requested on, Status (yellow "Pending" tag).
* Above the table, the count "N pending requests · M selected", a red outline "Reject selected" button and a primary "Approve selected (M)" button.
* Selected rows have a light blue background.
* Below the table, the note: "Approving marks each request approved and each client discarded in one transaction; rejected clients stay active."

### 7.4 Payroll run and all salary slips (UC6)

The table below is Use Case 6, Process Payroll and Generate Salary Slips.

| Actor action | System response |
|---|---|
| 1. Finance staff select the month and click Generate all slips. | 2. System asks for confirmation. |
| 3. Finance staff confirm. | 4. System calculates the pay of each active employee, saves it and generates the slips for download. |
| Alternative 3. An employee has no base salary. | 4A. System skips the employee and lists them in the result. |
| Alternative 3. Payroll is run again for the same month. | 4B. System updates the existing records instead of duplicating them. |

**Backend.** Add `POST /api/finance/payroll/run { month: 'YYYY-MM' }`, guarded by `payroll.manage`.

* **Formula:** use the **existing** Auto Salary Calculator formula from `FinanceDashboard.tsx`, which works from the base salary and the month's attendance. If it lives only in the frontend, move it into `backend/services/payrollService.js` and make the frontend calculator call the same function's endpoint. Do not invent a new formula.
* **In one transaction**, for each active user of the tenant: skip and list the user if `base_salary` is null or zero. Otherwise upsert the month's `payrolls` row (same upsert as the existing `PATCH /finance/salary/:id`, keyed by user and pay period).
* **Response:** `{ processed: [...], skipped: [{ user_id, name, reason }] }`.

**Write back (FR Automated 11).** The single employee calculator in the Finance portal must save its result through the existing `PATCH /finance/salary/:id`; confirm that it does.

**Slips.** Add `GET /api/finance/salary-slips?month=YYYY-MM`, which returns every slip of the month, using the existing slip builder.

**UI** (`FinanceDashboard`):

* A month picker and a "Generate all slips" button.
* A confirmation dialog (existing shadcn `AlertDialog`).
* A result card listing the processed count and the skipped employees with reasons.
* A "Download all slips" button that produces one PDF with one slip per page, using the existing slip layout and its current PDF or print method.

**Tests:** rerunning the same month keeps one record per employee; employees without a base salary are skipped and listed; the run is atomic.

### 7.5 Client CSV import for sales managers

The report: "let a sales manager import clients from a CSV file using the same validation as the client form."

* **Backend:** `POST /api/clients/import`, guarded by the new `client.import` action.
  * It takes up to 500 rows, validated with the **same zod schema** used by `POST /clients`. Extract it to `backend/validation/clientSchema.js` if it is inline.
  * Custom field columns are matched by `field_name` and checked with `validateCustomFields`.
  * Referenced agents are checked with `assertUsersInTenant`.
  * Valid rows are inserted in one transaction. Invalid rows are skipped and returned as `rowErrors [{ row, error }]`, the same pattern as employees.
  * Imported clients get the same initial status as clients created by a sales manager (`new`).
* **UI:** a new "Import CSV" button in the Sales Manager Client Entry module (`ClientEntryForm`).
  * Reuse the CSV parsing and the result table from `EmployeesStep`.
  * Offer a "Download template" link with headers for the fixed client fields plus the organization's custom fields.

---

## 8. Database: Phase 1 target

These are the report's data dictionary tables, with their state and Phase 1 action:

| Table | State | Phase 1 |
|---|---|---|
| organizations | exists (plus slug, industry, size) | none |
| portal_types | exists | none |
| organization_portals | exists (plus `tier_labels`) | none |
| user_portal_access | exists | none |
| onboarding_state | exists | none |
| field_definitions | missing | **add** (6.1) |
| pipeline_stages | missing | **add** (6.2) |
| portal_field_visibility | exists | none (new group keys are data) |
| portal_action_permissions | exists | none (new action keys are data) |
| users | exists | none |
| clients | exists | **add** `custom_fields`, `stage_id`, `stage_changed_at` |
| follow_ups, call_recordings, client_notes, client_strategies, client_deactivation_requests, concerns | exist | none in Phase 1 (embeddings are Phase 2) |
| platform_admins | missing (needed for D2) | **add** (4.1) |

Migrations to add: `006_customization.sql` and `007_platform_admin.sql`. Both must be idempotent, and the migration test must stay green.

**Known inconsistency (report risk 4.10.3).** `client_strategies.created_by` differs between the old setup scripts. Check the live type with `npm run db:info`. If it is `VARCHAR`, add a new `INT REFERENCES users(id)` column in a migration, backfill it, and switch the code to it. Do not alter or drop the old column.

---

## 9. UI design system: match the report exactly

The report's GUI figures were produced from the HTML and CSS mockups in `docs/design/gui/`:

* `base.css`
* `login.html`
* `onboarding.html`
* `kanban.html`
* `deactivation.html`
* `permissions.html`
* `ai_panel.html`, which is Phase 2

PNG renders of each screen are included. Copy that folder into the repo at `docs/design/gui/`.

**Goal:** every screen of the app, every portal, the landing page and the platform admin module looks like these mockups.

**Method, for maximum reuse:**

* **Do not** rebuild components.
* Change the Tailwind theme tokens, the shadcn CSS variables, `styles/portal-themes.ts` and `styles/classes.ts`. Then adjust the few shared layout components (`DashboardLayout`, `AppSidebar`, `DashboardHeader`, `StatCard`, `WelcomeHero`).
* Existing module screens then inherit the look.
* Only the screens drawn in the mockups need layout changes, and those are listed below.

### 9.1 Tokens

Put these in the global CSS as CSS variables and map the shadcn variables to them.

| Token | Value | Use |
|---|---|---|
| Font | `Arial, "Liberation Sans", Helvetica, sans-serif`, base 14px | whole app |
| Text | `#1f2937` | body text |
| Text muted | `#6b7383` | captions, table headers, hints |
| Text secondary | `#5b6475` | user name in top bar, secondary text |
| Placeholder | `#9aa3b2` | input placeholders |
| App background | `#f3f5f9` | page background |
| Surface | `#ffffff` | cards, top bar, inputs |
| Border | `#e3e7ef` | cards, top bar bottom, table header bottom |
| Row divider | `#eef1f6` | table rows |
| Input border | `#cfd6e3` | inputs, outline buttons |
| Table header bg | `#f8f9fc` | `th` |
| Navy | `#1e2a44` | sidebar, landing top bar, active settings tab |
| Navy active | `#2f4170` | active nav item |
| Accent line | `#5b8def` | active nav left border, avatar |
| Primary | `#3b6fe0` | primary buttons, selected states, toggles, links |
| Primary soft | `#f2f6ff` | selected rows and cards |
| Sidebar text | `#cfd8ea`, caption `#9fb0cf` | sidebar |
| Success | bg `#e6f6ec`, text `#1d7a3e` | green tags, done steps |
| Warning | bg `#fff4d6`, text `#8a6100` | yellow tags, pending |
| Danger | bg `#fde8e8`, text `#b42318`, outline border `#f1c4c0` | red tags, reject buttons |
| Info | bg `#e8efff`, text `#2d55b8` | blue tags, "always on" caption |
| Kanban column bg | `#e9edf4` | board columns |

### 9.2 App shell (all portals and platform admin)

* **Sidebar:**
  * Width 220px, background navy, padding 18px top.
  * Brand "AICRE" in white, 20px bold, letter spacing 0.5px. Underneath, in 11px `#9fb0cf`, the portal label of the user, for example "CST Manager", "Admin", or "Platform Admin" for platform admins.
  * Nav items: 14px, `#cfd8ea`, padding 10px 22px, no icons required but existing icons may stay.
  * Active item: background `#2f4170`, white text, 3px left border `#5b8def`.
  * Keep the existing dark mode toggle, report bug and logout actions at the bottom of the sidebar, styled the same.
* **Top bar:**
  * Height 58px, white, bottom border `#e3e7ef`, padding 0 24px.
  * Left: page title, 19px bold.
  * Right: user name (13px `#5b6475`) and a 32px round avatar with initials (background `#5b8def`, white bold).
* **Content area:** padding 20px 24px, background `#f3f5f9`.
* **Cards:** white, 1px `#e3e7ef` border, radius 10px, no heavy shadows.
* **Buttons:**
  * Padding 8px 14px, radius 7px, 13px.
  * Outline: white with `#cfd6e3` border.
  * Primary: `#3b6fe0` background and border, white text.
  * Danger outline: text `#b42318`, border `#f1c4c0`.
* **Tables:**
  * Header: 12px uppercase, letter spacing 0.4px, `#6b7383`, padding 10px 14px, background `#f8f9fc`, bottom border `#e3e7ef`.
  * Cells: 13.5px, padding 11px 14px, bottom border `#eef1f6`.
* **Tags:** pill, radius 12px, padding 3px 9px, 12px, using the color pairs above. Flag colors are Red for red, Yellow for yellow, a green tag "None" for none, and black flags use the danger pair with the text "Black".
* **Portal themes.** Keep the `portal-themes.ts` mechanism, but set every portal to this same palette, so all portals share the mockup look while the code path stays the same.
* **Dark mode.** Light is the default, as in the mockups. Keep dark mode working by mapping the same tokens to dark equivalents. It is not drawn in the report, so it only needs to stay usable.

### 9.3 Login page (Figure 4.1)

* **Page background:** `linear-gradient(135deg,#1e2a44 0%,#2f4170 55%,#3b6fe0 100%)`, with a centered card.
* **Card:** 420px wide, white, radius 14px, padding 38px 40px, shadow `0 20px 50px rgba(0,0,0,.25)`.
* **Heading:** "AICRE" (28px bold, `#1e2a44`, centered). Under it, "AI Integrated Client Relations Engine" (13px `#6b7383`, centered).
* **Fields:** "Email" and "Password" labels (13px, weight 600), inputs (radius 8px, padding 11px 12px, border `#cfd6e3`), placeholder `name@company.com`.
* **Row under the inputs:**
  * Left, the "Remember me" checkbox. When checked, the token is kept in `localStorage` instead of `sessionStorage`.
  * Right, the "Forgot password?" link (primary color). It opens a small dialog: "Please contact your organization administrator to reset your password."
* **Submit button:** full width "Sign in" (padding 12px, radius 8px, 15px, weight 600, primary).
* **Bottom line:** "New to AICRE? **Register your organization**", linking to `/signup`.

### 9.4 Registration and onboarding (Figure 4.2)

* **Header bar:** 58px navy. Left, "AICRE" in white 20px bold. Right, "Organization setup: <name>" in 13px `#cfd8ea`.
* **Card:** white, centered, 900px wide, padding 24px 30px.
* **Stepper:** five items, each a 26px circle with a number and a label.
  * Done: green filled `#1d7a3e` with a tick, green label.
  * Current: primary filled, bold dark label.
  * Upcoming: white with a `#cfd6e3` border and muted label.
* **Step title:** 19px bold, with a 13px muted subtitle. For portals: "Select the portals your organization will use" and "Portals come from a fixed list. You can change this later in Organization Settings."
* **Portal cards:** grid of three columns, gap 12px.
  * Each card has a 1px `#dfe4ee` border, radius 9px, padding 13px 14px, an 18px checkbox, a bold name and a 12px muted description.
  * Selected: border primary, background `#f2f6ff`, checked box.
  * The Admin card shows a small "always on" caption in `#2d55b8`.
* **Tier label inputs:** three inputs in a row, as in Section 5.3.
* **Footer:** "Back" (outline) left, "Save and continue" (primary) right.
* **Signup page (step 1):** uses the same header and card, with the organization fields and the first administrator's fields.

### 9.5 Kanban board (Figure 4.4)

* **Toolbar row:**
  * Left, the hint text in 13px muted.
  * Right, a segmented toggle "Table view | Kanban view": radius 8px, border `#cfd6e3`, active segment primary with white text.
* **Columns:** side by side with gap 14px, background `#e9edf4`, radius 10px, padding 10px. The header is bold 13.5px with the count in muted regular text.
* **Cards:** white, radius 8px, padding 11px 12px, border `#dfe4ee`, 13px.
  * The client name is bold 14px.
  * A second line shows the agent name on the left and the days on the right, both muted.
* **While dragging:** rotate -2deg, shadow `0 10px 24px rgba(30,42,68,.25)`, primary border.

### 9.6 Deactivation requests (Figure 4.5)

As described in Section 7.3.

### 9.7 Assistant panel (Figure 4.3)

Phase 2 only; see Section 10.

### 9.8 Permissions (Figure 4.6)

* **Tabs** as in Section 6.4.
* **Selectors:** two side by side, "Portal" and "Tier", each 240px wide with a small muted label above. The tier option text shows the organization's label, for example "Member (Support Agent)".
* **Two cards** side by side:
  * Left: "Field groups", with the caption "Which data this tier can see, in screens and assistant answers".
  * Right: "Actions", with the caption "Which operations this tier can perform".
* **Each row:** the label and a toggle switch (38 by 21px, on is primary, off is `#cfd6e3`), separated by `#eef1f6` lines.
* **Footer:** the note text and the "Save changes" button.

### 9.9 Screens not drawn in the report

The landing page, the platform admin module and every other existing module screen use the tokens and shell above, without layout rewrites. A screen's existing component structure stays; only its styling changes through the tokens and shared components.

---

## 10. Phase 2: AI assistant (specified now, built later)

**Do not build this in Phase 1.** It is here so that Phase 1 choices stay compatible, and so the same agent can continue later.

### 10.1 Requirements from the report

* **Answers.**
  * Answer plain language questions from the organization's own records and cite the record identifiers.
  * Keep each user's conversation history within the organization.
* **Embeddings.**
  * Create or update the embedding of a note, concern, call recording or template whenever it is written.
  * Enable pgvector, and add an `embedding VECTOR(n)` column to `client_notes`, `concerns`, `call_recordings` and `cst_templates`.
  * Fix the dimension once, after comparing a local and a hosted embedding model on sample data.
  * Add the record type, client and date to each embedded chunk.
* **Retrieval.**
  * Filter every retrieval by organization and tier row scope **inside the retrieval query**.
  * Apply field visibility (`applyFieldVisibility`) to retrieved content.
  * Treat retrieved text as data, never as instructions.
  * Pass at most 8 records to the model.
* **Tools.**
  * Offer the language model only the tools permitted for the caller, and check each call with the policy module.
  * There are six tools, declared once in one file with their inputs and tier. Each is a thin adapter around an existing controller.
* **Auto tier:**
  * The four auto tier tools are client history lookup, note summarization, follow up drafting and template personalization.
  * They only read records or return a draft to the user, and they never change stored data.
  * They run immediately, and every execution is recorded in the action log.
* **Confirm tier:**
  * The two confirm tier tools are concern triage and client strategy drafting.
  * They return a proposal with a one time confirmation token, which the user may edit, confirm or cancel.
  * They execute only with a valid token from the same user.
  * Tokens are single use, bound to the user and the proposal, and short lived.
* **Tier source.** The tier comes from the code, never from model output.
* **Action log.**
  * It records organization, user, tool, tier and time for every executed action.
  * The organization administrator can review the log.
* **Provider.**
  * The language model provider is reached through one adapter module.
  * Provider keys are read only from the environment.
  * If the provider fails, no portal page breaks.
  * Apply a rate limit per user.
* **Performance.** Answers begin within 8 seconds when up to 8 records are retrieved.

### 10.2 Use case 7: Ask the AI Assistant

**Special requirement:** only records and fields the user is allowed to see are used.

| Actor action | System response |
|---|---|
| 1. User types a question in the assistant panel. | 2. System retrieves matching records within the user's organization and access scope. |
| 3. User waits for the answer. | 4. System removes hidden fields, generates the answer and shows it with the cited records. |
| Alternative 1. No record the user may see matches the question. | 2A. System replies that it found nothing the user can access. |
| Alternative 1. The answer needs a field hidden from the user. | 2B. System leaves the field out and says it is not available at this access level. |

### 10.3 Expected building blocks

* **Backend:**
  * `backend/ai/` with the provider adapter, retrieval, `tools.js` (the single tool catalog) and the confirmation token store.
  * `aiController.js` and `aiRoutes.js`, mounted with `protect`.
* **Tables:** `ai_conversations`, `ai_messages`, `ai_actions_log` and a confirmation token table, all tenant scoped.
* **Frontend:**
  * `AIAssistantContext.tsx` and `AIAssistantPanel.tsx`, mounted once in `DashboardLayout.tsx`.
  * The panel matches `docs/design/gui/ai_panel.html`: 380px side panel, user bubbles in primary, answer bubbles in `#f3f5f9`, a "Sources:" line with record links, confirm tier proposals in a dashed primary box with Edit, Confirm and Cancel, and auto tier notices in a green box.
* **Admin portal:** an "Assistant log" view.
* **Landing page:** the fourth feature card.

### 10.4 Adversarial test suite

The platform administrator runs this suite before every release, as `npm run test:security`. Its target is zero cross organization or hidden field leaks across all executed cases. It checks whether a user can:

* see another organization's data
* reach data above their access level
* use assistant tools they are not allowed to use
* trick the assistant with hidden instructions in stored text
* skip the confirmation step for sensitive actions
* reach a confirm tier tool through the auto tier path, and whether any auto tier tool writes anything except the action log

### 10.5 Open point to settle before Phase 2

The report's assistant panel mockup shows "Summary saved to client notes (auto tier, logged)". The functional requirement says auto tier tools "never change stored data". Follow the requirement: the summary is returned as a draft, and the user saves it into the notes with one click through the existing notes endpoint. Confirm this with the team before building.

---

## 11. Phase 1 build order

1. **Baseline.** Run `npm test` on `main` and record the results.
   * Copy `docs/design/gui/` into the repo.
   * Check the `client_strategies.created_by` type (Section 8).
2. **Design tokens and app shell (Section 9.1, 9.2).** Do this first so every later screen is built in the final look. Then the login page (9.3).
3. **Token claims and table driven navigation (5.1, 5.2).**
4. **Onboarding changes (5.3)** and employee CSV after onboarding (5.4), including the test updates.
5. **Migration `006_customization.sql`.** Then the Custom Fields and Pipeline Stages editors, and the Organization Settings tabs (6.1, 6.2, 6.4).
6. **Catalog additions and the permissions layout (6.5, 9.8).**
7. **Kanban board and the master table columns (6.3, 9.5).**
8. **Automations,** each with its tests (7.1 to 7.5).
9. **Migration `007_platform_admin.sql`, platform API and platform UI (Section 4).**
10. **Landing page (Section 3).**
11. **Full regression.** Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. Then a manual pass through every portal (Section 12).

---

## 12. Acceptance checklist (Phase 1)

### 12.1 Platform and identity

* [ ] `/` shows the landing page when logged out. "Register your organization" opens `/signup` and "Log in" opens `/login`.
* [ ] Login matches Figure 4.1:
  * Remember me keeps the session after the browser restarts.
  * Forgot password shows the administrator message.
  * A wrong email or password shows "Incorrect email or password.".
  * An inactive account is refused.
* [ ] The token carries user, organization, portal and tier, and `protect` still reloads the user.
* [ ] The sidebar and dashboard come from `portalNav.ts` and the session; no `user.role` comparisons remain in `AppSidebar.tsx` or `Dashboard.tsx`.

### 12.2 Registration and onboarding

* [ ] Registering a new organization creates its first administrator. A duplicate email shows "An account with this email already exists.".
* [ ] The wizard shows the five steps of Figure 4.2:
  * The Admin portal is always on.
  * The three tier label inputs work.
  * Closing and reopening resumes at the saved step.
* [ ] The employee CSV (onboarding and Admin portal) saves the valid rows, lists the skipped rows with reasons and shows the temporary passwords.

### 12.3 Organization Settings

* [ ] It has four tabs exactly as in Figure 4.6.
* [ ] Custom fields of all five types appear in the client forms and persist in `custom_fields`.
* [ ] Stages can be added, renamed and reordered.
* [ ] The Permissions tab shows the five field groups and the action list with the mockup labels. Switching a field group off hides it in every screen for that portal and tier.

### 12.4 Daily work

* [ ] The Kanban view works for CST agents (own clients) and CST managers (team).
  * Dragging changes `stage_id` and `stage_changed_at` only, never `status`.
  * The "No stage" column appears only when needed.
* [ ] Follow ups auto fill from the client. A duplicate for the same client and day is rejected with a link, and the numbers increment on the server.
* [ ] Unassigned clients show the least loaded agent with Accept; another organization's agent is refused.
* [ ] Deactivation requests match Figure 4.5:
  * Bulk approve marks the clients discarded in one transaction.
  * Reject keeps them active.
  * A user without permission is refused.
* [ ] Finance "Generate all slips" asks for confirmation:
  * It skips and lists employees without a base salary.
  * A rerun updates instead of duplicating.
  * "Download all slips" gives one slip per page.
* [ ] Sales managers import clients from CSV, with form validation, custom field columns and a row error report.

### 12.5 Platform administrator

* [ ] Platform admin login works only for `platform_admins` accounts.
* [ ] The organization list and detail show the fields of Section 4.3 and nothing from users or clients.
* [ ] Tenant and platform tokens cannot cross.

### 12.6 Look and regression

* [ ] Every portal uses the navy sidebar, white top bar, light background, cards, tables, buttons and tags of Section 9.
* [ ] All existing prototype features still work in every portal, scoped to the organization, and the whole test suite passes.
* [ ] Ordinary requests meet the 500 ms target at the 95th percentile in the test environment.
