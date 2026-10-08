const API_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "https://jiosaavndev.vercel.app/api/";

/*
|--------------------------------------------------------------------------
| Default Settings
|--------------------------------------------------------------------------
*/

const DEFAULT_LIMIT = 150;


/*
|--------------------------------------------------------------------------
| URL Builder
|--------------------------------------------------------------------------
*/

const buildUrl = (endpoint, params = {}) => {
    const url = new URL(endpoint, API_URL);

    Object.entries(params).forEach(([key, value]) => {
        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
};


/*
|--------------------------------------------------------------------------
| Common API Request
|--------------------------------------------------------------------------
*/

const apiRequest = async (endpoint, params = {}) => {
    const url = buildUrl(endpoint, params);

    try {
        const response = await fetch(url);

        let data;

        const contentType =
            response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();

            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        if (!response.ok) {
            throw new Error(
                data?.message ||
                data?.error ||
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


/*
|--------------------------------------------------------------------------
| GENERAL SEARCH
|--------------------------------------------------------------------------
*/

/**
 * Search everything
 *
 * Example:
 * getSearchData("Arijit Singh")
 */
export const getSearchData = async (
    query,
    limit = DEFAULT_LIMIT
) => {

    if (!query) {
        throw new Error("Search query is required");
    }

    return apiRequest("search", {
        query: query,
        limit: limit
    });
};


/*
|--------------------------------------------------------------------------
| SONGS
|--------------------------------------------------------------------------
*/

/**
 * Search songs
 *
 * Example:
 * getSongbyQuery("Tum Hi Ho", 150)
 */
export const getSongbyQuery = async (
    query,
    limit = DEFAULT_LIMIT
) => {

    if (!query) {
        throw new Error("Song search query is required");
    }

    return apiRequest("search/songs", {
        query: query,
        limit: limit
    });
};


/**
 * Get song by ID
 *
 * Example:
 * getSongById("123456")
 */
export const getSongById = async (songId) => {

    if (!songId) {
        throw new Error("Song ID is required");
    }

    return apiRequest(
        `songs/${encodeURIComponent(songId)}`
    );
};


/**
 * Get song suggestions
 *
 * Example:
 * getSuggestionSong("123456", 150)
 */
export const getSuggestionSong = async (
    songId,
    limit = DEFAULT_LIMIT
) => {

    if (!songId) {
        throw new Error("Song ID is required");
    }

    return apiRequest(
        `songs/${encodeURIComponent(songId)}/suggestions`,
        {
            limit: limit
        }
    );
};


/**
 * Alias for song suggestions
 */
export const fetchSongSuggestionsByID = async (
    songId,
    limit = DEFAULT_LIMIT
) => {

    if (!songId) {
        throw new Error("Song ID is required");
    }

    return apiRequest(
        `songs/${encodeURIComponent(songId)}/suggestions`,
        {
            limit: limit
        }
    );
};


/**
 * Get lyrics
 *
 * Example:
 * LyricsByID("123456")
 */
export const LyricsByID = async (songId) => {

    if (!songId) {
        throw new Error("Song ID is required");
    }

    return apiRequest(
        `songs/${encodeURIComponent(songId)}/lyrics`
    );
};


/*
|--------------------------------------------------------------------------
| ARTISTS
|--------------------------------------------------------------------------
*/

/**
 * Search artists
 *
 * Example:
 * getArtistbyQuery("Arijit Singh", 150)
 */
export const getArtistbyQuery = async (
    query,
    limit = DEFAULT_LIMIT
) => {

    if (!query) {
        throw new Error("Artist search query is required");
    }

    return apiRequest("search/artists", {
        query: query,
        limit: limit
    });
};


/**
 * Search artists
 *
 * Alias
 */
export const searchArtistByQuery = async (
    query,
    limit = DEFAULT_LIMIT
) => {

    if (!query) {
        throw new Error("Artist search query is required");
    }

    return apiRequest("search/artists", {
        query: query,
        limit: limit
    });
};


/**
 * Get artist by ID
 *
 * Example:
 * fetchArtistByID("123456")
 */
export const fetchArtistByID = async (artistId) => {

    if (!artistId) {
        throw new Error("Artist ID is required");
    }

    return apiRequest("artists", {
        id: artistId
    });
};


/*
|--------------------------------------------------------------------------
| ALBUMS
|--------------------------------------------------------------------------
*/

/**
 * Search albums
 *
 * Example:
 * searchAlbumByQuery("Aashiqui 2", 150)
 */
export const searchAlbumByQuery = async (
    query,
    limit = DEFAULT_LIMIT
) => {

    if (!query) {
        throw new Error("Album search query is required");
    }

    return apiRequest("search/albums", {
        query: query,
        limit: limit
    });
};


/**
 * Get album by ID
 *
 * Example:
 * fetchAlbumByID("123456")
 */
export const fetchAlbumByID = async (
    albumId,
    limit = DEFAULT_LIMIT
) => {

    if (!albumId) {
        throw new Error("Album ID is required");
    }

    return apiRequest("albums", {
        id: albumId,
        limit: limit
    });
};


/*
|--------------------------------------------------------------------------
| PLAYLISTS
|--------------------------------------------------------------------------
*/

/**
 * Search playlists
 *
 * Example:
 * searchPlayListByQuery("Workout", 150)
 */
export const searchPlayListByQuery = async (
    query,
    limit = DEFAULT_LIMIT
) => {

    if (!query) {
        throw new Error("Playlist search query is required");
    }

    return apiRequest("search/playlists", {
        query: query,
        limit: limit
    });
};


/**
 * Get playlist by ID
 *
 * Example:
 * fetchplaylistsByID("123456")
 */
export const fetchplaylistsByID = async (
    playlistId,
    limit = DEFAULT_LIMIT
) => {

    if (!playlistId) {
        throw new Error("Playlist ID is required");
    }

    return apiRequest("playlists", {
        id: playlistId,
        limit: limit
    });
};


/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

export default {

    // Search
    getSearchData,

    // Songs
    getSongbyQuery,
    getSongById,
    getSuggestionSong,
    fetchSongSuggestionsByID,
    LyricsByID,

    // Artists
    getArtistbyQuery,
    searchArtistByQuery,
    fetchArtistByID,

    // Albums
    searchAlbumByQuery,
    fetchAlbumByID,

    // Playlists
    searchPlayListByQuery,
    fetchplaylistsByID
};
