/**
 * Workforce Capacity & Budget Planner — backend
 * ------------------------------------------------
 * Analyzes a company's current team (hours worked, output, salary) against
 * a project's requirements (total work needed, deadline, budget) and tells
 * you:
 *   1. Whether the current team can finish on time
 *   2. How many more people you need to hire (and roughly in which roles)
 *   3. Whether your remaining budget can actually afford those hires,
 *      compared against sample industry salary benchmarks
 *
 * Data is kept in memory (data.json is used only to persist between
 * restarts) — no database setup required to run this.
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// Sample / editable salary benchmarks (monthly, INR) across a few industries.
// These are placeholder reference figures for the demo — swap in real market
// data (e.g. from Glassdoor/AmbitionBox/PayScale exports) for real use.
// ---------------------------------------------------------------------------
const SALARY_BENCHMARKS = {
  IT: {
    "Junior Developer": 35000,
    "Senior Developer": 75000,
    "QA Engineer": 40000,
    "DevOps Engineer": 65000,
    "Project Manager": 90000,
  },
  Civil: {
    "Site Engineer": 30000,
    "Senior Civil Engineer": 70000,
    "Site Supervisor": 28000,
    "Surveyor": 25000,
    "Project Manager": 95000,
  },
  Mechanical: {
    "Junior Mechanical Engineer": 32000,
    "Senior Mechanical Engineer": 72000,
    "Machine Operator": 22000,
    "Quality Inspector": 30000,
    "Project Manager": 90000,
  },
  Other: {
    "Junior Staff": 28000,
    "Senior Staff": 60000,
    "Supervisor": 45000,
    "Project Manager": 85000,
  },
};

// ---------------------------------------------------------------------------
// In-memory store, loaded from / saved to data.json so it survives restarts
// ---------------------------------------------------------------------------
let employees = [];

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      employees = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Could not load data.json, starting fresh.", e.message);
    employees = [];
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(employees, null, 2));
}

loadData();

// ---------------------------------------------------------------------------
// Employee CRUD
// ---------------------------------------------------------------------------
app.get("/api/employees", (req, res) => {
  res.json(employees);
});

app.post("/api/employees", (req, res) => {
  const { name, role, industry, hoursPerDay, monthlySalary, dailyOutputUnits } = req.body;

  if (!name || !role || !industry || !hoursPerDay || !monthlySalary) {
    return res.status(400).json({ error: "name, role, industry, hoursPerDay and monthlySalary are required." });
  }

  const employee = {
    id: Date.now().toString(),
    name: String(name),
    role: String(role),
    industry: String(industry),
    hoursPerDay: Number(hoursPerDay),
    monthlySalary: Number(monthlySalary),
    dailyOutputUnits: dailyOutputUnits ? Number(dailyOutputUnits) : null,
  };

  employees.push(employee);
  saveData();
  res.status(201).json(employee);
});

app.delete("/api/employees/:id", (req, res) => {
  const before = employees.length;
  employees = employees.filter((e) => e.id !== req.params.id);
  if (employees.length === before) {
    return res.status(404).json({ error: "Employee not found." });
  }
  saveData();
  res.json({ deleted: true });
});

app.get("/api/benchmarks", (req, res) => {
  res.json(SALARY_BENCHMARKS);
});

// ---------------------------------------------------------------------------
// Core analysis endpoint
// ---------------------------------------------------------------------------
app.post("/api/analyze", (req, res) => {
  const {
    totalWorkHoursRequired, // total person-hours needed to finish the project
    daysRemaining,          // calendar days left until deadline
    totalBudget,            // total money available for the remaining period (labor cost)
    standardHoursPerNewHire = 8,
    targetIndustry = "IT",
    targetRole,
  } = req.body;

  if (!totalWorkHoursRequired || !daysRemaining || totalBudget === undefined) {
    return res.status(400).json({
      error: "totalWorkHoursRequired, daysRemaining and totalBudget are required.",
    });
  }

  const hours = Number(totalWorkHoursRequired);
  const days = Number(daysRemaining);
  const budget = Number(totalBudget);

  if (days <= 0) {
    return res.status(400).json({ error: "daysRemaining must be greater than 0." });
  }

  // 1. Current team capacity -------------------------------------------------
  const currentTeamDailyHours = employees.reduce((sum, e) => sum + e.hoursPerDay, 0);
  const currentTeamCapacity = currentTeamDailyHours * days;
  const currentMonthlySalaryBill = employees.reduce((sum, e) => sum + e.monthlySalary, 0);
  const monthsRemaining = days / 30;
  const projectedCurrentLaborCost = currentMonthlySalaryBill * monthsRemaining;

  // 2. Shortfall & hiring need -------------------------------------------------
  const hoursShortfall = Math.max(0, hours - currentTeamCapacity);
  const employeesNeeded =
    hoursShortfall > 0 ? Math.ceil(hoursShortfall / (standardHoursPerNewHire * days)) : 0;

  // 3. Budget affordability ----------------------------------------------------
  const remainingBudgetForNewHires = budget - projectedCurrentLaborCost;
  let affordableMonthlySalaryPerNewHire = null;
  let affordabilityNote = "No new hires needed — current team can cover the required hours.";

  if (employeesNeeded > 0) {
    if (remainingBudgetForNewHires <= 0) {
      affordableMonthlySalaryPerNewHire = 0;
      affordabilityNote =
        "Budget is already fully used by the existing team's projected cost — there is no room to hire, even though more hands are needed. Consider extending the deadline, increasing budget, or re-scoping the work.";
    } else {
      affordableMonthlySalaryPerNewHire = remainingBudgetForNewHires / employeesNeeded / monthsRemaining;
      affordabilityNote = `Budget allows up to ~₹${Math.round(
        affordableMonthlySalaryPerNewHire
      ).toLocaleString("en-IN")}/month per new hire, for ${employeesNeeded} hire(s).`;
    }
  }

  // 4. Compare against benchmark & suggest roles ------------------------------
  const industryBenchmarks = SALARY_BENCHMARKS[targetIndustry] || SALARY_BENCHMARKS.Other;
  let roleSuggestions = [];

  if (employeesNeeded > 0) {
    roleSuggestions = Object.entries(industryBenchmarks)
      .map(([role, salary]) => ({
        role,
        benchmarkSalary: salary,
        affordable:
          affordableMonthlySalaryPerNewHire !== null && salary <= affordableMonthlySalaryPerNewHire,
      }))
      .sort((a, b) => a.benchmarkSalary - b.benchmarkSalary);
  }

  res.json({
    inputs: { totalWorkHoursRequired: hours, daysRemaining: days, totalBudget: budget, targetIndustry, targetRole },
    currentTeam: {
      headcount: employees.length,
      currentTeamDailyHours,
      currentTeamCapacity,
      currentMonthlySalaryBill,
      projectedCurrentLaborCost: Math.round(projectedCurrentLaborCost),
    },
    analysis: {
      hoursShortfall,
      employeesNeeded,
      remainingBudgetForNewHires: Math.round(remainingBudgetForNewHires),
      affordableMonthlySalaryPerNewHire:
        affordableMonthlySalaryPerNewHire !== null ? Math.round(affordableMonthlySalaryPerNewHire) : null,
      affordabilityNote,
    },
    roleSuggestions,
  });
});

app.listen(PORT, () => {
  console.log(`Workforce Planner running at http://localhost:${PORT}`);
});
