# Cloudflare Pages deployment

Use Git deployment (not a static `dist` upload) so the `functions/` directory is deployed.

Build settings:
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

The project includes:
- `public/_redirects` for React Router SPA fallback.
- `functions/api/download.js` for `/api/download`.
- `functions/api/[[path]].js` for same-origin JioSaavn API requests.

After connecting the repository, use **Redeploy -> Clear build cache and deploy** once.
Do not upload `.env.local` to the repository.
