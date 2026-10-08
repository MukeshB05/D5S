# Spotify Import Setup

## 1. Create a Spotify Developer app

Create an application in the Spotify Developer Dashboard and copy its **Client ID**.

This project uses Authorization Code with PKCE. Do not put a Spotify client secret in the React frontend.

## 2. Add the Client ID

Create `.env.local` (or `.env`) in the project root:

```env
VITE_SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
```

Restart Vite after changing environment variables.

## 3. Add the Redirect URI

For local development, Spotify requires the loopback IP rather than `localhost`:

```text
http://127.0.0.1:5173/spotify-import
```

Register these production redirect URIs if you use all three deployments:

```text
https://dreamly5.mukeshlive.workers.dev/spotify-import
https://dreamly5.pages.dev/spotify-import
https://dreamly5.vercel.app/spotify-import
```

The redirect URI used by the app is selected automatically from the current hostname.

The URI must exactly match the value configured in Spotify.

## 4. Start the app

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/spotify-import
```

## 5. Import

1. Click **Connect Spotify**.
2. Authorize the application.
3. Paste a Spotify track, album, or playlist URL.
4. Click **Import Spotify Music**.
5. The app retrieves Spotify metadata and searches the existing JioSaavn API for playable matches.
6. Matching songs are inserted into the existing MusicMax queue/player.

## Important limitations

Spotify metadata and Spotify audio are separate. This implementation does not download or rip Spotify audio. It uses Spotify only for metadata and resolves playable tracks through the application's existing music API.

For playlist imports, Spotify may deny access to playlists that the authenticated user is not permitted to read. In that case, try a playlist owned by or shared/collaborated with the connected account.
