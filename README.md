# SQL Query Explainer

An interactive, browser-based SQL learning tool that shows how a real SQLite engine transforms rows clause by clause—and why some queries are faster than others.

[![Live demo](https://img.shields.io/badge/live-demo-0d9488?style=flat-square)](https://siddarthasiripragada.github.io/Sql-explainer/)
[![Validate](https://github.com/siddarthasiripragada/Sql-explainer/actions/workflows/validate.yml/badge.svg)](https://github.com/siddarthasiripragada/Sql-explainer/actions/workflows/validate.yml)

**Live site:** https://siddarthasiripragada.github.io/Sql-explainer/

## Why this exists

SQL is written in one order but logically executed in another:

```text
Written:   SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
Executed:  FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT
```

This project makes that execution order visible. It runs the query with `sql.js`, reconstructs intermediate stages, and displays the real row set at each step.

## Highlights

- Live SQL editor with debounced execution and shareable URL state
- Real SQLite execution entirely inside the browser
- Visual stages for `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `DISTINCT`, `ORDER BY`, and `LIMIT`
- Row lineage, filtering, grouping, sorting, NULL handling, and final-result tables
- Guided playback, step controls, speed adjustment, tooltips, and keyboard interaction
- Example datasets for banking and commerce scenarios
- Responsive desktop and mobile layouts
- Friendly syntax, unsupported-query, and zero-row states
- Interactive write examples for common DDL and DML concepts

## Performance Lab

The Performance Lab explains storage-level behavior with simple visual metaphors while keeping the displayed numbers connected to real SQLite queries.

| Topic | Visual model | Technical basis |
| --- | --- | --- |
| Index access | Library card catalog | Real `EXPLAIN QUERY PLAN` comparison |
| B-tree | Sorted drawers and leaf cards | Real values and row pointers |
| Bitmap | Yes/no maps | Concept simulation; SQLite does not provide bitmap indexes |
| Composite index | Ordered multi-column keys | Real SQLite index plans |
| Hash index | Lookup buckets | Concept simulation; not a native SQLite index type |
| Partial index | Indexed subset | Real SQLite partial index plan |
| Partition pruning | Locked archive rooms | Separate real SQLite tables used as an honest stand-in |
| Sort and join | Work areas and keyed lookups | Real row counts and query plans |

SQLite does not support native table partitioning or `MERGE`. Where the app teaches those warehouse concepts, the UI labels them as simulations.

## Supported query shapes

The visualizer is strongest with a single `SELECT` statement using:

- One base table and a basic join
- Row filters and simple subqueries
- Grouping and aggregate functions
- Group filters with `HAVING`
- Projection, aliases, and `DISTINCT`
- Sorting, `LIMIT`, and `OFFSET`

The app detects constructs that are not visualized yet—such as CTEs, window functions, `UNION`, correlated subqueries, and complex multi-join plans—and shows a clear message instead of silently producing a misleading diagram.

## Run locally

The production page is a static client-side app. No backend or database server is required.

### Quickest option

```bash
python -m http.server 4173
```

Open http://localhost:4173/.

### Vite option

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Project structure

```text
.
├── index.html                         # Production app and SQL execution pipeline
├── performance-lab/
│   ├── performance-lab.css            # Library-themed performance visuals
│   └── performance-lab.js             # Lazy-loaded interactive performance lessons
├── src/                               # Earlier Svelte component prototype
├── .github/                           # Validation workflow and contribution templates
├── package.json
└── vite.config.js
```

The GitHub Pages deployment uses `index.html` as the production entry point. The `src/` directory is retained as an earlier Svelte prototype and is not required by the current static deployment.

## Data and privacy

- Queries run locally in WebAssembly through `sql.js`.
- No query text or dataset row is sent to an application backend.
- Data resets when the page is refreshed.
- The included datasets are fictional teaching data.

## Accessibility

- Keyboard-focusable controls and interactive diagram elements
- Visible focus states and ARIA labels
- Color is paired with text and shape
- Reduced-motion support through `prefers-reduced-motion`
- Responsive layouts down to small mobile widths

## Contributing

Bug reports and focused improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Deployment

The site is fully static and deployed with GitHub Pages from the default branch. Pushing changes to `main` triggers the Pages deployment configured in the repository settings.

## Built with

- [sql.js](https://sql.js.org/) — SQLite compiled to WebAssembly
- [D3.js](https://d3js.org/) — data-bound visuals
- [GSAP](https://gsap.com/) — performance-lab transitions
- [Rough.js](https://roughjs.com/) — hand-drawn illustration accents
- [Vite](https://vite.dev/) — local development and static builds
