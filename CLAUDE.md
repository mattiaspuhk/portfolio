# mattias-portfolio
Static Astro site. docs/SPEC.md (local, gitignored) is the source of truth. Read it before structural changes.

Rules
- Never write copy (headlines, bios, story text). Leave `TODO(mattias)`.
- Don't change token values, fonts or the visual design. Mattias owns design.
- No client JS beyond theme init, ThemeToggle, BeatNav and RadarBand. No new dependencies without asking.
- GAIA: mock-data screenshots only. No source, schema, customer names, or pricing/commission logic.
- Case studies keep the six H2 beats in order (see src/lib/beats.ts).
- Before committing: `npm run build` must pass.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` (gitignored). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix), recorded as a `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created only when needed. See `docs/agents/domain.md`.
