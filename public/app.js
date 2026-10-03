const API = "/api";

const employeeForm = document.getElementById("employee-form");
const employeeTableBody = document.querySelector("#employee-table tbody");
const emptyNote = document.getElementById("employee-empty-note");
const analyzeForm = document.getElementById("analyze-form");
const resultsSection = document.getElementById("results");
const roleTableBody = document.querySelector("#role-table tbody");

async function fetchEmployees() {
  const res = await fetch(`${API}/employees`);
  const employees = await res.json();
  renderEmployees(employees);
}

function renderEmployees(employees) {
  employeeTableBody.innerHTML = "";
  emptyNote.hidden = employees.length > 0;

  employees.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.industry)}</td>
      <td>${escapeHtml(e.role)}</td>
      <td>${e.hoursPerDay}</td>
      <td>₹${Number(e.monthlySalary).toLocaleString("en-IN")}</td>
      <td>${e.dailyOutputUnits ?? "-"}</td>
      <td><button class="del-btn" data-id="${e.id}">Remove</button></td>
    `;
    employeeTableBody.appendChild(tr);
  });

  document.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/employees/${btn.dataset.id}`, { method: "DELETE" });
      fetchEmployees();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

employeeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("emp-name").value,
    industry: document.getElementById("emp-industry").value,
    role: document.getElementById("emp-role").value,
    hoursPerDay: document.getElementById("emp-hours").value,
    monthlySalary: document.getElementById("emp-salary").value,
    dailyOutputUnits: document.getElementById("emp-output").value || null,
  };

  const res = await fetch(`${API}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    employeeForm.reset();
    fetchEmployees();
  } else {
    const err = await res.json();
    alert(err.error || "Could not add employee.");
  }
});

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    totalWorkHoursRequired: document.getElementById("proj-hours").value,
    daysRemaining: document.getElementById("proj-days").value,
    totalBudget: document.getElementById("proj-budget").value,
    targetIndustry: document.getElementById("proj-industry").value,
  };

  const res = await fetch(`${API}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Could not run analysis.");
    return;
  }

  const data = await res.json();
  renderResults(data);
});

function renderResults(data) {
  resultsSection.hidden = false;

  document.getElementById("stat-capacity").textContent = `${data.currentTeam.currentTeamCapacity} hrs`;
  document.getElementById("stat-shortfall").textContent = `${data.analysis.hoursShortfall} hrs`;
  document.getElementById("stat-hires").textContent = data.analysis.employeesNeeded;
  document.getElementById("stat-current-cost").textContent = `₹${data.currentTeam.projectedCurrentLaborCost.toLocaleString("en-IN")}`;
  document.getElementById("stat-remaining-budget").textContent = `₹${data.analysis.remainingBudgetForNewHires.toLocaleString("en-IN")}`;
  document.getElementById("stat-affordable").textContent =
    data.analysis.affordableMonthlySalaryPerNewHire !== null
      ? `₹${data.analysis.affordableMonthlySalaryPerNewHire.toLocaleString("en-IN")}/mo`
      : "N/A";

  document.getElementById("affordability-note").textContent = data.analysis.affordabilityNote;

  // Simple bar chart: capacity vs required
  const required = data.inputs.totalWorkHoursRequired;
  const capacity = data.currentTeam.currentTeamCapacity;
  const max = Math.max(required, capacity, 1);

  const chart = document.getElementById("capacity-chart");
  chart.innerHTML = `
    <div class="bar-row">
      <span class="label">Required hours</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(required / max) * 100}%"></div></div>
      <span class="value">${required}</span>
    </div>
    <div class="bar-row">
      <span class="label">Current team capacity</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(capacity / max) * 100}%"></div></div>
      <span class="value">${capacity}</span>
    </div>
    <div class="bar-row">
      <span class="label">Shortfall</span>
      <div class="bar-track"><div class="bar-fill shortfall" style="width:${(data.analysis.hoursShortfall / max) * 100}%"></div></div>
      <span class="value">${data.analysis.hoursShortfall}</span>
    </div>
  `;

  // Role suggestions table
  roleTableBody.innerHTML = "";
  if (data.roleSuggestions.length === 0) {
    roleTableBody.innerHTML = `<tr><td colspan="3">No new hires needed.</td></tr>`;
  } else {
    data.roleSuggestions.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.role}</td>
        <td>₹${r.benchmarkSalary.toLocaleString("en-IN")}</td>
        <td class="${r.affordable ? "yes" : "no"}">${r.affordable ? "Yes" : "No"}</td>
      `;
      roleTableBody.appendChild(tr);
    });
  }

  resultsSection.scrollIntoView({ behavior: "smooth" });
}

fetchEmployees();
