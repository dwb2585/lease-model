# Final Deal Projection

Single-page React app for **The Golden Stethoscope** at Red Rocks Medical Center. Models the executed landlord LOI of **July 15, 2026** (Suite 280, 2,952 SF, 120-month term) over the 10-year lease, with interactive sliders for sensitivity.

Built with Vite + React + Recharts. Pure client-side — no backend, all assumptions live in the slider state.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produces ./dist for static hosting
```

## Deploy

Push to `main` on `dwb2585/lease-model` — Vercel auto-deploys the `cwabs/lease-model` project.

## Files

- `src/App.jsx` — the entire model + UI in one file. Default export `App`.
- `src/main.jsx` — React entry point.
- `index.html` — Vite shell. Google Fonts loaded here (not in JSX) so they don't lag first paint.

## Held constant (per July 15 LOI)

See the footer block in `src/App.jsx` for the full list. The model treats these as fixed:

- Dr. Wobbekind panel at 350 ($52,578/mo MRR: 325 existing + 25 new @ $245)
- Jennifer's comp $110k fully loaded
- Third provider $110k fully loaded (PA-level default)
- MA $66k escalating 3% from chosen year
- Fixed overhead $95k/yr escalating 3%
- Variable cost $10/patient/month
- Suite 280 · 2,952 SF · 120-month term · phase-in rent $15 → $34.49/SF per LOI schedule
- TI $25/SF ($73,800) usable for buildout, cabling, moving — forfeited if unused within 6 months
- OpEx cap 5% non-cumulative, non-compounding · guaranty burn-down per schedule
- One 5-year renewal at greater of FMV or 103%
