# PRD — GitHub Repo Contribution MVP

## 1. Product Overview
This product is a SaaS application for non-technical people such as PMs or CEOs to make small contributions to existing codebases through a much simpler interface than developer tools.

The long-term vision may evolve, but this document covers only the MVP.

---

## 2. MVP Goal
The MVP goal is to prove that a user can:

1. sign up / log in
2. connect GitHub
3. import an existing GitHub repository as a project
4. open that project
5. view repository issues fetched from GitHub
6. make a very small file change
7. commit and push that change
8. create a pull request

### MVP success condition
A user can sign in, connect GitHub, import one repo, append `"hello world"` to a file, commit/push it, and open a PR.

---

## 3. Current Scope
### In scope
- user authentication
- GitHub connection
- importing an existing GitHub repo
- dashboard with imported projects
- project details page
- fetching issues live from GitHub
- a fake/simple chat-like input area that triggers a predefined file edit
- separate actions for:
  - edit
  - commit and push
  - create PR

### Out of scope
- AI-generated code changes
- real chat sessions
- issue creation from the app
- multi-user collaboration
- organization/team features
- advanced repo setup
- storing GitHub issues in the database
- handling many edge cases beyond the happy path

---

## 4. Core Product Flow
1. User signs up or logs in
2. User connects GitHub during onboarding
3. User reaches dashboard
4. User clicks **New**
5. User selects a repository from GitHub
6. App imports the repo as a project
7. User opens a project
8. App shows project details and issues fetched from GitHub
9. User triggers a simple file edit
10. User commits and pushes the change
11. User creates a PR

---

## 5. Product Decisions Made
### Repository handling
- The app will **not** create new repositories.
- The app will only connect to and import **existing GitHub repos**.
- For the MVP, **project = imported GitHub repository**.

### GitHub issues
- Issues will **not** be stored in the database.
- Issues will be fetched live from GitHub when a project is opened.

### GitHub disconnect behavior
- If a user disconnects GitHub, all imported projects for that user can be deleted in the MVP.

---

## 6. Tech Stack
- **Frontend / full-stack framework:** Next.js
- **Hosting:** Vercel
- **Auth:** Clerk
- **Database:** Neon Postgres
- **ORM:** Prisma
- **GitHub integration:** GitHub App

### Why this stack
This stack was chosen to optimize for:
- MVP speed
- low operational overhead
- clean full-stack TypeScript development
- easy auth integration
- secure GitHub access
- simple deployment

### Auth decision
Clerk was chosen over Better Auth and Neon Auth because it is the easiest and most mature option for quickly shipping the MVP.

---

## 7. Data Model
The MVP uses only **2 tables**.

### `users`
Represents a user of the application.

#### Fields
- `id` — unique
- `name`
- `email` — unique
- `github_username` — optional, unique
- `github_connected` — boolean, default `false`
- `github_connection_reference` — optional
- `created_at`

#### Notes
- A user may exist before connecting GitHub.
- For the MVP, one app user has at most one GitHub connection.

### `projects`
Represents an imported GitHub repository in the app.

#### Fields
- `id` — unique
- `repo_name`
- `repo_owner`
- `user_id`
- `created_at`

#### Notes
- For the MVP, project and repository are treated as the same thing.
- No separate `repositories` table is needed.

### Relationships
- One user can have many projects
- One project belongs to one user

### Uniqueness rules
#### In `users`
- `id` is unique
- `email` is unique
- `github_username` is unique

#### In `projects`
- `id` is unique
- `(user_id, repo_owner, repo_name)` must be unique together

This allows:
- different users to import the same repo
- one user to be blocked from importing the same repo twice

### Optional fields
#### In `users`
- `github_username`
- `github_connection_reference`

#### In `projects`
- no optional fields currently planned

---

## 8. Backend API Plan
### 1. `POST /projects`
Imports a GitHub repo as a project.

- **auth/session:** current logged-in user
- **body:** `repo_owner`, `repo_name`
- **response:** created project record

### 2. `GET /projects`
Lists all projects for the current user.

- **auth/session:** current logged-in user
- **body:** none
- **response:** dashboard-ready project list

### 3. `GET /projects/:id`
Fetches one project’s detail view.

- **auth/session:** current logged-in user
- **route param:** `id`
- **body:** none
- **response:** project details + GitHub-fetched issues

### 4. `PUT /projects/:id/edit`
Edits the target file for that project.

- **auth/session:** current logged-in user
- **route param:** `id`
- **body:** minimal edit input needed for the MVP
- **response:** success confirmation

### 5. `POST /projects/:id/commit`
Commits and pushes the change.

- **auth/session:** current logged-in user
- **route param:** `id`
- **body:** none for MVP
- **response:** success confirmation

### 6. `POST /projects/:id/pull-request`
Creates a PR for the committed change.

- **auth/session:** current logged-in user
- **route param:** `id`
- **body:** none for MVP
- **response:** success confirmation, optionally PR info

### API design rule followed
- user identity comes from auth/session
- project identity comes from route params
- request body contains only minimum action-specific input
- backend creates system-owned fields

---

## 9. Frontend Pages and Routes
### Routes
- `/`
- `/sign-in`
- `/sign-up`
- `/onboarding/github`
- `/dashboard`
- `/projects/new`
- `/projects/:id`

### Route purpose
#### `/`
Landing page or redirect logic.

#### `/sign-in`
User login.

#### `/sign-up`
User signup.

#### `/onboarding/github`
GitHub connection step after auth.

#### `/dashboard`
Shows imported projects and a **New** action.

#### `/projects/new`
Repo selection/import flow.

#### `/projects/:id`
Project workspace page showing:
- repo/issues section
- simple fake chat/edit area
- edit action
- commit/push action
- PR action

### Frontend flow
- Sign up / log in
- Connect GitHub
- Go to dashboard
- Click **New**
- Open repo list
- Import repo
- Open project
- View issues
- Edit file
- Commit and push
- Create PR

---

## 10. UX Notes
- The product should feel much simpler than developer tools.
- The UI should stay focused on the happy path.
- Even if backend actions are separate, the interface should remain understandable for non-technical users.
- The MVP can use a fake/simple chat-like area instead of a real conversational system.

---

## 11. Final MVP Summary
This MVP is a simple GitHub-connected web app where a user can authenticate, connect GitHub, import a repo, view issues, trigger a tiny file change, commit/push it, and create a pull request.

The planning intentionally stays minimal:
- small scope
- two database tables
- six backend endpoints
- simple frontend route structure
- no AI in MVP
- no issue persistence
- no unnecessary abstractions
