import he from "he";

const SPOTIFY_CLIENT_ID =
  import.meta.env.VITE_SPOTIFY_CLIENT_ID ||
  "94999b057f924d21b8a73dc2f33404fe";

const SPOTIFY_ACCOUNTS =
  "https://accounts.spotify.com";

const SPOTIFY_API =
  "https://api.spotify.com/v1";

const JIOSAAVN_API =
  "https://jiosaavndev.vercel.app/api";

const TOKEN_KEY =
  "spotify_access_token";

const VERIFIER_KEY =
  "spotify_pkce_verifier";

const STATE_KEY =
  "spotify_oauth_state";

/* ============================================
   HELPERS
============================================ */

const cleanText = (value) => {
  try {
    return he.decode(
      String(value ?? "")
    ).trim();
  } catch {
    return String(value ?? "").trim();
  }
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const randomString = (length = 64) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const values = new Uint8Array(length);

  crypto.getRandomValues(values);

  return Array.from(
    values,
    (value) =>
      chars[value % chars.length]
  ).join("");
};

const base64UrlEncode = (buffer) => {
  const bytes = new Uint8Array(buffer);

  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

/* ============================================
   REDIRECT URI
============================================ */

export const getSpotifyRedirectUri = () => {
  const {
    protocol,
    hostname,
    port,
  } = window.location;

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return `http://127.0.0.1:${
      port || "5173"
    }/spotify-import`;
  }

  return `${protocol}//${hostname}/spotify-import`;
};

/* ============================================
   PKCE
============================================ */

export const createSpotifyLoginUrl =
  async () => {
    const verifier =
      randomString(96);

    const state =
      randomString(32);

    const digest =
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
      );

    const challenge =
      base64UrlEncode(digest);

    sessionStorage.setItem(
      VERIFIER_KEY,
      verifier
    );

    sessionStorage.setItem(
      STATE_KEY,
      state
    );

    const params =
      new URLSearchParams({
        client_id:
          SPOTIFY_CLIENT_ID,

        response_type: "code",

        redirect_uri:
          getSpotifyRedirectUri(),

        code_challenge_method:
          "S256",

        code_challenge:
          challenge,

        state,

        scope:
          "playlist-read-private playlist-read-collaborative",
      });

    return `${SPOTIFY_ACCOUNTS}/authorize?${params.toString()}`;
  };

/* ============================================
   TOKEN EXCHANGE
============================================ */

export const exchangeSpotifyCode =
  async (code, returnedState) => {
    const savedState =
      sessionStorage.getItem(
        STATE_KEY
      );

    if (
      savedState &&
      returnedState &&
      savedState !== returnedState
    ) {
      throw new Error(
        "Spotify login state validation failed."
      );
    }

    const verifier =
      sessionStorage.getItem(
        VERIFIER_KEY
      );

    if (!verifier) {
      throw new Error(
        "Spotify login session expired. Please connect again."
      );
    }

    const body =
      new URLSearchParams({
        client_id:
          SPOTIFY_CLIENT_ID,

        grant_type:
          "authorization_code",

        code,

        redirect_uri:
          getSpotifyRedirectUri(),

        code_verifier:
          verifier,
      });

    const response =
      await fetch(
        `${SPOTIFY_ACCOUNTS}/api/token`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body,
        }
      );

    const data =
      await safeJson(response);

    if (!response.ok) {
      throw new Error(
        data?.error_description ||
          data?.error ||
          "Spotify token exchange failed."
      );
    }

    sessionStorage.removeItem(
      VERIFIER_KEY
    );

    sessionStorage.removeItem(
      STATE_KEY
    );

    sessionStorage.setItem(
      TOKEN_KEY,
      data.access_token
    );

    return data;
  };

/* ============================================
   TOKEN
============================================ */

export const getSpotifyToken = () =>
  sessionStorage.getItem(
    TOKEN_KEY
  );

