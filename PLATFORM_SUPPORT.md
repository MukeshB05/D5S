# Platform support

This source project supports the same React/Vite application on:

- Vercel
- Cloudflare Pages
- Cloudflare Workers + Static Assets

Each platform has its own backend entry point, while the browser calls `/api/download` so the frontend does not need a platform-specific download URL.
