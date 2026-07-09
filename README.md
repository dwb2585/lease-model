# Lease Decision Model

Single-page React app for the **Suite 260 vs. Suite 280** lease decision at Red Rocks Medical Center.

Built with Vite + React + Recharts. Pure client-side — no backend, all assumptions live in the slider state.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produces ./dist for static hosting
```

## Deploy

```bash
vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

Project: `lease-model` (cwabs team scope).
URL: https://lease-model.vercel.app

## Files

- `src/App.jsx` — the entire model + UI in one file. Default export `App`.
- `src/main.jsx` — React entry point.
- `index.html` — Vite shell. Google Fonts loaded here (not in JSX) so they don't lag first paint.

## Held constant

See the footer block in `src/App.jsx` for the full list of constants. The model treats these as fixed across both paths:

- Amber's panel at 350 (full MRR of $52,578/mo)
- Jennifer's comp $110k fully loaded
- Third provider $110k fully loaded (move scenario only)
- MA $66k escalating 3% from chosen lease year
- Fixed overhead $95k/yr escalating 3%
- Variable cost $10/patient/month

Slider defaults match the **July 7 LOI** (stay = Option A at $28/SF + 3% bumps) and **July 9 counter** (move = $18 Y2 in 10-year phase-in).