export const logoutSpotify = () => {
  sessionStorage.removeItem(
    TOKEN_KEY
  );

  sessionStorage.removeItem(
    VERIFIER_KEY
  );

  sessionStorage.removeItem(
    STATE_KEY
  );
};

/* ============================================
   SPOTIFY REQUEST
============================================ */

const spotifyRequest = async (
  path
) => {
  const token =
    getSpotifyToken();

  if (!token) {
    throw new Error(
      "Spotify is not connected."
    );
  }

  const response =
    await fetch(
      `${SPOTIFY_API}${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

  const data =
    await safeJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      logoutSpotify();
      throw new Error(
        "Spotify session expired. Please connect again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Spotify does not allow this playlist to be read with the current account."
      );
    }

    throw new Error(
      data?.error?.message ||
        data?.message ||
        `Spotify request failed (${response.status}).`
    );
  }

  return data;
};

/* ============================================
   SPOTIFY URL PARSER
============================================ */

export const parseSpotifyUrl = (
  value
) => {
  try {
    const url =
      new URL(value.trim());

    if (
      !url.hostname.includes(
        "spotify.com"
      )
    ) {
      return null;
    }

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    const type =
      parts[0];

    const id =
      parts[1];

    if (
      ![
        "track",
        "album",
        "playlist",
      ].includes(type) ||
      !id
    ) {
      return null;
    }

    return {
      type,
      id,
    };
  } catch {
    return null;
  }
};

/* ============================================
   SPOTIFY TRACKS -> JIOSAAVN
============================================ */

const searchJioSaavnSong = async (
  title,
  artists
) => {
  const query = [
    title,
    ...(artists || []),
  ]
    .filter(Boolean)
    .join(" ");

  if (!query) {
    return null;
  }

  try {
    const response =
      await fetch(
        `${JIOSAAVN_API}/search/songs?query=${encodeURIComponent(
          query
        )}&limit=10`
      );

    const data =
      await safeJson(response);

    if (!response.ok) {
      return null;
    }

    const songs =
      Array.isArray(
        data?.data?.results
      )
        ? data.data.results
        : Array.isArray(
            data?.results
          )
        ? data.results
        : [];

    if (!songs.length) {
      return null;
    }

    const normalizedTitle =
      cleanText(title).toLowerCase();

    const exact =
      songs.find((song) => {
        const songTitle =
          cleanText(
            song?.name ||
              song?.title
          ).toLowerCase();

        return (
          songTitle ===
          normalizedTitle
        );
      });

    return exact || songs[0];
  } catch (error) {
    console.error(
      "JioSaavn search failed:",
      error
    );

    return null;
  }
};

const resolveSpotifyTracks =
  async (items) => {
    const result = [];

    for (const item of items) {
      const track =
        item?.track ||
        item?.item;

      if (
        !track ||
        track?.is_local
      ) {
        continue;
      }

      const title =
        cleanText(track?.name);

      const artists =
        Array.isArray(
          track?.artists
        )
          ? track.artists
              .map((artist) =>
                cleanText(
                  artist?.name
                )
              )
              .filter(Boolean)
          : [];

      if (!title) {
        continue;
      }

      const song =
        await searchJioSaavnSong(
          title,
          artists
        );

      if (!song) {
        continue;
      }

      result.push({
        ...song,

        spotifyId:
          track?.id || null,

        spotifyName:
          title,

        spotifyUrl:
          track?.external_urls
            ?.spotify || "",
      });
    }

    const unique =
      new Map();

    result.forEach((song) => {
      const id =
        song?.id ??
        song?.songId;

      if (id != null) {
        unique.set(
          String(id),
          song
        );
      }
    });

    return Array.from(
      unique.values()
    );
  };

/* ============================================
   GET SPOTIFY TRACK
============================================ */

const getSpotifyTrack =
  async (id) => {
    const track =
      await spotifyRequest(
        `/tracks/${id}`
      );

    return {
      type: "track",

      id: track.id,

      name:
        cleanText(track.name) ||
        "Spotify Track",

      image:
        track?.album?.images?.[0]
          ?.url ||
        "/Unknown.png",

      artists: {
        primary:
          Array.isArray(
            track.artists
          )
            ? track.artists.map(
                (artist) => ({
                  id: artist?.id,
                  name: cleanText(
                    artist?.name
                  ),
                })
              )
            : [],
      },

      spotifyUrl:
        track?.external_urls
          ?.spotify ||
        `https://open.spotify.com/track/${id}`,

      items: [
        {
          track,
        },
      ],
    };
  };

