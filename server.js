/**
 * Workforce Capacity & Budget Planner — backend
 * ------------------------------------------------
 * Analyzes a company's current team (hours worked, output, salary) against
 * a project's requirements (total work needed, deadline, budget).
 *
 * Vercel-ready Express backend.
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

// -----------------------------------------------------------
// Middleware
// -----------------------------------------------------------

app.use(cors());
app.use(express.json());

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------------------------------------
// Sample / editable salary benchmarks
// Monthly INR
// -----------------------------------------------------------

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
    Surveyor: 25000,
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
    Supervisor: 45000,
    "Project Manager": 85000,
  },
};

// -----------------------------------------------------------
// In-memory employee store
// -----------------------------------------------------------

let employees = [];

// -----------------------------------------------------------
// Load data from data.json
// -----------------------------------------------------------

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, "utf-8");

      if (fileData.trim()) {
        const parsedData = JSON.parse(fileData);

        if (Array.isArray(parsedData)) {
          employees = parsedData;
        } else {
          employees = [];
        }
      }
    }
  } catch (error) {
    console.error(
      "Could not load data.json, starting with empty employee list:",
      error.message
    );

    employees = [];
  }
}

// -----------------------------------------------------------
// Save data to data.json
// -----------------------------------------------------------
//
// IMPORTANT:
// Vercel serverless functions use an ephemeral filesystem.
// This means data.json is suitable for local development,
// but it should NOT be treated as permanent database storage
// on Vercel.
//

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(employees, null, 2)
    );

    return true;
  } catch (error) {
    console.error(
      "Could not save data.json:",
      error.message
    );

    return false;
  }
}

loadData();

// -----------------------------------------------------------
// Health check
// -----------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    message: "Workforce Planner API is running",
  });
});

// -----------------------------------------------------------
// Root API information
// -----------------------------------------------------------

app.get("/api", (req, res) => {
  res.json({
    name: "Workforce Capacity & Budget Planner API",
    status: "online",
    endpoints: {
      health: "/api/health",
      employees: "/api/employees",
      benchmarks: "/api/benchmarks",
      analyze: "/api/analyze",
    },
  });
});

// -----------------------------------------------------------
// Employee CRUD
// -----------------------------------------------------------

// Get all employees
app.get("/api/employees", (req, res) => {
  res.json(employees);
});

// Add employee
app.post("/api/employees", (req, res) => {
  const {
    name,
    role,
    industry,
    hoursPerDay,
    monthlySalary,
    dailyOutputUnits,
  } = req.body;

  // Validate required fields
  if (
    !name ||
    !role ||
    !industry ||
    hoursPerDay === undefined ||
    monthlySalary === undefined
  ) {
    return res.status(400).json({
      error:
        "name, role, industry, hoursPerDay and monthlySalary are required.",
    });
  }

  const numericHours = Number(hoursPerDay);
  const numericSalary = Number(monthlySalary);

  if (
    !Number.isFinite(numericHours) ||
    !Number.isFinite(numericSalary)
  ) {
    return res.status(400).json({
      error:
        "hoursPerDay and monthlySalary must be valid numbers.",
    });
  }

  if (numericHours <= 0) {
    return res.status(400).json({
      error: "hoursPerDay must be greater than 0.",
    });
  }

  if (numericSalary < 0) {
    return res.status(400).json({
      error: "monthlySalary cannot be negative.",
    });
  }

  let numericDailyOutput = null;

  if (
    dailyOutputUnits !== undefined &&
    dailyOutputUnits !== null &&
    dailyOutputUnits !== ""
  ) {
    numericDailyOutput = Number(dailyOutputUnits);

    if (!Number.isFinite(numericDailyOutput)) {
      return res.status(400).json({
        error: "dailyOutputUnits must be a valid number.",
      });
    }
  }

  const employee = {
    id: Date.now().toString(),
    name: String(name).trim(),
    role: String(role).trim(),
    industry: String(industry).trim(),
    hoursPerDay: numericHours,
    monthlySalary: numericSalary,
    dailyOutputUnits: numericDailyOutput,
  };

  employees.push(employee);

  saveData();

  res.status(201).json(employee);
});

// Delete employee
app.delete("/api/employees/:id", (req, res) => {
  const before = employees.length;

  employees = employees.filter(
    (employee) => employee.id !== req.params.id
  );

  if (employees.length === before) {
    return res.status(404).json({
      error: "Employee not found.",
    });
  }

  saveData();

  res.json({
    deleted: true,
  });
});

// -----------------------------------------------------------
// Salary benchmarks
// -----------------------------------------------------------

app.get("/api/benchmarks", (req, res) => {
  res.json(SALARY_BENCHMARKS);
});

// -----------------------------------------------------------
// Core analysis endpoint
// -----------------------------------------------------------

app.post("/api/analyze", (req, res) => {
  const {
    totalWorkHoursRequired,
    daysRemaining,
    totalBudget,
    standardHoursPerNewHire = 8,
    targetIndustry = "IT",
    targetRole,
  } = req.body;

  // ---------------------------------------------------------
  // Validate required fields
  // ---------------------------------------------------------

  if (
    totalWorkHoursRequired === undefined ||
    daysRemaining === undefined ||
    totalBudget === undefined
  ) {
    return res.status(400).json({
      error:
        "totalWorkHoursRequired, daysRemaining and totalBudget are required.",
    });
  }

  // ---------------------------------------------------------
  // Convert values to numbers
  // ---------------------------------------------------------

  const hours = Number(totalWorkHoursRequired);
  const days = Number(daysRemaining);
  const budget = Number(totalBudget);
  const newHireDailyHours = Number(
    standardHoursPerNewHire
  );

  // ---------------------------------------------------------
  // Validate numbers
  // ---------------------------------------------------------

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(days) ||
    !Number.isFinite(budget) ||
    !Number.isFinite(newHireDailyHours)
  ) {
    return res.status(400).json({
      error: "All numeric inputs must contain valid numbers.",
    });
  }

  if (hours <= 0) {
    return res.status(400).json({
      error:
        "totalWorkHoursRequired must be greater than 0.",
    });
  }

  if (days <= 0) {
    return res.status(400).json({
      error: "daysRemaining must be greater than 0.",
    });
  }

  if (budget < 0) {
    return res.status(400).json({
      error: "totalBudget cannot be negative.",
    });
  }

  if (newHireDailyHours <= 0) {
    return res.status(400).json({
      error:
        "standardHoursPerNewHire must be greater than 0.",
    });
  }

  // ---------------------------------------------------------
  // 1. Current team capacity
  // ---------------------------------------------------------

  const currentTeamDailyHours = employees.reduce(
    (sum, employee) =>
      sum + Number(employee.hoursPerDay || 0),
    0
  );

  const currentTeamCapacity =
    currentTeamDailyHours * days;

  const currentMonthlySalaryBill = employees.reduce(
    (sum, employee) =>
      sum + Number(employee.monthlySalary || 0),
    0
  );

  const monthsRemaining = days / 30;

  const projectedCurrentLaborCost =
    currentMonthlySalaryBill * monthsRemaining;

  // ---------------------------------------------------------
  // 2. Shortfall & hiring requirement
  // ---------------------------------------------------------

  const hoursShortfall = Math.max(
    0,
    hours - currentTeamCapacity
  );

  const employeesNeeded =
    hoursShortfall > 0
      ? Math.ceil(
          hoursShortfall /
            (newHireDailyHours * days)
        )
      : 0;

  // ---------------------------------------------------------
  // 3. Budget affordability
  // ---------------------------------------------------------

  const remainingBudgetForNewHires =
    budget - projectedCurrentLaborCost;

  let affordableMonthlySalaryPerNewHire = null;

  let affordabilityNote =
    "No new hires needed — current team can cover the required hours.";

  if (employeesNeeded > 0) {
    if (remainingBudgetForNewHires <= 0) {
      affordableMonthlySalaryPerNewHire = 0;

      affordabilityNote =
        "Budget is already fully used by the existing team's projected cost — there is no room to hire, even though more hands are needed. Consider extending the deadline, increasing the budget, or re-scoping the work.";
    } else {
      affordableMonthlySalaryPerNewHire =
        remainingBudgetForNewHires /
        employeesNeeded /
        monthsRemaining;

      affordabilityNote =
        `Budget allows up to ~₹${Math.round(
          affordableMonthlySalaryPerNewHire
        ).toLocaleString("en-IN")}/month per new hire, for ${employeesNeeded} hire(s).`;
    }
  }

  // ---------------------------------------------------------
  // 4. Compare against salary benchmarks
  // ---------------------------------------------------------

  const industryBenchmarks =
    SALARY_BENCHMARKS[targetIndustry] ||
    SALARY_BENCHMARKS.Other;

  let roleSuggestions = [];

  if (employeesNeeded > 0) {
    roleSuggestions = Object.entries(
      industryBenchmarks
    )
      .map(([role, salary]) => ({
        role,
        benchmarkSalary: salary,

        affordable:
          affordableMonthlySalaryPerNewHire !== null &&
          salary <=
            affordableMonthlySalaryPerNewHire,

        selected:
          targetRole &&
          role.toLowerCase() ===
            String(targetRole).toLowerCase(),
      }))
      .sort(
        (a, b) =>
          a.benchmarkSalary -
          b.benchmarkSalary
      );
  }

  // ---------------------------------------------------------
  // 5. Overall completion status
  // ---------------------------------------------------------

  const canFinishOnTime =
    currentTeamCapacity >= hours;

  const budgetCanSupportRequiredHires =
    employeesNeeded === 0 ||
    remainingBudgetForNewHires > 0;

  // ---------------------------------------------------------
  // 6. Response
  // ---------------------------------------------------------

  res.json({
    inputs: {
      totalWorkHoursRequired: hours,
      daysRemaining: days,
      totalBudget: budget,
      standardHoursPerNewHire:
        newHireDailyHours,
      targetIndustry,
      targetRole: targetRole || null,
    },

    currentTeam: {
      headcount: employees.length,

      currentTeamDailyHours,

      currentTeamCapacity,

      currentMonthlySalaryBill,

      projectedCurrentLaborCost:
        Math.round(
          projectedCurrentLaborCost
        ),
    },

    analysis: {
      canFinishOnTime,

      hoursShortfall,

      employeesNeeded,

      remainingBudgetForNewHires:
        Math.round(
          remainingBudgetForNewHires
        ),

      affordableMonthlySalaryPerNewHire:
        affordableMonthlySalaryPerNewHire !==
        null
          ? Math.round(
              affordableMonthlySalaryPerNewHire
            )
          : null,

      budgetCanSupportRequiredHires,

      affordabilityNote,
    },

    roleSuggestions,
  });
});

// -----------------------------------------------------------
// Error handler
// -----------------------------------------------------------

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    error: "Internal server error.",
  });
});

// -----------------------------------------------------------
// Vercel + Local Development
// -----------------------------------------------------------
//
// Local:
//    npm start
//
// Vercel:
//    api/index.js imports this Express app.
//

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Workforce Planner running at http://localhost:${PORT}`
    );
  });
}

// Export Express app for Vercel
module.exports = app;