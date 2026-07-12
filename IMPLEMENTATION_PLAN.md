# SQL Explainer enhancement plan

## Delivered in the current static build

- Stable row lineage across FROM, WHERE, SELECT, DISTINCT, ORDER BY, and LIMIT.
- Stable group lineage across GROUP BY, HAVING, SELECT, and ORDER BY.
- Cross-stage hover and keyboard-focus highlighting with persistent palette tints.
- Paint-synchronized playback using `requestAnimationFrame` at 0.25×–4×.
- Animated row entry, ribbon particles, and reduced-motion support.
- Keyboard stage navigation and accessible playback labels.
- Lightweight guided tour using the existing visual system.
- Correct HAVING pass/discard comparisons that ignore internal visualization metadata.

## React and TypeScript component target

- `SqlEngineProvider`: owns sql.js initialization, datasets, execution, and errors.
- `useExecutionPipeline`: parses clauses and creates immutable intermediate stages.
- `useRowLineage`: assigns stable row/group keys and fate metadata.
- `useAnimationController`: controls the requestAnimationFrame timeline and speed.
- `PipelineCanvas`: D3 SVG overview, keyed transitions, ribbons, and stage navigation.
- `StageNode`: memoized stage summary and row-count change indicator.
- `VirtualizedStageGrid`: TanStack Table/react-window detail view and D3 heat scales.
- `StageDetailPanel`: evaluation tooltips, full SQL, row fate, and aggregate derivation.
- `PlaybackControls`: scrubber, keyboard navigation, speed, play, pause, and stepping.
- `GuidedTour`: accessible, dismissible teaching sequence.

## Migration sequence

1. Introduce Vite React + strict TypeScript while keeping the current HTML as a deployment fallback.
2. Move the sql.js data layer and clause reconstruction into typed hooks with regression fixtures.
3. Port stage cards and lineage interactions to keyed React components.
4. Add D3 transitions and a virtualized detail grid.
5. Switch GitHub Pages to the compiled artifact only after visual and execution parity tests pass.

The migration deliberately preserves the current CSS variables, typography, spacing, and stage palette.
