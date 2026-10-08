import { useContext, useEffect, useState } from "react";

import Navigator from "../components/Navigator";
import Navbar from "../components/Navbar";

import MusicContext from "../context/MusicContext";

import {
  createSpotifyLoginUrl,
  exchangeSpotifyCode,
  getSpotifyItems,
  getSpotifyToken,
  logoutSpotify,
} from "../services/spotifyImport";

/* =========================================================
   SAVE IMPORTED SONGS TO FAVOURITES
========================================================= */

const saveImportedSongsToFavourites = (songs) => {
  try {
    const stored = JSON.parse(
      localStorage.getItem("likedSongs") || "[]"
    );

    const current = Array.isArray(stored) ? stored : [];

    const map = new Map();

    current.forEach((song) => {
      if (song?.id != null) {
        map.set(String(song.id), song);
      }
    });

    let added = 0;

    for (const song of songs || []) {
      if (!song?.id) {
        continue;
      }

      const id = String(song.id);

      if (!map.has(id)) {
        added += 1;
      }

      map.set(id, {
        ...song,

        audio:
          song?.audioUrl ||
          song?.audio ||
          song?.downloadUrl ||
          "",
      });
    }

    localStorage.setItem(
      "likedSongs",
      JSON.stringify(Array.from(map.values()))
    );

    window.dispatchEvent(
      new Event("favouritesUpdated")
    );

    return added;
  } catch (error) {
    console.error(
      "Favourite songs save failed:",
      error
    );

    return 0;
  }
};

/* =========================================================
   SAVE IMPORTED ALBUM / PLAYLIST TO FAVOURITES
========================================================= */

const saveImportedSourceToFavourite = (spotifyData) => {
  if (!spotifyData?.id) {
    return false;
  }

  let key = "";

  if (spotifyData.type === "album") {
    key = "likedAlbums";
  }

  if (spotifyData.type === "playlist") {
    key = "likedPlaylists";
  }

  if (!key) {
    return false;
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

    const current = Array.isArray(stored)
      ? stored
      : [];

    const existingIndex = current.findIndex(
      (item) =>
        item?.source === "spotify" &&
        String(item?.id) ===
          String(spotifyData.id)
    );

    const source = {
      id: spotifyData.id,

      name:
        spotifyData.name ||
        `Spotify ${spotifyData.type}`,

      image:
        spotifyData.image ||
        "/Unknown.png",

      artists:
        spotifyData.artists || {
          primary: [],
        },

      source: "spotify",

      spotifyType:
        spotifyData.type,

      spotifyUrl:
        spotifyData.spotifyUrl || "",
    };

    const updated = [...current];

    if (existingIndex >= 0) {
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...source,
      };
    } else {
      updated.push(source);
    }

    localStorage.setItem(
      key,
      JSON.stringify(updated)
    );

    window.dispatchEvent(
      new Event("favouritesUpdated")
    );

    return existingIndex < 0;
  } catch (error) {
    console.error(
      "Spotify Favourite save failed:",
      error
    );

    return false;
  }
};

/* =========================================================
   SPOTIFY IMPORT COMPONENT
========================================================= */

