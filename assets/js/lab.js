/*
 * The Lab: a tiny, real (not faked) stream-processing simulator.
 *
 * A "pipeline" is an ordered array of operator objects. runPipeline()
 * replays a fixed, timestamped `orders` stream through that pipeline
 * exactly once and returns a full trace: what happened to every event at
 * every stage, plus every aggregate result the pipeline would emit and
 * exactly which event's arrival triggers each one. The UI in
 * modules/08-lab.html only handles animation/rendering — all the actual
 * "was this correct" logic lives here, in one place, so it can't drift
 * out of sync with what's displayed.
 *
 * Operator shapes:
 *   { type: 'filter', field, op, value }
 *   { type: 'map', preset }
 *   { type: 'keyBy', field }
 *   { type: 'aggregate', fn, windowed, windowSize }
 */

const LAB_ORDERS = [
  { id: 1, customer: "Alice", category: "Electronics", amount: 250, t: 0 },
  { id: 2, customer: "Bob", category: "Books", amount: 40, t: 1 },
  { id: 3, customer: "Alice", category: "Books", amount: 15, t: 2 },
  { id: 4, customer: "Carol", category: "Electronics", amount: 800, t: 3 },
  { id: 5, customer: "Bob", category: "Electronics", amount: 120, t: 4 },
  { id: 6, customer: "Dave", category: "Toys", amount: 60, t: 5 },
  { id: 7, customer: "Alice", category: "Toys", amount: 35, t: 6 },
  { id: 8, customer: "Carol", category: "Books", amount: 22, t: 7 },
  { id: 9, customer: "Dave", category: "Electronics", amount: 450, t: 8 },
  { id: 10, customer: "Bob", category: "Toys", amount: 18, t: 9 },
  { id: 11, customer: "Alice", category: "Electronics", amount: 300, t: 10 },
  { id: 12, customer: "Carol", category: "Toys", amount: 75, t: 11 },
];

const LAB_FIELD_TYPES = { amount: "number", category: "string", customer: "string" };

const LAB_MAP_PRESETS = {
  tax10: { label: "Add 10% tax (amount × 1.1)", apply: (r) => ({ ...r, amount: Math.round(r.amount * 1.1 * 100) / 100 }) },
  roundDown10: { label: "Round amount down to nearest 10", apply: (r) => ({ ...r, amount: Math.floor(r.amount / 10) * 10 }) },
};

function labEvalFilter(record, op) {
  const a = record[op.field];
  const b = op.value;
  switch (op.op) {
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    case "=": return a === b;
    case "!=": return a !== b;
    default: return true;
  }
}

