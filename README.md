# Workforce Capacity & Budget Planner

A small full-stack tool (Node.js + Express backend, plain HTML/CSS/JS
frontend) that answers two questions for any company — IT, Civil,
Mechanical, or otherwise:

1. **Can my current team finish this project on time?**
   (based on how many people you have, how many hours a day they work)
2. **If not, how many more people do I need to hire, and can I actually
   afford them** given my remaining budget and realistic salary
   benchmarks for the industry?

## What you need on your laptop

- **Node.js** (v16 or newer) — download from https://nodejs.org if you
  don't have it. Check with:
  ```
  node -v
  npm -v
  ```
  That's it — no MongoDB, no database setup, nothing else to install
  system-wide.

## How to run it

1. Unzip this project anywhere on your laptop.
2. Open a terminal / command prompt in the project folder.
3. Install the two small dependencies (Express + CORS):
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open your browser to:
   ```
   http://localhost:3000
   ```

That's the whole setup. The app stores your data in a local `data.json`
file (created automatically) so your team list survives a restart —
no external database needed.

## How it works

### 1. You add your current team
For each employee: name, industry, role, hours worked per day, and
monthly salary (plus an optional "daily output units" field if you
want to track productivity separately from hours).

### 2. You enter the project's requirements
- **Total work required**, in person-hours (e.g. "this project needs
  2,000 person-hours of work to finish")
- **Days remaining** until the deadline
- **Total budget** available for the remaining period

### 3. The app calculates
- **Current team capacity** = (sum of everyone's hours/day) × days
  remaining
- **Hours shortfall** = required hours − current capacity (0 if your
  team already covers it)
- **Employees needed** = shortfall ÷ (a standard 8-hour day × days
  remaining), rounded up
- **Projected current labor cost** = current team's monthly salary
  total × (days remaining ÷ 30)
- **Budget left for new hires** = total budget − projected current
  labor cost
- **Affordable salary per new hire** = budget left ÷ employees needed
  ÷ months remaining
- Finally, it compares that affordable salary against a small sample
  benchmark table (editable in `server.js` → `SALARY_BENCHMARKS`) for
  IT / Civil / Mechanical / Other roles, and flags which roles you can
  realistically afford to hire for.

### Where the logic lives
- All the calculation logic is in `server.js` (`/api/analyze` route) —
  this is the part worth understanding and being able to explain, since
  it's the actual "analysis" the project claims to do.
- The salary benchmark numbers are placeholders for demo purposes —
  swap them for real figures (e.g. exported from Glassdoor/AmbitionBox)
  if you want to use this for real.

## Extending it (optional, good interview talking points)

- Swap the `data.json` file storage for MongoDB (you already know
  Mongoose) for multi-user / production use.
- Add authentication (JWT, which you've already used in your other
  projects) so each company/manager only sees their own team data.
- Add a CSV import for bulk-adding employees instead of one at a time.
- Track productivity (the optional "daily output units" field) against
  salary to compute a cost-per-unit-of-output metric, not just
  cost-per-hour.
