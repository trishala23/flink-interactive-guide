# Contributing

This repository treats `master` as **protected**. After the initial
scaffold (committed directly to `master` to establish a working baseline,
and the first full build of the guide's content, done via PR to exercise
this same workflow), all further changes follow this workflow:

## Branch → PR → merge

1. Create a branch off `master`, named `feature/<short-description>` or
   `fix/<short-description>` (e.g. `feature/add-async-io-module`,
   `fix/window-visualizer-off-by-one`).
2. Make your changes on that branch.
3. Commit with a clear, conventional commit message (e.g.
   `feat: add async I/O module`, `fix: correct sliding window boundary math`).
4. Push the branch and open a pull request into `master`. Use the PR
   template — fill in what changed and how you tested it.
5. No direct commits to `master`. PRs are left open for manual review/merge
   unless explicitly requested otherwise.

**One-time manual setup recommended:** to actually enforce this on GitHub,
go to **Settings → Branches → Add rule** on the repository and add a
branch protection rule for `master` that requires a pull request before
merging.

## Local development

No build step, no dependencies, no install. Just serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Open the browser console while testing — every interactive widget is
plain DOM manipulation, so a JS error there is the first thing to check.

## Adding a new module

See `CLAUDE.md` for the step-by-step structure a new module page should
follow (nav, sidebar, quiz data shape, how progress tracking hooks in). Keep
new modules self-contained: reuse `assets/css/style.css` classes and the
shared `assets/js/app.js` / `assets/js/quiz.js` engines rather than
introducing a new pattern or a framework.

## Style

- Vanilla HTML/CSS/JS only — no build tooling, no frameworks, no npm
  dependencies. Anyone should be able to clone this and open `index.html`
  (or serve it statically) with nothing installed.
- Keep interactive widgets self-contained in the module page's own
  `<script>` block unless the logic is genuinely reusable (like
  `quiz.js` or `sql-playground.js`).
- Match the existing dark theme and CSS variables in
  `assets/css/style.css` — don't hardcode colors.

## Reporting issues / suggesting content

Open a GitHub issue describing the gap (a missing concept, an unclear
explanation, a broken widget). Content suggestions and corrections from
people learning Flink are especially welcome — that confusion is exactly
what the next module revision should fix.
