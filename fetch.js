// ============================================================
// Dreamly5 / MusicMax - API / fetch.js
// Same frontend code works on Vercel + Cloudflare Pages
// ============================================================

const API_URL = "/api";
const DEFAULT_LIMIT = 150;

const buildUrl = (endpoint, params = {}) => {
  const cleanEndpoint = String(endpoint || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const url = new URL(
    `${API_URL}/${cleanEndpoint}`,
    window.location.origin
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

const apiRequest = async (endpoint, params = {}, options = {}) => {
  const url = buildUrl(endpoint, params);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { Accept: "application/json", ...(options.headers || {}) },
      signal: options.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error ||
        `Request failed: ${response.status} ${response.statusText}`
      );
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    console.error("URL:", url);
    throw error;
  }
};

export const getSearchData = async (query, limit = DEFAULT_LIMIT) => {
  if (!query?.trim()) throw new Error("Search query is required");
  return apiRequest("search", { query: query.trim(), limit });
};

export const getSongbyQuery = async (query, limit = DEFAULT_LIMIT) => {
  if (!query?.trim()) throw new Error("Song search query is required");
  return apiRequest("search/songs", { query: query.trim(), limit });
};

export const getSongById = async (songId) => {
  if (songId === undefined || songId === null || String(songId).trim() === "") {
    throw new Error("Song ID is required");
  }
  return apiRequest(`songs/${encodeURIComponent(String(songId).trim())}`);
};

export const getSuggestionSong = async (songId, limit = DEFAULT_LIMIT) => {
  if (songId === undefined || songId === null || String(songId).trim() === "") {
    throw new Error("Song ID is required");
  }
  return apiRequest(`songs/${encodeURIComponent(String(songId).trim())}/suggestions`, { limit });
};

export const fetchSongSuggestionsByID = getSuggestionSong;

export const LyricsByID = async (songId) => {
  if (songId === undefined || songId === null || String(songId).trim() === "") {
    throw new Error("Song ID is required");
  }
  return apiRequest(`songs/${encodeURIComponent(String(songId).trim())}/lyrics`);
};

export const getArtistbyQuery = async (query, limit = DEFAULT_LIMIT) => {
  if (!query?.trim()) throw new Error("Artist search query is required");
  return apiRequest("search/artists", { query: query.trim(), limit });
};

export const searchArtistByQuery = getArtistbyQuery;

export const fetchArtistByID = async (artistId) => {
  if (artistId === undefined || artistId === null || String(artistId).trim() === "") {
    throw new Error("Artist ID is required");
  }
  return apiRequest("artists", { id: String(artistId).trim() });
};

export const searchAlbumByQuery = async (query, limit = DEFAULT_LIMIT) => {
  if (!query?.trim()) throw new Error("Album search query is required");
  return apiRequest("search/albums", { query: query.trim(), limit });
};

export const fetchAlbumByID = async (albumId, limit = DEFAULT_LIMIT) => {
  if (albumId === undefined || albumId === null || String(albumId).trim() === "") {
    throw new Error("Album ID is required");
  }
  return apiRequest("albums", { id: String(albumId).trim(), limit });
};

export const searchPlayListByQuery = async (query, limit = DEFAULT_LIMIT) => {
  if (!query?.trim()) throw new Error("Playlist search query is required");
  return apiRequest("search/playlists", { query: query.trim(), limit });
};

export const fetchplaylistsByID = async (playlistId, limit = DEFAULT_LIMIT) => {
  if (playlistId === undefined || playlistId === null || String(playlistId).trim() === "") {
    throw new Error("Playlist ID is required");
  }
  return apiRequest("playlists", { id: String(playlistId).trim(), limit });
};

export default {
  getSearchData,
  getSongbyQuery,
  getSongById,
  getSuggestionSong,
  fetchSongSuggestionsByID,
  LyricsByID,
  getArtistbyQuery,
  searchArtistByQuery,
  fetchArtistByID,
  searchAlbumByQuery,
  fetchAlbumByID,
  searchPlayListByQuery,
  fetchplaylistsByID,
};
