/*
 * A tiny, deliberately limited SQL interpreter for the in-browser playground.
 * Supports exactly one shape, matching the subset Flink SQL learners hit first:
 *
 *   SELECT <cols | * | AGG(col) [AS alias], ...>
 *   FROM orders
 *   [WHERE <col> <op> <value>]
 *   [GROUP BY <col>]
 *   [ORDER BY <col> [ASC|DESC]]
 *
 * This is a teaching toy, not a real parser — no joins, no subqueries, no
 * multi-column GROUP BY. It exists so the query examples in Module 06 are
 * actually runnable rather than just printed as text.
 */

const ORDERS_TABLE = [
  { id: 1, customer: "Alice", category: "Electronics", amount: 250 },
  { id: 2, customer: "Bob", category: "Books", amount: 40 },
  { id: 3, customer: "Alice", category: "Books", amount: 15 },
  { id: 4, customer: "Carol", category: "Electronics", amount: 800 },
  { id: 5, customer: "Bob", category: "Electronics", amount: 120 },
  { id: 6, customer: "Dave", category: "Toys", amount: 60 },
  { id: 7, customer: "Alice", category: "Toys", amount: 35 },
  { id: 8, customer: "Carol", category: "Books", amount: 22 },
  { id: 9, customer: "Dave", category: "Electronics", amount: 450 },
  { id: 10, customer: "Bob", category: "Toys", amount: 18 },
];

const AGG_RE = /^(COUNT|SUM|AVG|MIN|MAX)\(([^)]*)\)$/i;

function parseSelectItem(raw) {
  let text = raw.trim();
  let alias = null;
  const asMatch = text.match(/^(.*)\s+AS\s+(\w+)$/i);
  if (asMatch) {
    text = asMatch[1].trim();
    alias = asMatch[2];
  }
  const aggMatch = text.match(AGG_RE);
  if (aggMatch) {
    const fn = aggMatch[1].toUpperCase();
    const arg = aggMatch[2].trim();
    return { kind: "agg", fn, arg, alias: alias || `${fn.toLowerCase()}_${arg === "*" ? "all" : arg}` };
  }
  return { kind: "col", name: text, alias: alias || text };
}

function parseValue(raw) {
  const trimmed = raw.trim();
  const strMatch = trimmed.match(/^'(.*)'$/);
  if (strMatch) return strMatch[1];
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;
  return trimmed;
}

const OPS = {
  "=": (a, b) => a === b,
  "!=": (a, b) => a !== b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
};

function parseWhere(clause) {
  const m = clause.trim().match(/^(\w+)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) throw new Error(`Couldn't parse WHERE clause: "${clause}"`);
  const [, col, op, rawVal] = m;
  return { col, op, value: parseValue(rawVal) };
}

function applyAgg(fn, arg, rows) {
  if (fn === "COUNT") return rows.length;
  const nums = rows.map((r) => Number(r[arg])).filter((n) => !Number.isNaN(n));
  if (fn === "SUM") return nums.reduce((a, b) => a + b, 0);
  if (fn === "AVG") return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  if (fn === "MIN") return Math.min(...nums);
  if (fn === "MAX") return Math.max(...nums);
  throw new Error(`Unsupported aggregate: ${fn}`);
}

function runSQL(query) {
  const cleaned = query.trim().replace(/;\s*$/, "");
  const m = cleaned.match(
    /^select\s+(.*?)\s+from\s+(\w+)\s*(?:where\s+(.*?))?\s*(?:group\s+by\s+(.*?))?\s*(?:order\s+by\s+(.*?))?$/i
  );
  if (!m) throw new Error("Only SELECT ... FROM ... [WHERE ...] [GROUP BY ...] [ORDER BY ...] is supported.");

  const [, selectRaw, table, whereRaw, groupByRaw, orderByRaw] = m;
  if (table.toLowerCase() !== "orders") throw new Error(`Unknown table "${table}" — only "orders" is available.`);

  let rows = ORDERS_TABLE.slice();

  if (whereRaw) {
    const where = parseWhere(whereRaw);
    const opFn = OPS[where.op];
    rows = rows.filter((r) => opFn(r[where.col], where.value));
  }

  const selectItems = selectRaw.trim() === "*"
    ? Object.keys(ORDERS_TABLE[0]).map((name) => ({ kind: "col", name, alias: name }))
    : selectRaw.split(",").map(parseSelectItem);

  const hasAgg = selectItems.some((i) => i.kind === "agg");
  let resultRows;
  let columns;

  if (groupByRaw) {
    const groupCol = groupByRaw.trim();
    const groups = new Map();
    rows.forEach((r) => {
      const key = r[groupCol];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    resultRows = Array.from(groups.entries()).map(([key, groupRows]) => {
      const out = {};
      selectItems.forEach((item) => {
        if (item.kind === "agg") out[item.alias] = applyAgg(item.fn, item.arg, groupRows);
        else out[item.alias] = item.name === groupCol ? key : groupRows[0][item.name];
      });
      return out;
    });
    columns = selectItems.map((i) => i.alias);
  } else if (hasAgg) {
    const out = {};
    selectItems.forEach((item) => {
      out[item.alias] = item.kind === "agg" ? applyAgg(item.fn, item.arg, rows) : rows[0] ? rows[0][item.name] : null;
    });
    resultRows = [out];
    columns = selectItems.map((i) => i.alias);
  } else {
    resultRows = rows.map((r) => {
      const out = {};
      selectItems.forEach((item) => (out[item.alias] = r[item.name]));
      return out;
    });
    columns = selectItems.map((i) => i.alias);
  }

  if (orderByRaw) {
    const parts = orderByRaw.trim().split(/\s+/);
    const col = parts[0];
    const dir = (parts[1] || "asc").toLowerCase() === "desc" ? -1 : 1;
    resultRows = resultRows.slice().sort((a, b) => {
      if (a[col] < b[col]) return -1 * dir;
      if (a[col] > b[col]) return 1 * dir;
      return 0;
    });
  }

  return { columns, rows: resultRows };
}

function renderResultTable(target, result) {
  if (result.rows.length === 0) {
    target.innerHTML = '<p style="color: var(--text-faint); margin: 0;">0 rows.</p>';
    return;
  }
  const table = document.createElement("table");
  table.style.margin = "0";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr>${result.columns.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const tbody = document.createElement("tbody");
  result.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = result.columns.map((c) => `<td>${row[c]}</td>`).join("");
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  target.innerHTML = "";
  target.appendChild(table);
}

function initSqlPlayground() {
  const runBtn = document.getElementById("sql-run");
  const input = document.getElementById("sql-input");
  const output = document.getElementById("sql-output");
  const status = document.getElementById("sql-status");
  if (!runBtn || !input || !output) return;

  function execute() {
    try {
      const result = runSQL(input.value);
      renderResultTable(output, result);
      status.textContent = `${result.rows.length} row(s) returned.`;
      status.className = "result-box ok";
      status.style.display = "block";
    } catch (err) {
      output.innerHTML = "";
      status.textContent = err.message;
      status.className = "result-box err";
      status.style.display = "block";
    }
  }

  runBtn.addEventListener("click", execute);

  document.querySelectorAll("[data-sql-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.getAttribute("data-sql-example");
      execute();
    });
  });

  execute();
}

document.addEventListener("DOMContentLoaded", initSqlPlayground);
