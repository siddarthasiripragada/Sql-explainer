# Contributing

Thanks for helping improve SQL Query Explainer.

## Before opening an issue

- Check whether the problem already has an issue.
- Include the exact SQL query that reproduces the behavior.
- Mention the selected dataset, browser, and screen size.
- Add a screenshot when the issue is visual.

## Local setup

```bash
npm install
npm run dev
```

The production experience is served from `index.html`. Performance Lab code lives in `performance-lab/`.

## Pull requests

1. Keep each pull request focused on one problem.
2. Preserve the existing cream/pastel visual language.
3. Keep SQL results and performance numbers tied to real `sql.js` queries.
4. Clearly label simulations for database features SQLite does not support.
5. Test desktop and mobile widths.
6. Test keyboard interaction and reduced-motion behavior for visual changes.
7. Run `npm run check` before submitting.

## Commit messages

Use a short, action-oriented message, for example:

```text
Fix GROUP BY card alignment
Add partition-pruning keyboard controls
Document unsupported query shapes
```
