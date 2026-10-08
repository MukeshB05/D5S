import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";
import { FaSpotify } from "react-icons/fa";

import MusicContext from "../context/MusicContext";
import SongsList from "../components/SongsList";
import Navbar from "../components/Navbar";
import Navigator from "../components/Navigator";

/* =========================================================
   HELPERS
========================================================= */

const safeString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

/* =========================================================
   IMAGE URL
========================================================= */

const imageUrl = (image) => {
  if (Array.isArray(image)) {
    for (let i = image.length - 1; i >= 0; i -= 1) {
      const item = image[i];

      const url =
        typeof item === "string"
          ? item
          : item?.url ||
            item?.link ||
            item?.src;

      if (safeString(url)) {
        return safeString(url);
      }
    }
  }

  if (typeof image === "string") {
    const value = image.trim();

    if (value) {
      return value;
    }
  }

  if (image && typeof image === "object") {
    const url =
      image.url ||
      image.link ||
      image.src;

    if (safeString(url)) {
      return safeString(url);
    }
  }

  return "/Unknown.png";
};

/* =========================================================
   ARTIST NAMES
========================================================= */

const artistNames = (artists) => {
  if (Array.isArray(artists?.primary)) {
    return artists.primary
      .map((artist) =>
        typeof artist === "string"
          ? artist
          : artist?.name
      )
      .filter(Boolean)
      .join(", ");
  }

  if (Array.isArray(artists)) {
    return artists
      .map((artist) =>
        typeof artist === "string"
          ? artist
          : artist?.name
      )
      .filter(Boolean)
      .join(", ");
  }

  if (typeof artists === "string") {
    return artists;
  }

  if (artists?.name) {
    return artists.name;
  }

  return "";
};

/* =========================================================
   LOCAL STORAGE
========================================================= */

const readArray = (key) => {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.error(`Failed to read ${key}:`, error);

    return [];
  }
};

/* =========================================================
   SPOTIFY URL NORMALIZER
========================================================= */

const normalizeSpotifyUrl = (value) => {
  const cleanValue = safeString(value);

  if (!cleanValue) {
    return "";
  }

  /* -------------------------------------------------------
     Normal Spotify URL
  ------------------------------------------------------- */

  if (
    cleanValue.startsWith("https://open.spotify.com/") ||
    cleanValue.startsWith("http://open.spotify.com/")
  ) {
    return cleanValue;
  }

  /* -------------------------------------------------------
     Spotify URI

     spotify:track:ID
     spotify:album:ID
     spotify:playlist:ID
  ------------------------------------------------------- */

  if (cleanValue.startsWith("spotify:")) {
    const parts = cleanValue.split(":");

    if (
      parts.length >= 3 &&
      parts[1] &&
      parts[2]
    ) {
      const type = safeString(parts[1]);
      const id = safeString(parts[2]);

      if (type && id) {
        return `https://open.spotify.com/${type}/${id}`;
      }
    }
  }

  /* -------------------------------------------------------
     Spotify URL scheme

     spotify://track/ID
     spotify://album/ID
     spotify://playlist/ID
  ------------------------------------------------------- */

  if (cleanValue.startsWith("spotify://")) {
    const withoutScheme = cleanValue.replace(
      "spotify://",
      ""
    );

    const parts = withoutScheme.split("/");

    if (
      parts.length >= 2 &&
      parts[0] &&
      parts[1]
    ) {
      return `https://open.spotify.com/${parts[0]}/${parts[1]}`;
    }
  }

  return "";
};

/* =========================================================
   GET SPOTIFY URL
========================================================= */

const getSpotifyUrl = (item) => {
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
    const url = normalizeSpotifyUrl(value);

    if (url) {
      return url;
    }
  }

  return "";
};

/* =========================================================
   SPOTIFY TYPE
========================================================= */

