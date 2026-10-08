/* =========================================================
   SHARED SPOTIFY HELPERS
   Used by SongsList, AlbumItems and PlaylistItems.
========================================================= */

const safeString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

export const normalizeSpotifyUrl = (value) => {
  const cleanValue = safeString(value);

  if (!cleanValue) {
    return "";
  }

  // Standard Spotify web URL.
  if (
    cleanValue.startsWith("https://open.spotify.com/") ||
    cleanValue.startsWith("http://open.spotify.com/")
  ) {
    return cleanValue;
  }

  // Spotify URI:
  // spotify:track:ID
  // spotify:album:ID
  // spotify:playlist:ID
  if (cleanValue.startsWith("spotify:")) {
    const parts = cleanValue.split(":");

    if (parts.length >= 3) {
      const type = safeString(parts[1]);
      const id = safeString(parts.slice(2).join(":"));

      if (type && id) {
        return `https://open.spotify.com/${type}/${id}`;
      }
    }
  }

  // Spotify URL scheme:
  // spotify://track/ID
  // spotify://album/ID
  // spotify://playlist/ID
  if (cleanValue.startsWith("spotify://")) {
    const withoutScheme = cleanValue.replace("spotify://", "");
    const parts = withoutScheme.split("/");

    if (parts.length >= 2) {
      const type = safeString(parts[0]);
      const id = safeString(parts.slice(1).join("/"));

      if (type && id) {
        return `https://open.spotify.com/${type}/${id}`;
      }
    }
  }

  return "";
};

export const getSpotifyType = (item) => {
  if (!item || typeof item !== "object") {
    return "";
  }

  const directType =
    item.spotifyType ||
    item.spotify_type ||
    item.spotify?.type ||
    item.type;

  if (directType) {
    return safeString(directType).toLowerCase();
  }

  const url =
    item.spotifyUrl ||
    item.spotify_url ||
    item.spotifyLink ||
    item.spotify_link ||
    item.uri ||
    item.external_urls?.spotify ||
    item.externalUrls?.spotify ||
    item.spotify?.url ||
    item.spotify?.uri ||
    item.spotify?.spotifyUrl ||
    item.spotify?.spotify_url ||
    item.links?.spotify ||
    item.urls?.spotify;

  const cleanUrl = safeString(url);

  if (cleanUrl.startsWith("spotify:")) {
    return safeString(cleanUrl.split(":")[1]).toLowerCase();
  }

  if (cleanUrl.startsWith("spotify://")) {
    return safeString(cleanUrl.replace("spotify://", "").split("/")[0]).toLowerCase();
  }

  try {
    const parsed = new URL(cleanUrl);

    if (parsed.hostname === "open.spotify.com") {
      return safeString(parsed.pathname.split("/")[1]).toLowerCase();
    }
  } catch {
    // Ignore invalid URLs.
  }

  return "";
};

export const getSpotifyUrl = (item, fallbackType = "") => {
  if (!item || typeof item !== "object") {
    return "";
  }

  const possibleUrls = [
    item.spotifyUrl,
    item.spotify_url,
    item.spotifyLink,
    item.spotify_link,
    item.uri,

    item.external_urls?.spotify,
    item.externalUrls?.spotify,

    item.spotify?.url,
    item.spotify?.uri,
    item.spotify?.spotifyUrl,
    item.spotify?.spotify_url,

    item.spotify?.external_urls?.spotify,
    item.spotify?.externalUrls?.spotify,

    item.links?.spotify,
    item.urls?.spotify,
  ];

  for (const value of possibleUrls) {
    const normalized = normalizeSpotifyUrl(value);

    if (normalized) {
      return normalized;
    }
  }

  // Some imported Spotify records may contain only a Spotify ID
  // plus a type. Support those records as well.
  const spotifyId =
    item.spotifyId ||
    item.spotify_id ||
    item.spotify?.id;

  const type =
    getSpotifyType(item) ||
    safeString(fallbackType).toLowerCase();

  if (spotifyId && type) {
    return `https://open.spotify.com/${type}/${encodeURIComponent(
      safeString(spotifyId)
    )}`;
  }

  return "";
};

export default getSpotifyUrl;
