# Cloudflare deployment

## Cloudflare Pages
Build command:
npm run build

Build output directory:
dist

Root directory:
/

The project includes `public/_redirects` so React Router routes fall back to
`index.html`. The Pages Function at `functions/api/download.js` provides the
download proxy at `/api/download`.

## Cloudflare Workers
Run:
npm install
npm run build
npx wrangler deploy

`wrangler.jsonc` serves `dist/` as static assets and sends `/api/*` to the
Worker. SPA routes fall back to `index.html`.

Do not set the Pages output directory to `.` or the project root. It must be
`dist`.