const getSpotifyType = (item) => {
  if (!item || typeof item !== "object") {
    return "";
  }

  const values = [
    item.type,
    item.spotifyType,
    item.spotify_type,
    item.spotify?.type,
  ];

  for (const value of values) {
    const type = safeString(value).toLowerCase();

    if (
      type === "track" ||
      type === "song" ||
      type === "album" ||
      type === "playlist"
    ) {
      return type;
    }
  }

  const spotifyUrl = getSpotifyUrl(item);

  if (spotifyUrl) {
    const match = spotifyUrl.match(
      /open\.spotify\.com\/([^/?#]+)/i
    );

    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  return "";
};

/* =========================================================
   UNIQUE ITEM KEY
========================================================= */

const getItemKey = (item, fallback) => {
  if (!item || typeof item !== "object") {
    return fallback;
  }

  if (
    item.id !== undefined &&
    item.id !== null &&
    safeString(item.id)
  ) {
    return String(item.id);
  }

  const spotifyUrl = getSpotifyUrl(item);

  if (spotifyUrl) {
    return spotifyUrl;
  }

  return fallback;
};

/* =========================================================
   FAVOURITE
========================================================= */

const Favourite = () => {
  const musicContext = useContext(MusicContext) || {};

  const {
    playMusic,
  } = musicContext;

  const [
    likedSongs,
    setLikedSongs,
  ] = useState([]);

  const [
    likedAlbums,
    setLikedAlbums,
  ] = useState([]);

  const [
    likedPlaylists,
    setLikedPlaylists,
  ] = useState([]);

  /* =======================================================
     LOAD FAVOURITES
  ======================================================= */

  const loadFavourites = useCallback(() => {
    setLikedSongs(
      readArray("likedSongs")
    );

    setLikedAlbums(
      readArray("likedAlbums")
    );

    setLikedPlaylists(
      readArray("likedPlaylists")
    );
  }, []);

  /* =======================================================
     LISTEN FOR FAVOURITE CHANGES
  ======================================================= */

  useEffect(() => {
    loadFavourites();

    const update = () => {
      loadFavourites();
    };

    window.addEventListener(
      "storage",
      update
    );

    window.addEventListener(
      "favouritesUpdated",
      update
    );

    return () => {
      window.removeEventListener(
        "storage",
        update
      );

      window.removeEventListener(
        "favouritesUpdated",
        update
      );
    };
  }, [loadFavourites]);

  /* =======================================================
     REMOVE ITEM
  ======================================================= */

  const removeItem = useCallback(
    (storageKey, item) => {
      if (!item) {
        return;
      }

      const current = readArray(storageKey);

      const itemId = safeString(item?.id);

      const itemSpotifyUrl =
        getSpotifyUrl(item);

      const updated = current.filter(
        (storedItem) => {
          const storedId =
            safeString(storedItem?.id);

          const storedSpotifyUrl =
            getSpotifyUrl(storedItem);

          /* Compare IDs when available */

          if (itemId && storedId) {
            return storedId !== itemId;
          }

          /* Otherwise compare Spotify URLs */

          if (
            itemSpotifyUrl &&
            storedSpotifyUrl
          ) {
            return (
              storedSpotifyUrl !==
              itemSpotifyUrl
            );
          }

          return true;
        }
      );

      localStorage.setItem(
        storageKey,
        JSON.stringify(updated)
      );

      loadFavourites();

      window.dispatchEvent(
        new Event("favouritesUpdated")
      );
    },
    [loadFavourites]
  );

  /* =======================================================
     PLAY FAVOURITE SONG
  ======================================================= */

  const playFavouriteSong = useCallback(
    (song) => {
      if (
        !song ||
        typeof playMusic !== "function"
      ) {
        return;
      }

      const queue = likedSongs.filter(
        (item) =>
          item &&
          item.id !== undefined &&
          item.id !== null
      );

      playMusic(
        song,
        queue.length > 0
          ? queue
          : undefined
      );
    },
    [
      likedSongs,
      playMusic,
    ]
  );

  /* =======================================================
     TOTAL
  ======================================================= */

  const total =
    likedSongs.length +
    likedAlbums.length +
    likedPlaylists.length;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <Navbar />

      <main
        className="
          min-h-screen
          w-full

          bg-[var(--background)]
          text-[var(--text-primary)]

          px-4
          pb-[7rem]
          pt-[9rem]

          sm:px-6
          sm:pt-[8rem]

          lg:px-8
          lg:pb-10
          lg:pt-[7rem]

          transition-colors
          duration-200
        "
      >
        <div
          className="
            mx-auto
            w-full
            max-w-7xl
          "
        >
          {/* =================================================
              FAVOURITE TITLE
          ================================================= */}

          <div
            className="
              mb-6
              flex
              w-full
              items-center
              justify-between
              gap-4
            "
          >
            {/* TITLE */}

            <div
              className="
                min-w-0
                flex-1
              "
            >
              <h1
                className="
                  truncate
                  text-2xl
                  font-bold
                  leading-tight
                  text-[var(--text-primary)]

                  sm:text-3xl
                "
              >
                Favourite
              </h1>

              <p
                className="
                  mt-1
                  truncate
                  text-sm
                  text-[var(--text-secondary)]

                  sm:text-base
                "
              >
                Your favourite songs, albums and playlists
              </p>
            </div>

            {/* TOTAL */}

            {total > 0 && (
              <div
                className="
                  flex
                  shrink-0
                  items-center
                  gap-2

                  rounded-full
                  border
                  border-[var(--card-border)]
                  bg-[var(--secondary-bg)]

                  px-3
                  py-1.5

                  text-xs
                  font-medium
                  text-[var(--text-secondary)]

                  shadow-sm

                  sm:px-4
                  sm:py-2
                  sm:text-sm
                "
              >
                <span
                  className="
                    flex
                    h-5
                    min-w-5
                    items-center
                    justify-center

                    rounded-full

                    bg-[var(--text-primary)]

                    px-1

                    text-[10px]
                    font-bold
                    text-[var(--background)]
                  "
                >
                  {total}
                </span>

                <span className="hidden sm:inline">
                  {total === 1
                    ? "Favourite item"
                    : "Favourite items"}
                </span>

                <span className="sm:hidden">
                  {total === 1
                    ? "Item"
                    : "Items"}
                </span>
              </div>
            )}
          </div>

          {/* =================================================
              EMPTY STATE
          ================================================= */}

          {total === 0 && (
            <div
              className="
                flex
                min-h-[55vh]
                flex-col
                items-center
                justify-center

                px-4
                pb-8

                text-center
              "
            >
              <div
                className="
                  mb-5
                  text-[5rem]
                  leading-none
                  text-[var(--text-secondary)]
                "
                aria-hidden="true"
              >
                ♡
              </div>

              <h2
                className="
                  text-xl
                  font-semibold
                  text-[var(--text-primary)]

                  sm:text-2xl
                "
              >
                No Favourite Items
              </h2>

              <p
                className="
                  mt-3
                  max-w-md
                  text-sm
                  leading-6
                  text-[var(--text-secondary)]

                  sm:text-base
                "
              >
                Import from Spotify or like songs,
                albums and playlists.
              </p>
            </div>
          )}

          {/* =================================================
              SONGS
          ================================================= */}

          {likedSongs.length > 0 && (
            <section className="mb-10">
              <div
                className="
                  mb-3
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <h2
                  className="
                    text-xl
                    font-bold
                    text-[var(--text-primary)]
                  "
                >
                  Songs
                </h2>

                <span
                  className="
                    shrink-0
                    rounded-full
                    bg-[var(--secondary-bg)]

                    px-2.5
                    py-1

                    text-xs
                    font-medium
                    text-[var(--text-secondary)]
                  "
                >
                  {likedSongs.length}
                </span>
              </div>

              <div
                className="
                  w-full
                  overflow-hidden
                  rounded-xl

                  border
                  border-[var(--card-border)]

                  bg-[var(--card-bg)]

                  transition-colors
                  duration-200
                "
              >
                {likedSongs.map(
                  (song, index) => {
                    const spotifyUrl =
                      getSpotifyUrl(song);

                    return (
                      <div
                        key={getItemKey(
                          song,
                          `song-${index}`
                        )}
                        className="
                          relative
                          flex
                          min-w-0
                          items-center

                          border-b
                          border-[var(--card-border)]

                          last:border-b-0
                        "
                      >
                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <SongsList
                            {...song}
                            song={song}
                            songs={likedSongs}
                            onPlay={
                              playFavouriteSong
                            }
                          />
                        </div>

                        {/* SPOTIFY */}

                        {spotifyUrl && (
                          <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
                              mr-1
                              flex
                              h-9
                              w-9
                              shrink-0
                              items-center
                              justify-center

                              rounded-full

                              text-[#1DB954]

                              transition-colors

                              hover:bg-[#1DB954]/10
                              active:bg-[#1DB954]/20
                            "
                            title="Open in Spotify"
                            aria-label="Open song in Spotify"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <FaSpotify
                              className="text-xl"
                            />
                          </a>
                        )}

                        {/* REMOVE */}

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              "likedSongs",
                              song
                            )
                          }
                          className="
                            mr-2
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center

                            rounded-full

                            text-lg
                            leading-none
                            text-red-500

                            transition-colors

                            hover:bg-red-500/10
                            active:bg-red-500/20
                          "
                          title="Remove from Favourite"
                          aria-label="Remove song from Favourite"
                        >
                          ×
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}

          {/* =================================================
              ALBUMS
          ================================================= */}

          {likedAlbums.length > 0 && (
            <section className="mb-10">
              <div
                className="
                  mb-4
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <h2
                  className="
                    text-xl
                    font-bold
                    text-[var(--text-primary)]
                  "
                >
                  Albums
                </h2>

                <span
                  className="
                    shrink-0
                    rounded-full
                    bg-[var(--secondary-bg)]

                    px-2.5
                    py-1

                    text-xs
                    font-medium
                    text-[var(--text-secondary)]
                  "
                >
                  {likedAlbums.length}
                </span>
              </div>

              <div
                className="
                  grid
                  grid-cols-2
                  gap-4

                  sm:grid-cols-3
                  md:grid-cols-4
                  lg:grid-cols-5
                  xl:grid-cols-6
                "
              >
                {likedAlbums.map(
                  (album, index) => {
                    const spotifyUrl =
                      getSpotifyUrl(album);

                    const content = (
                      <>
                        {/* COVER */}

                        <div
                          className="
                            relative
                            aspect-square
                            overflow-hidden
                            rounded-xl

                            bg-[var(--secondary-bg)]
                          "
                        >
                          <img
                            src={imageUrl(
                              album?.image
                            )}
                            alt={
                              album?.name ||
                              "Album"
                            }
                            className="
                              h-full
                              w-full
                              object-cover

                              transition
                              duration-300

                              group-hover:scale-105
                            "
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror =
                                null;

                              event.currentTarget.src =
                                "/Unknown.png";
                            }}
                          />

                          {spotifyUrl && (
                            <span
                              className="
                                absolute
                                right-2
                                top-2

                                flex
                                items-center
                                gap-1

                                rounded-full

                                bg-[#1DB954]

                                px-2
                                py-1

                                text-[10px]
                                font-bold
                                text-black
                              "
                            >
                              <FaSpotify />
                              Spotify
                            </span>
                          )}
                        </div>

                        {/* INFO */}

                        <div
                          className="
                            min-w-0
                            px-1
                            pt-2
                          "
                        >
                          <div
                            className="
                              truncate
                              text-sm
                              font-semibold
                              text-[var(--text-primary)]
                            "
                          >
                            {album?.name ||
                              "Unknown Album"}
                          </div>

                          <div
                            className="
                              mt-1
                              truncate
                              text-xs
                              text-[var(--text-secondary)]
                            "
                          >
                            {artistNames(
                              album?.artists
                            ) || "Album"}
                          </div>
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={getItemKey(
                          album,
                          `album-${index}`
                        )}
                        className="
                          group
                          relative
                          min-w-0
                        "
                      >
                        {/* ALBUM LINK */}

                        {spotifyUrl ? (
                          <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            title="Open album in Spotify"
                            aria-label="Open album in Spotify"
                          >
                            {content}
                          </a>
                        ) : album?.id ? (
                          <Link
                            to={`/albums/${album.id}`}
                            className="block"
                            title="Open album"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div>
                            {content}
                          </div>
                        )}

                        {/* REMOVE */}

                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            removeItem(
                              "likedAlbums",
                              album
                            );
                          }}
                          className="
                            absolute
                            left-2
                            top-2
                            z-20

                            flex
                            h-8
                            w-8
                            items-center
                            justify-center

                            rounded-full

                            bg-black/70
                            text-lg
                            leading-none
                            text-white

                            opacity-100

                            transition-opacity

                            sm:opacity-0
                            sm:group-hover:opacity-100

                            hover:bg-red-500
                          "
                          title="Remove from Favourite"
                          aria-label="Remove album from Favourite"
                        >
                          ×
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}

          {/* =================================================
              PLAYLISTS
          ================================================= */}

          {likedPlaylists.length > 0 && (
            <section className="mb-10">
              <div
                className="
                  mb-4
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <h2
                  className="
                    text-xl
                    font-bold
                    text-[var(--text-primary)]
                  "
                >
                  Playlists
                </h2>

                <span
                  className="
                    shrink-0
                    rounded-full
                    bg-[var(--secondary-bg)]

                    px-2.5
                    py-1

                    text-xs
                    font-medium
                    text-[var(--text-secondary)]
                  "
                >
                  {likedPlaylists.length}
                </span>
              </div>

              <div
                className="
                  grid
                  grid-cols-2
                  gap-4

                  sm:grid-cols-3
                  md:grid-cols-4
                  lg:grid-cols-5
                  xl:grid-cols-6
                "
              >
                {likedPlaylists.map(
                  (playlist, index) => {
                    const spotifyUrl =
                      getSpotifyUrl(
                        playlist
                      );

                    const spotifyType =
                      getSpotifyType(
                        playlist
                      );

                    const content = (
                      <>
                        {/* COVER */}

                        <div
                          className="
                            relative
                            aspect-square
                            overflow-hidden
                            rounded-xl

                            bg-[var(--secondary-bg)]
                          "
                        >
                          <img
                            src={imageUrl(
                              playlist?.image
                            )}
                            alt={
                              playlist?.name ||
                              "Playlist"
                            }
                            className="
                              h-full
                              w-full
                              object-cover

                              transition
                              duration-300

                              group-hover:scale-105
                            "
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror =
                                null;

                              event.currentTarget.src =
                                "/Unknown.png";
                            }}
                          />

                          {spotifyUrl && (
                            <span
                              className="
                                absolute
                                right-2
                                top-2

                                flex
                                items-center
                                gap-1

                                rounded-full

                                bg-[#1DB954]

                                px-2
                                py-1

                                text-[10px]
                                font-bold
                                text-black
                              "
                            >
                              <FaSpotify />
                              Spotify
                            </span>
                          )}
                        </div>

                        {/* INFO */}

                        <div
                          className="
                            min-w-0
                            px-1
                            pt-2
                          "
                        >
                          <div
                            className="
                              truncate
                              text-sm
                              font-semibold
                              text-[var(--text-primary)]
                            "
                          >
                            {playlist?.name ||
                              "Unknown Playlist"}
                          </div>

                          <div
                            className="
                              mt-1
                              truncate
                              text-xs
                              text-[var(--text-secondary)]
                            "
                          >
                            {spotifyType ===
                            "playlist"
                              ? "Spotify Playlist"
                              : "Playlist"}
                          </div>
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={getItemKey(
                          playlist,
                          `playlist-${index}`
                        )}
                        className="
                          group
                          relative
                          min-w-0
                        "
                      >
                        {/* PLAYLIST LINK */}

                        {spotifyUrl ? (
                          <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
                              block
                              cursor-pointer
                            "
                            title="Open playlist in Spotify"
                            aria-label="Open playlist in Spotify"
                          >
                            {content}
                          </a>
                        ) : playlist?.id ? (
                          <Link
                            to={`/playlists/${playlist.id}`}
                            className="
                              block
                              cursor-pointer
                            "
                            title="Open playlist"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div>
                            {content}
                          </div>
                        )}

                        {/* REMOVE */}

                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            removeItem(
                              "likedPlaylists",
                              playlist
                            );
                          }}
                          className="
                            absolute
                            left-2
                            top-2
                            z-20

                            flex
                            h-8
                            w-8
                            items-center
                            justify-center

                            rounded-full

                            bg-black/70
                            text-lg
                            leading-none
                            text-white

                            opacity-100

                            transition-opacity

                            sm:opacity-0
                            sm:group-hover:opacity-100

                            hover:bg-red-500
                          "
                          title="Remove from Favourite"
                          aria-label="Remove playlist from Favourite"
                        >
                          ×
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      <Navigator />
    </>
  );
};

export default Favourite;
