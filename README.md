# Flink Interactive Guide

A free, static, no-build web app for learning Apache Flink — theory
explanations paired with hands-on browser exercises. Pure HTML, CSS, and
JavaScript, no backend, no bundler, deployed straight to GitHub Pages.

**Live site:** `https://trishala23.github.io/flink-interactive-guide/`
(once Pages is enabled — see [Deploying](#deploying-to-github-pages) below).

## What's in the guide

Seven modules, each pairing a short plain-English explanation with a
genuine interactive widget and a knowledge-check quiz:

| # | Module | Interactive piece |
|---|--------|--------------------|
| 01 | Introduction to Flink | Batch vs. streaming toggle, scenario matcher |
| 02 | Architecture & Runtime | Clickable cluster diagram (JobManager, TaskManagers, slots) |
| 03 | The DataStream API | "Predict the output" exercises, checked against a real computed answer |
| 04 | Time & Windows | Live tumbling/sliding/session window visualizer, watermark walkthrough |
| 05 | State & Fault Tolerance | Checkpoint-and-recover failure simulator |
| 06 | Table API & Flink SQL | A real (small) SQL interpreter running in the browser |
| 07 | Deployment & Operations | Click-through wizard recommending a deployment mode |

Plus a [cheatsheet](cheatsheet.html) for quick reference once you've been
through the modules.

Progress is tracked per-module in `localStorage` — pass a module's quiz
(100%) to mark it complete. Nothing is sent anywhere; it's entirely
client-side.

## Plan / roadmap

The guide currently covers the core streaming fundamentals end to end
(architecture → API → time → state → SQL → deployment). Ideas for future
modules, roughly in priority order:

- [ ] **Connectors module** — Kafka, filesystem, JDBC sources/sinks, and the connector contract (source splits, sink commit protocol)
- [ ] **Async I/O & side outputs** — enriching a stream with external lookups without blocking
- [ ] **CEP (Complex Event Processing)** — pattern matching over a stream with the `flink-cep` library
- [ ] **Testing Flink jobs** — unit-testing operators, `MiniClusterWithClientResource`, harness-based testing
- [ ] **A light/dark theme toggle** (currently dark-only by design, to keep initial scope tight)
- [ ] **A "certificate of completion" view** once all 7 modules are marked done
- [ ] Expand the mini SQL playground to support multi-column `GROUP BY` and simple joins

Contributions toward any of these (or anything else that fills a gap) are
welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Running locally

No build step required. Serve the folder with any static file server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that deploys the site to Pages on every
push to `master`. To activate it (one-time):

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **"GitHub Actions"**.
3. Push to `master` (or re-run the workflow manually from the **Actions**
   tab) to trigger a deployment. The site will publish at
   `https://<your-username>.github.io/<your-repo>/` within a minute or two.
   Check the **Actions** tab for status and the live URL.

GitHub Pages is free for public repositories, serves over HTTPS by
default, and needs no server to maintain — a good fit for a fully static,
client-side app like this one.

## Contributing / Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full branch-and-PR workflow.
Short version: `master` is protected, changes go through a
`feature/<name>` or `fix/<name>` branch and a pull request, no direct
commits.

See [CLAUDE.md](CLAUDE.md) for the project's structure and conventions —
useful context whether you (or an AI assistant) are adding a new module or
fixing a widget.

## File structure

```
index.html                    Landing page: hero, module grid, progress overview
cheatsheet.html                Quick-reference tables (DataStream API, CLI, SQL, concepts)
modules/
  01-introduction.html         ... through ...
  07-deployment.html           Seven module pages, each theory + widget(s) + quiz
assets/
  css/style.css                Shared dark-theme design system
  js/app.js                    Nav, progress tracking (localStorage), code tabs
  js/quiz.js                   Data-driven quiz engine used by every module
  js/sql-playground.js         The mini SQL interpreter used in Module 06
.github/
  workflows/deploy.yml         GitHub Pages deploy on push to master
  PULL_REQUEST_TEMPLATE.md     PR checklist
CLAUDE.md                       Project guide for AI-assisted contributions
CONTRIBUTING.md                 Branch/PR workflow, local dev, style
```

## License

MIT — see the [LICENSE](LICENSE) file. Content corrections and new
modules are welcome contributions; Apache Flink itself is a trademark of
the Apache Software Foundation, and this project is an independent,
unofficial learning resource.
