# CLAUDE.md

Guidance for Claude (or any AI assistant) working in this repository.

## What this project is

A free, static, interactive web guide for learning Apache Flink. Ten
modules, each pairing a short theory explanation with a hands-on browser
widget and a quiz — Module 08 ("The Lab") is a capstone pipeline builder,
Module 09 ("Connectors Lab") simulates consuming from a Kafka topic or
Kinesis stream, and Module 10 ("Production Architecture Lab") is a
clickable diagram of a realistic end-to-end production stack with a
record-trace simulator. Zero backend, zero build step, zero
dependencies — deployed as-is to GitHub Pages. Read `README.md` for the
full feature list and roadmap.

## Hard constraints — do not violate these

- **No build step, no bundler, no npm/node dependencies, no framework.**
  Every page must work by opening the `.html` file directly or serving the
  folder with a plain static file server. If a task seems to need a
  framework or build tool, it's the wrong solution for this repo — find a
  vanilla approach instead.
- **No backend.** No server-side code, no database, no API calls to
  external services for core functionality. `localStorage` only, for
  progress tracking.
- **`master` is protected.** Never commit directly to `master` except for
  the kind of foundational scaffold commit already in history. All work
  happens on a `feature/<name>` or `fix/<name>` branch, merged via PR. See
  `CONTRIBUTING.md`.

## Repository structure

```
index.html                    Landing page
cheatsheet.html                Quick-reference page
modules/NN-slug.html           One file per module (01 through 10)
assets/css/style.css           The entire design system — all styling lives here
assets/js/app.js               Shared: nav, progress tracking, code tabs, active-link highlighting
assets/js/quiz.js              Generic quiz renderer (data-driven)
assets/js/sql-playground.js    The mini SQL interpreter used by Module 06 only
assets/js/lab.js               The pipeline simulation engine used by Module 08 only
assets/js/connectors-lab.js    The Kafka/Kinesis partition-consumption simulator used by Module 09 only
```

Module 10's diagram-click and record-trace logic lives inline in its own
`<script>` (like Module 02's architecture diagram) rather than a separate
`assets/js/` file — it's simple enough (deterministic branching, no math
to get wrong) that a dedicated engine file isn't warranted the way it was
for Modules 08–09.

Every module page is fully self-contained HTML with its own inline
`<script>` for widget logic — there is no client-side router and no
templating. This is intentional: it keeps each module readable and
diffable on its own, at the cost of some repeated boilerplate (the header
nav and sidebar `<ol>` are duplicated per page). If that duplication ever
becomes painful, that's a legitimate reason to introduce a light
build/include step — but don't do it preemptively.

## The `MODULES` array is the source of truth for module metadata

`assets/js/app.js` defines:

```js
const MODULES = [
  { id: "introduction", title: "Introduction to Flink", file: "01-introduction.html" },
  // ...
];
```

This drives progress-pill counts and completion badges. **If you add,
remove, or reorder a module, update this array** — nothing else derives
module metadata dynamically.

## How progress tracking works

- `localStorage["flinkGuideProgress"]` is a JSON object `{ [moduleId]:
  true }`.
- `setModuleComplete(moduleId)` (in `app.js`) sets it and fires a
  `progress-updated` event.
- `quiz.js` calls `setModuleComplete` automatically when every quiz
  question is answered correctly in one "Check answers" click.
- Index page badges (`data-module-badge="<id>"`) and sidebar dots
  (`a[data-module-id="<id>"]`) read this on `DOMContentLoaded` and on
  `progress-updated`.

There is no server, no accounts, no cross-device sync — this is
deliberate. Don't add a backend to "fix" that; it's the intended trade-off
for a zero-cost, zero-signup static site.

## How the quiz engine works

`assets/js/quiz.js` renders from `window.QUIZ_DATA`, which each module
page sets in an inline `<script>` **before** including `quiz.js`:

```js
window.QUIZ_DATA = {
  title: "Check your understanding",
  questions: [
    { prompt: "...", options: ["A", "B", "C"], correct: 1, explain: "..." },
  ],
};
```

The page also needs an empty `<div id="quiz-root" data-module-id="...">`
where the quiz mounts. `quiz.js` must be the **last** script tag on the
page (after the inline script that sets `QUIZ_DATA`).

## Adding a new module

1. Copy an existing module file (e.g. `modules/07-deployment.html`) as
   your starting point — it already has the correct header, sidebar list,
   and script include order.
2. Update `<title>`, the `module-kicker`/`<h1>`/intro paragraph, and the
   body content.
3. Add a new `<li><a data-module-id="..." href="...">` entry to the
   sidebar `<ol>` **in every existing module page** (not just the new
   one) — the sidebar list is duplicated per page, not shared.
4. Add the module to the `MODULES` array in `assets/js/app.js`.
5. Add a card for it to the module grid in `index.html`, with a matching
   `data-module-badge="<id>"`.
6. Update the `module-pager` (prev/next links) on the new module and its
   neighbors so the chain stays correct.
7. Write a `window.QUIZ_DATA` block with 3-4 questions before the
   `quiz.js` include.
8. If the module needs a genuinely interactive widget (not just a quiz),
   build it as inline JS using the existing `.widget`, `.controls`,
   `.result-box`, `.pill-toggle` CSS classes for visual consistency —
   don't introduce new widget chrome unless the existing classes truly
   can't express it.

## Design system

Everything is driven by CSS variables at the top of
`assets/css/style.css` (`--bg`, `--accent`, `--accent-gradient`, etc.).
Single dark theme by design (see README roadmap for the optional
light-theme toggle as a future item) — don't hardcode colors in new
markup; reuse the variables and existing utility classes (`.card`,
`.widget`, `.callout`, `.badge`, `.btn`).

## Testing changes

There's no test suite — this is a content site. Before pushing:

1. Serve the folder locally (`python3 -m http.server 8000`) and open the
   changed page(s) in a browser.
2. Click through every interactive widget on the page you touched,
   including edge cases (empty input on the DataStream "predict the
   output" boxes, running the SQL playground with an invalid query,
   completing a quiz with a wrong answer first).
3. Check the browser console for errors — widgets are plain DOM
   manipulation with no error boundaries.
4. Resize to a narrow viewport (or use dev tools device mode) — the
   layout is responsive but new widgets should be checked explicitly,
   especially anything with fixed pixel widths (like the window
   visualizer's timeline).

## Workflow reminder

Branch → commit → push → PR into `master`. See `CONTRIBUTING.md` for the
full detail and the PR template for what to report in the description.