/* ============================================
   GET SPOTIFY ALBUM
============================================ */

const getSpotifyAlbum =
  async (id) => {
    const album =
      await spotifyRequest(
        `/albums/${id}`
      );

    const items =
      Array.isArray(
        album?.tracks?.items
      )
        ? album.tracks.items
        : [];

    return {
      type: "album",

      id: album.id,

      name:
        cleanText(album.name) ||
        "Spotify Album",

      image:
        album?.images?.[0]?.url ||
        album?.images?.[1]?.url ||
        album?.images?.[2]?.url ||
        "/Unknown.png",

      artists: {
        primary:
          Array.isArray(
            album?.artists
          )
            ? album.artists.map(
                (artist) => ({
                  id: artist?.id,
                  name: cleanText(
                    artist?.name
                  ),
                })
              )
            : [],
      },

      spotifyUrl:
        album?.external_urls
          ?.spotify ||
        `https://open.spotify.com/album/${id}`,

      items,
    };
  };

/* ============================================
   GET SPOTIFY PLAYLIST
============================================ */

const getSpotifyPlaylist =
  async (id) => {
    const first =
      await spotifyRequest(
        `/playlists/${id}/items?limit=50`
      );

    const items = Array.isArray(
      first?.items
    )
      ? [...first.items]
      : [];

    let next =
      first?.next || null;

    while (next) {
      const url =
        new URL(next);

      const page =
        await spotifyRequest(
          `${url.pathname.replace(
            "/v1",
            ""
          )}${url.search}`
        );

      if (
        Array.isArray(
          page?.items
        )
      ) {
        items.push(
          ...page.items
        );
      }

      next =
        page?.next || null;
    }

    let playlist = null;

    try {
      playlist =
        await spotifyRequest(
          `/playlists/${id}?fields=id,name,images,external_urls`
        );
    } catch {
      playlist = null;
    }

    return {
      type: "playlist",

      id,

      name:
        cleanText(
          playlist?.name
        ) ||
        "Spotify Playlist",

      image:
        playlist?.images?.[0]
          ?.url ||
        playlist?.images?.[1]
          ?.url ||
        playlist?.images?.[2]
          ?.url ||
        "/Unknown.png",

      spotifyUrl:
        playlist?.external_urls
          ?.spotify ||
        `https://open.spotify.com/playlist/${id}`,

      items,
    };
  };

/* ============================================
   GET SPOTIFY ITEMS
============================================ */

export const getSpotifyItems =
  async (spotifyUrl) => {
    const parsed =
      parseSpotifyUrl(
        spotifyUrl
      );

    if (!parsed) {
      throw new Error(
        "Invalid Spotify track, album or playlist URL."
      );
    }

    let spotifyData;

    if (
      parsed.type === "track"
    ) {
      spotifyData =
        await getSpotifyTrack(
          parsed.id
        );
    } else if (
      parsed.type === "album"
    ) {
      spotifyData =
        await getSpotifyAlbum(
          parsed.id
        );
    } else {
      spotifyData =
        await getSpotifyPlaylist(
          parsed.id
        );
    }

    const songs =
      await resolveSpotifyTracks(
        spotifyData.items
      );

    return {
      ...spotifyData,
      songs,
    };
  };