const SpotifyImport = () => {
  const { playMusic } =
    useContext(MusicContext) || {};

  const [url, setUrl] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [connected, setConnected] =
    useState(Boolean(getSpotifyToken()));

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState("");

  const [favouriteAdded, setFavouriteAdded] =
    useState(0);

  /* =======================================================
     SPOTIFY CALLBACK
  ======================================================= */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const code = params.get("code");
    const state = params.get("state");
    const errorParam = params.get("error");

    if (errorParam) {
      setError(
        `Spotify login failed: ${errorParam}`
      );

      window.history.replaceState(
        {},
        document.title,
        "/spotify-import"
      );

      return;
    }

    if (!code) {
      return;
    }

    const completeLogin = async () => {
      try {
        setLoading(true);
        setError("");

        await exchangeSpotifyCode(
          code,
          state
        );

        setConnected(true);

        window.history.replaceState(
          {},
          document.title,
          "/spotify-import"
        );
      } catch (loginError) {
        console.error(
          "Spotify login error:",
          loginError
        );

        setError(
          loginError?.message ||
            "Spotify connection failed."
        );
      } finally {
        setLoading(false);
      }
    };

    completeLogin();
  }, []);

  /* =======================================================
     CONNECT SPOTIFY
  ======================================================= */

  const connectSpotify = async () => {
    try {
      setError("");
      setLoading(true);

      const loginUrl =
        await createSpotifyLoginUrl();

      if (!loginUrl) {
        throw new Error(
          "Spotify login URL was not created."
        );
      }

      window.location.href = loginUrl;
    } catch (connectError) {
      console.error(
        "Spotify connection error:",
        connectError
      );

      setError(
        connectError?.message ||
          "Unable to connect Spotify."
      );

      setLoading(false);
    }
  };

  /* =======================================================
     IMPORT
  ======================================================= */

  const handleImport = async (event) => {
    event.preventDefault();

    setError("");
    setResult(null);
    setFavouriteAdded(0);

    if (!connected) {
      setError(
        "Please connect Spotify first."
      );

      return;
    }

    if (!url.trim()) {
      setError(
        "Paste a Spotify track, album or playlist URL."
      );

      return;
    }

    try {
      setLoading(true);

      const spotifyData =
        await getSpotifyItems(
          url.trim()
        );

      if (!spotifyData) {
        throw new Error(
          "No Spotify data was returned."
        );
      }

      if (
        !Array.isArray(
          spotifyData.songs
        ) ||
        spotifyData.songs.length === 0
      ) {
        throw new Error(
          "No playable Spotify tracks were found."
        );
      }

      /* ---------------------------------------------
         Save songs to Favourite
      --------------------------------------------- */

      const addedSongs =
        saveImportedSongsToFavourites(
          spotifyData.songs
        );

      /* ---------------------------------------------
         Save album / playlist to Favourite
      --------------------------------------------- */

      const addedSource =
        saveImportedSourceToFavourite(
          spotifyData
        );

      const totalAdded =
        addedSongs +
        (addedSource ? 1 : 0);

      setFavouriteAdded(
        totalAdded
      );

      setResult(
        spotifyData
      );

      /* ---------------------------------------------
         Queue ALL imported tracks
      --------------------------------------------- */

      if (typeof playMusic === "function") {
        playMusic(
          spotifyData.songs[0],
          spotifyData.songs
        );
      }
    } catch (importError) {
      console.error(
        "Spotify import error:",
        importError
      );

      setError(
        importError?.message ||
          "Spotify import failed."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    try {
      logoutSpotify();
    } catch (logoutError) {
      console.error(
        "Spotify logout error:",
        logoutError
      );
    }

    setConnected(false);
    setResult(null);
    setError("");
    setUrl("");
    setFavouriteAdded(0);
  };

  /* =======================================================
     RESULT IMAGE
  ======================================================= */

  const resultImage =
    result?.image || "/Unknown.png";

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
          px-4
          pt-[6rem]
          pb-[12rem]
          transition-colors
          duration-300
          bg-[var(--background)]
          text-[var(--text-primary)]
        "
      >
        <div
          className="
            mx-auto
            flex
            w-full
            max-w-2xl
            justify-center
            pt-5
          "
        >
          <div
            className="
              w-full
              overflow-hidden
              rounded-2xl
              border
              border-[var(--card-border)]
              bg-[var(--card-bg)]
              p-5
              shadow-lg
              transition-colors
              duration-300
              sm:p-6
            "
          >
            {/* =========================================
                HEADER
            ========================================= */}

            <div className="mb-6 text-center">
              <h1
                className="
                  text-2xl
                  font-bold
                  text-[var(--text-primary)]
                  sm:text-3xl
                "
              >
                Spotify Import
              </h1>

              <p
                className="
                  mt-2
                  text-sm
                  text-[var(--text-secondary)]
                "
              >
                Import Spotify tracks,
                albums and playlists
                into your queue and favourites.
              </p>
            </div>

            {/* =========================================
                NOT CONNECTED
            ========================================= */}

            {!connected ? (
              <button
                type="button"
                onClick={connectSpotify}
                disabled={loading}
                className="
                  w-full
                  rounded-xl
                  bg-[#1DB954]
                  px-4
                  py-3
                  font-semibold
                  text-white
                  transition
                  duration-200
                  hover:bg-[#1ed760]
                  active:scale-[0.99]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {loading
                  ? "Connecting..."
                  : "Connect Spotify"}
              </button>
            ) : (
              <>
                {/* =====================================
                    CONNECTED STATUS
                ===================================== */}

                <div
                  className="
                    mb-4
                    flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    border-green-500/20
                    bg-green-500/10
                    px-4
                    py-3
                    text-sm
                    text-green-500
                  "
                >
                  <span
                    className="
                      flex
                      h-6
                      w-6
                      items-center
                      justify-center
                      rounded-full
                      bg-green-500
                      text-xs
                      font-bold
                      text-white
                    "
                  >
                    ✓
                  </span>

                  <span>
                    Spotify connected
                  </span>
                </div>

                {/* =====================================
                    IMPORT FORM
                ===================================== */}

                <form
                  onSubmit={handleImport}
                  className="space-y-3"
                >
                  <label
                    htmlFor="spotify-url"
                    className="
                      block
                      text-sm
                      font-medium
                      text-[var(--text-primary)]
                    "
                  >
                    Spotify URL
                  </label>

                  <input
                    id="spotify-url"
                    type="url"
                    value={url}
                    onChange={(event) =>
                      setUrl(
                        event.target.value
                      )
                    }
                    placeholder="Paste Spotify track, album or playlist URL"
                    disabled={loading}
                    autoComplete="off"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-[var(--input-border)]
                      bg-[var(--input-bg)]
                      px-4
                      py-3
                      text-[var(--text-primary)]
                      placeholder:text-[var(--text-secondary)]
                      outline-none
                      transition
                      duration-200
                      focus:border-green-500
                      focus:ring-2
                      focus:ring-green-500/20
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  />

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !url.trim()
                    }
                    className="
                      w-full
                      rounded-xl
                      bg-[#1DB954]
                      px-4
                      py-3
                      font-semibold
                      text-white
                      transition
                      duration-200
                      hover:bg-[#1ed760]
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {loading
                      ? "Importing..."
                      : "Import to Queue + Favourite"}
                  </button>
                </form>

                {/* =====================================
                    DISCONNECT
                ===================================== */}

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loading}
                  className="
                    mt-3
                    w-full
                    rounded-xl
                    border
                    border-red-500/50
                    bg-red-500/5
                    px-4
                    py-2.5
                    font-medium
                    text-red-500
                    transition
                    duration-200
                    hover:bg-red-500/10
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Disconnect Spotify
                </button>
              </>
            )}

            {/* =========================================
                ERROR
            ========================================= */}

            {error && (
              <div
                role="alert"
                className="
                  mt-4
                  rounded-xl
                  border
                  border-red-500/20
                  bg-red-500/10
                  px-4
                  py-3
                  text-sm
                  text-red-500
                "
              >
                <div className="flex gap-2">
                  <span className="font-bold">
                    !
                  </span>

                  <span>
                    {error}
                  </span>
                </div>
              </div>
            )}

            {/* =========================================
                FAVOURITE SUCCESS
            ========================================= */}

            {favouriteAdded > 0 && (
              <div
                className="
                  mt-4
                  rounded-xl
                  border
                  border-green-500/20
                  bg-green-500/10
                  px-4
                  py-3
                  text-sm
                  text-green-500
                "
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">
                    ✓
                  </span>

                  <span>
                    Added automatically to Favourite
                    {favouriteAdded > 1
                      ? ` (${favouriteAdded} new items)`
                      : ""}
                  </span>
                </div>
              </div>
            )}

            {/* =========================================
                IMPORT RESULT
            ========================================= */}

            {result && (
              <div
                className="
                  mt-5
                  overflow-hidden
                  rounded-xl
                  border
                  border-[var(--card-border)]
                  bg-[var(--secondary-bg)]
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-4
                    p-4
                  "
                >
                  <img
                    src={resultImage}
                    alt={
                      result.name ||
                      "Spotify"
                    }
                    className="
                      h-16
                      w-16
                      shrink-0
                      rounded-xl
                      border
                      border-[var(--card-border)]
                      object-cover
                    "
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror =
                        null;

                      event.currentTarget.src =
                        "/Unknown.png";
                    }}
                  />

                  <div className="min-w-0">
                    <p
                      className="
                        truncate
                        font-bold
                        text-[var(--text-primary)]
                      "
                    >
                      {result.name ||
                        "Spotify Import"}
                    </p>

                    <p
                      className="
                        mt-1
                        text-sm
                        capitalize
                        text-[var(--text-secondary)]
                      "
                    >
                      {result.type ||
                        "Spotify"}
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-green-500
                      "
                    >
                      {Array.isArray(
                        result.songs
                      )
                        ? result.songs.length
                        : 0}{" "}
                      songs queued
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Navigator />
    </>
  );
};

export default SpotifyImport;
