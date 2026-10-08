# Dream5S deployment checklist

## Vercel
- Framework: Vite
- Root directory: `/`
- Build command: `npm run build`
- Output directory: `dist`
- The root `api/download.js` is the Vercel download function.
- Deploy from the repository root.

## Cloudflare Pages
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- `functions/api/download.js` provides `/api/download`.
- `public/_redirects` provides SPA fallback.

## Cloudflare Workers
- Build first: `npm run build`
- Deploy: `npx --yes wrangler@latest deploy`
- `wrangler.jsonc` uses `dist/` as static assets.
- `worker/index.js` handles `/api/download`.
- SPA fallback is configured with `not_found_handling: single-page-application`.

## Important
The package lock is intentionally kept in sync with package.json. Wrangler is not a project dependency because the lockfile previously did not contain it; the Worker deploy script downloads the current Wrangler CLI with `npx` after the clean install.