function labComputeAgg(values, fn) {
  if (fn === "count") return values.length;
  if (values.length === 0) return 0;
  if (fn === "sum") return round2(values.reduce((a, b) => a + b, 0));
  if (fn === "avg") return round2(values.reduce((a, b) => a + b, 0) / values.length);
  if (fn === "min") return round2(Math.min(...values));
  if (fn === "max") return round2(Math.max(...values));
  return null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Replays LAB_ORDERS through `pipeline` once. Returns:
 *   trace: per-event record of what happened at each non-aggregate stage
 *   aggEmits: every aggregate result, each tagged with the event id whose
 *             arrival triggers it (so the UI can reveal it at the right moment)
 */
function runPipeline(pipeline) {
  const trace = [];
  const survivors = [];

  LAB_ORDERS.forEach((raw) => {
    let record = { ...raw };
    let alive = true;
    let key = null;
    const stages = [];

    pipeline.forEach((op) => {
      if (op.type === "aggregate") return; // handled after the per-event pass
      if (!alive) {
        stages.push({ opId: op.id, outcome: "skipped" });
        return;
      }
      if (op.type === "filter") {
        const pass = labEvalFilter(record, op);
        stages.push({ opId: op.id, outcome: pass ? "pass" : "drop" });
        if (!pass) alive = false;
      } else if (op.type === "map") {
        record = LAB_MAP_PRESETS[op.preset].apply(record);
        stages.push({ opId: op.id, outcome: "transform", detail: { ...record } });
      } else if (op.type === "keyBy") {
        key = record[op.field];
        stages.push({ opId: op.id, outcome: "key", detail: key });
      }
    });

    trace.push({ event: raw, record, alive, key, stages });
    if (alive) survivors.push({ record, key, t: raw.t, eventId: raw.id });
  });

  const aggOp = pipeline.find((o) => o.type === "aggregate");
  const aggEmits = [];

  if (aggOp) {
    if (!aggOp.windowed) {
      const running = {};
      const values = {};
      survivors.forEach((s) => {
        const k = s.key === null ? "__all__" : s.key;
        values[k] = values[k] || [];
        values[k].push(aggOp.fn === "count" ? 1 : s.record.amount);
        running[k] = labComputeAgg(aggOp.fn === "count" ? values[k] : values[k], aggOp.fn);
        aggEmits.push({ triggeredByEventId: s.eventId, key: k, value: running[k], windowed: false });
      });
    } else {
      const size = aggOp.windowSize;
      const open = {};
      survivors.forEach((s) => {
        const k = s.key === null ? "__all__" : s.key;
        const wStart = Math.floor(s.t / size) * size;
        if (open[k] && open[k].start !== wStart) {
          aggEmits.push({
            triggeredByEventId: s.eventId,
            key: k,
            value: labComputeAgg(open[k].values, aggOp.fn),
            windowed: true,
            windowStart: open[k].start,
            windowEnd: open[k].start + size,
          });
          open[k] = null;
        }
        if (!open[k]) open[k] = { start: wStart, values: [] };
        open[k].values.push(aggOp.fn === "count" ? 1 : s.record.amount);
      });
      Object.entries(open).forEach(([k, w]) => {
        if (!w) return;
        aggEmits.push({
          triggeredByEventId: "end",
          key: k,
          value: labComputeAgg(w.values, aggOp.fn),
          windowed: true,
          windowStart: w.start,
          windowEnd: w.start + size,
        });
      });
    }
  }

  return { trace, survivors, aggEmits, aggOp };
}

/** Renders the equivalent Java DataStream API code for a pipeline, for the code panel. */
function generateLabCode(pipeline) {
  let code = 'DataStream<Order> orders = env.fromSource(ordersSource, watermarkStrategy, "orders");\n\norders';
  pipeline.forEach((op) => {
    if (op.type === "filter") {
      const val = LAB_FIELD_TYPES[op.field] === "string" ? `"${op.value}"` : op.value;
      code += `\n    .filter(o -> o.${op.field} ${op.op === "=" ? "==" : op.op} ${val})`;
    } else if (op.type === "map") {
      code += `\n    .map(o -> ${op.preset === "tax10" ? "withTax(o, 0.10)" : "roundDown(o, 10)"})`;
    } else if (op.type === "keyBy") {
      code += `\n    .keyBy(o -> o.${op.field})`;
    } else if (op.type === "aggregate") {
      if (op.windowed) code += `\n    .window(TumblingEventTimeWindows.of(Time.seconds(${op.windowSize})))`;
      const fnCode = {
        sum: '.sum("amount")',
        avg: '.aggregate(new AverageAggregate())',
        min: '.min("amount")',
        max: '.max("amount")',
        count: ".count()",
      }[op.fn];
      code += `\n    ${fnCode}`;
    }
  });
  code += "\n    .print();";
  return code;
}

/** Mission definitions: instructions plus a structural check against the built pipeline. */
const LAB_MISSIONS = {
  "big-spender": {
    title: "Mission: Big Spender Alert",
    scenario:
      "The sales team wants to know, live, how much each customer has spent so far today — " +
      "but only counting orders big enough to matter.",
    goal: [
      "Keep only orders over $100 (filter: amount > 100)",
      "Group the remaining orders by customer (keyBy: customer)",
      "Keep a running total per customer — no window, just an always-updating total (aggregate: sum, not windowed)",
    ],
    validate(pipeline) {
      const fi = pipeline.findIndex((o) => o.type === "filter" && o.field === "amount" && o.op === ">" && Number(o.value) === 100);
      const ki = pipeline.findIndex((o) => o.type === "keyBy" && o.field === "customer");
      const ai = pipeline.findIndex((o) => o.type === "aggregate" && o.fn === "sum" && !o.windowed);
      if (fi === -1) return { ok: false, message: "Missing a filter for amount > 100." };
      if (ki === -1) return { ok: false, message: "Missing a keyBy on customer." };
      if (ai === -1) return { ok: false, message: "Missing a running (non-windowed) sum aggregate." };
      if (!(fi < ki && ki < ai)) return { ok: false, message: "Right pieces, wrong order — filter, then keyBy, then aggregate." };
      return { ok: true, message: "That's it — filter, then keyBy(customer), then a running sum. Run it and watch each customer's total update live." };
    },
  },
  "category-sales": {
    title: "Mission: 5-Second Category Sales",
    scenario:
      "A live dashboard needs total sales per product category, refreshed every 5 seconds — " +
      "the same shape of question as Module 06's \"SUM(amount) GROUP BY category\", just built by hand this time.",
    goal: [
      "Group orders by category (keyBy: category)",
      "Sum amounts in tumbling 5-second windows (aggregate: sum, windowed, 5s)",
    ],
    validate(pipeline) {
      const ki = pipeline.findIndex((o) => o.type === "keyBy" && o.field === "category");
      const ai = pipeline.findIndex((o) => o.type === "aggregate" && o.fn === "sum" && o.windowed && Number(o.windowSize) === 5);
      if (ki === -1) return { ok: false, message: "Missing a keyBy on category." };
      if (ai === -1) return { ok: false, message: "Missing a 5-second tumbling sum aggregate." };
      if (!(ki < ai)) return { ok: false, message: "keyBy needs to come before the windowed aggregate." };
      return { ok: true, message: "keyBy(category) then a 5s tumbling sum — run it and watch a new total fire for each category every 5 seconds of event time." };
    },
  },
};
