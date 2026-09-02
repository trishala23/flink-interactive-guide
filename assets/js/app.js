/* Shared behavior: mobile nav, progress tracking, code tabs. No dependencies. */

const PROGRESS_KEY = "flinkGuideProgress";

const MODULES = [
  { id: "introduction", title: "Introduction to Flink", file: "01-introduction.html" },
  { id: "architecture", title: "Architecture & Runtime", file: "02-architecture.html" },
  { id: "datastream-api", title: "The DataStream API", file: "03-datastream-api.html" },
  { id: "windows-time", title: "Time & Windows", file: "04-windows-time.html" },
  { id: "state-fault-tolerance", title: "State & Fault Tolerance", file: "05-state-fault-tolerance.html" },
  { id: "table-sql", title: "Table API & Flink SQL", file: "06-table-sql.html" },
  { id: "deployment", title: "Deployment & Operations", file: "07-deployment.html" },
  { id: "lab", title: "The Lab", file: "08-lab.html" },
  { id: "connectors", title: "Connectors Lab", file: "09-connectors.html" },
  { id: "production", title: "Production Architecture Lab", file: "10-production-architecture.html" },
];

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function setModuleComplete(moduleId) {
  try {
    const progress = getProgress();
    progress[moduleId] = true;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    document.dispatchEvent(new CustomEvent("progress-updated"));
  } catch (e) {
    /* localStorage unavailable (private mode, etc.) — quiz still works, just not persisted */
  }
}

function isModuleComplete(moduleId) {
  return !!getProgress()[moduleId];
}

function completedCount() {
  const progress = getProgress();
  return MODULES.filter((m) => progress[m.id]).length;
}

function renderProgressPill() {
  const pill = document.querySelector("[data-progress-pill]");
  if (!pill) return;
  const done = completedCount();
  pill.innerHTML = `<strong>${done}</strong> / ${MODULES.length} modules`;
}

function renderSidebarProgress() {
  document.querySelectorAll(".module-sidebar a[data-module-id]").forEach((a) => {
    const id = a.getAttribute("data-module-id");
    a.classList.toggle("done", isModuleComplete(id));
  });
}

function renderIndexBadges() {
  document.querySelectorAll("[data-module-badge]").forEach((el) => {
    const id = el.getAttribute("data-module-badge");
    const done = isModuleComplete(id);
    el.textContent = done ? "✓ Completed" : "Not started";
    el.className = "badge " + (done ? "badge-done" : "badge-todo");
  });
  const overall = document.querySelector("[data-overall-progress]");
  if (overall) {
    const done = completedCount();
    const pct = Math.round((done / MODULES.length) * 100);
    overall.textContent = `${done} of ${MODULES.length} modules complete (${pct}%)`;
  }
}

function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => links.classList.toggle("open"));
}

function markActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .module-sidebar a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href.endsWith(path) && path !== "index.html") a.classList.add("current");
    if (path === "index.html" && (href === "index.html" || href === "./" || href === "../index.html")) {
      a.classList.add("current");
    }
  });
}

function initCodeTabs() {
  document.querySelectorAll(".code-tabs").forEach((tabBar) => {
    const group = tabBar.nextElementSibling;
    if (!group) return;
    const tabs = tabBar.querySelectorAll(".code-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.getAttribute("data-target");
        group.querySelectorAll(".code-panel").forEach((p) => {
          p.classList.toggle("active", p.getAttribute("data-panel") === target);
        });
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  markActiveNav();
  renderProgressPill();
  renderSidebarProgress();
  renderIndexBadges();
  initCodeTabs();
});

document.addEventListener("progress-updated", () => {
  renderProgressPill();
  renderSidebarProgress();
  renderIndexBadges();
});
