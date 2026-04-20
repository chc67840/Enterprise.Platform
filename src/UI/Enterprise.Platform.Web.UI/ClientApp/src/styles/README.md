# `src/styles/` — Global styles

Split into focused files imported from `src/styles.css`:

- `tokens.css` — CSS custom properties (z-index, transitions, easing, content widths, layout dimensions) (Phase 5)
- `typography.css` — font stack + scale (Phase 5)
- `animations.css` — keyframes (Phase 5)
- `scrollbars.css` — cross-browser scrollbar styling (Phase 5)
- `utilities.css` — project-specific utility classes not covered by Tailwind (Phase 5)
- `primeng-overrides.css` — PrimeNG component restylings (Phase 5; target ≤ 20 KB per §5.6)

For Phase 0 only `src/styles.css` is populated (Tailwind import + reset).
