# mattias-portfolio
Static Astro site. SPEC.md is the source of truth. Read it before structural changes.

Rules
- Never write copy (headlines, bios, story text). Leave `TODO(mattias)`.
- Don't change token values, fonts or the visual design. Mattias owns design.
- No client JS beyond theme init, ThemeToggle, BeatNav and RadarBand. No new dependencies without asking.
- GAIA: mock-data screenshots only. No source, schema, customer names, or pricing/commission logic.
- Case studies keep the six H2 beats in order (see src/lib/beats.ts).
- Before committing: `npm run build` must pass.
