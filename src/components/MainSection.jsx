import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchplaylistsByID,
  searchAlbumByQuery,
  searchPlayListByQuery,
} from "../../fetch";

import AlbumSlider from "./Sliders/AlbumSlider";
import PlaylistSlider from "./Sliders/PlaylistSlider";
import ArtistSlider from "./Sliders/ArtistSlider";
import SongGrid from "./SongGrid";

import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

import { artistData } from "../genreData";

// ============================================================
// CACHE CONFIG
// ============================================================

const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

const CACHE_KEYS = {
  trending: "musicmax_main_trending",
  latest: "musicmax_main_latest",
  albums: "musicmax_main_albums",
  playlists: "musicmax_main_playlists",
};

// ============================================================
// SAFE CACHE READ
// ============================================================

const readCache = (key) => {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.data)
    ) {
      return null;
    }

    const age = Date.now() - Number(parsed.timestamp || 0);

    if (age > CACHE_TIME) {
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn(`Cache read failed: ${key}`, error);
    return null;
  }
};

// ============================================================
// SAFE CACHE WRITE
// ============================================================

const writeCache = (key, data) => {
  try {
    if (!Array.isArray(data)) {
      return;
    }

    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.warn(`Cache write failed: ${key}`, error);
  }
};

// ============================================================
// NORMALIZE ARRAY
// ============================================================

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

// ============================================================
// MAIN SECTION
// ============================================================

const MainSection = () => {
  // ==========================================================
  // STATE
  // ==========================================================

  const [trending, setTrending] = useState(() => {
    return readCache(CACHE_KEYS.trending) || [];
  });

  const [latestSongs, setLatestSongs] = useState(() => {
    return readCache(CACHE_KEYS.latest) || [];
  });

  const [albums, setAlbums] = useState(() => {
    return readCache(CACHE_KEYS.albums) || [];
  });

  const [artists, setArtists] = useState(() => {
    if (Array.isArray(artistData?.results)) {
      return artistData.results;
    }

    if (Array.isArray(artistData)) {
      return artistData;
    }

    return [];
  });

  const [playlists, setPlaylists] = useState(() => {
    return readCache(CACHE_KEYS.playlists) || [];
  });

  const [recentlyPlayedSongs, setRecentlyPlayedSongs] =
    useState([]);

  // Individual loading states.
  const [trendingLoading, setTrendingLoading] =
    useState(trending.length === 0);

  const [latestLoading, setLatestLoading] =
    useState(latestSongs.length === 0);

  const [albumsLoading, setAlbumsLoading] =
    useState(albums.length === 0);

  const [playlistsLoading, setPlaylistsLoading] =
    useState(playlists.length === 0);

  const [error, setError] = useState("");

  // ==========================================================
  // REFS
  // ==========================================================

  const recentlyPlayedScrollRef = useRef(null);
  const latestSongsScrollRef = useRef(null);
  const trendingScrollRef = useRef(null);

  // ==========================================================
  // RECENTLY PLAYED
  // ==========================================================

  const loadRecentlyPlayed = useCallback(() => {
    try {
      const storedSongs =
        localStorage.getItem("playedSongs");

      if (!storedSongs) {
        setRecentlyPlayedSongs([]);
        return;
      }

      const parsedSongs = JSON.parse(storedSongs);

      if (!Array.isArray(parsedSongs)) {
        setRecentlyPlayedSongs([]);
        return;
      }

      setRecentlyPlayedSongs(parsedSongs);
    } catch (err) {
      console.error(
        "Unable to read recently played songs:",
        err
      );

      setRecentlyPlayedSongs([]);
    }
  }, []);

  // ==========================================================
  // INITIAL LOCAL DATA
  // ==========================================================

  useEffect(() => {
    loadRecentlyPlayed();

    const handleStorage = () => {
      loadRecentlyPlayed();
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [loadRecentlyPlayed]);

  // ==========================================================
  // SCROLL HELPERS
  // ==========================================================

  const scrollLeft = useCallback((ref) => {
    if (!ref?.current) {
      return;
    }

    ref.current.scrollBy({
      left: -800,
      behavior: "smooth",
    });
  }, []);

  const scrollRight = useCallback((ref) => {
    if (!ref?.current) {
      return;
    }

    ref.current.scrollBy({
      left: 800,
      behavior: "smooth",
    });
  }, []);

  // ==========================================================
  // GREETING
  // ==========================================================

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good Morning";
    }

    if (hour < 18) {
      return "Good Afternoon";
    }

    if (hour < 21) {
      return "Good Evening";
    }

    return "Good Night";
  };

  // ==========================================================
  // LOAD TRENDING
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadTrending = async () => {
      try {
        const response =
          await fetchplaylistsByID(10763385);

        if (!mounted) {
          return;
        }

        const songs = normalizeArray(
          response?.data?.songs
        );

        setTrending(songs);
        writeCache(
          CACHE_KEYS.trending,
          songs
        );
      } catch (err) {
        console.error(
          "Trending API Error:",
          err
        );

        if (
          mounted &&
          trending.length === 0
        ) {
          setError((previous) =>
            previous ||
            "Unable to load some music data."
          );
        }
      } finally {
        if (mounted) {
          setTrendingLoading(false);
        }
      }
    };

    loadTrending();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // LOAD NEW SONGS
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadLatestSongs = async () => {
      try {
        const response =
          await fetchplaylistsByID(80802063);

        if (!mounted) {
          return;
        }

        const songs = normalizeArray(
          response?.data?.songs
        );

        setLatestSongs(songs);
        writeCache(
          CACHE_KEYS.latest,
          songs
        );
      } catch (err) {
        console.error(
          "Latest Songs API Error:",
          err
        );

        if (
          mounted &&
          latestSongs.length === 0
        ) {
          setError((previous) =>
            previous ||
            "Unable to load some music data."
          );
        }
      } finally {
        if (mounted) {
          setLatestLoading(false);
        }
      }
    };

    loadLatestSongs();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // LOAD ALBUMS
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadAlbums = async () => {
      try {
        const response =
          await searchAlbumByQuery(
            "Tamil, Malayalam"
          );

        if (!mounted) {
          return;
        }

        const results = normalizeArray(
          response?.data?.results
        );

        setAlbums(results);
        writeCache(
          CACHE_KEYS.albums,
          results
        );
      } catch (err) {
        console.error(
          "Albums API Error:",
          err
        );

        if (
          mounted &&
          albums.length === 0
        ) {
          setError((previous) =>
            previous ||
            "Unable to load some music data."
          );
        }
      } finally {
        if (mounted) {
          setAlbumsLoading(false);
        }
      }
    };

    loadAlbums();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // LOAD PLAYLISTS
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadPlaylists = async () => {
      try {
        const response =
          await searchPlayListByQuery(
            "Tamil, Malayalam"
          );

        if (!mounted) {
          return;
        }

        const results = normalizeArray(
          response?.data?.results
        );

        setPlaylists(results);
        writeCache(
          CACHE_KEYS.playlists,
          results
        );
      } catch (err) {
        console.error(
          "Playlists API Error:",
          err
        );

        if (
          mounted &&
          playlists.length === 0
        ) {
          setError((previous) =>
            previous ||
            "Unable to load some music data."
          );
        }
      } finally {
        if (mounted) {
          setPlaylistsLoading(false);
        }
      }
    };

    loadPlaylists();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // SMALL SECTION LOADER
  // ==========================================================

  const SectionLoader = () => {
    return (
      <div className="w-full px-4 py-5">
        <div
          className="
            h-28
            w-full
            rounded-xl
            animate-pulse
            bg-black/10
            dark:bg-white/10
          "
        />
      </div>
    );
  };

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <main
      className="
        pt-[3rem]
        lg:pt-5
        my-[2rem]
        mt-[5rem]
        lg:my-[4rem]
        flex
        flex-col
        items-center
        overflow-x-clip
        gap-[0.3rem]
        w-full
      "
    >
      {/* ====================================================
          GREETING
      ===================================================== */}

      <div
        className="
          hidden
          lg:block
          text-2xl
          w-full
          font-semibold
          lg:ml-[5.5rem]
          m-1
        "
      >
        {getGreeting()}
      </div>

      {/* ====================================================
          SMALL ERROR NOTICE
      ===================================================== */}

      {error && (
        <div
          className="
            w-[calc(100%-2rem)]
            max-w-3xl
            mx-auto
            mb-3
            px-4
            py-2
            rounded-lg
            bg-red-500/10
            text-red-500
            text-sm
            text-center
          "
        >
          Some music sections could not be loaded.
        </div>
      )}

      {/* ====================================================
          RECENTLY PLAYED
      ===================================================== */}

      {recentlyPlayedSongs.length > 0 && (
        <section className="flex flex-col justify-center items-center w-full">
          <h2
            className="
              m-4
              mt-0
              text-xl
              lg:text-2xl
              font-semibold
              w-full
              ml-[3.5rem]
              lg:ml-[6.5rem]
            "
          >
            Recently Played
          </h2>

          <div className="flex justify-center items-center gap-3 w-full">
            <button
              type="button"
              aria-label="Scroll recently played left"
              onClick={() =>
                scrollLeft(
                  recentlyPlayedScrollRef
                )
              }
              className="
                text-3xl
                hover:scale-125
                transition-all
                duration-200
                cursor-pointer
                h-[9rem]
                arrow-btn
                hidden
                lg:flex
                items-center
                justify-center
              "
            >
              <MdOutlineKeyboardArrowLeft />
            </button>

            <div
              ref={recentlyPlayedScrollRef}
              className="
                grid
                grid-rows-1
                grid-flow-col
                justify-start
                overflow-x-auto
                scroll-hide
                items-center
                gap-3
                lg:gap-2
                w-full
                px-3
                lg:px-0
                scroll-smooth
              "
            >
              {recentlyPlayedSongs.map(
                (song, index) => (
                  <SongGrid
                    key={
                      song?.id ??
                      song?.songId ??
                      index
                    }
                    {...song}
                    songs={recentlyPlayedSongs}
                  />
                )
              )}
            </div>

            <button
              type="button"
              aria-label="Scroll recently played right"
              onClick={() =>
                scrollRight(
                  recentlyPlayedScrollRef
                )
              }
              className="
                text-3xl
                hover:scale-125
                transition-all
                duration-200
                cursor-pointer
                h-[9rem]
                arrow-btn
                hidden
                lg:flex
                items-center
                justify-center
              "
            >
              <MdOutlineKeyboardArrowRight />
            </button>
          </div>
        </section>
      )}

      {/* ====================================================
          NEW SONGS
      ===================================================== */}

      <section className="flex flex-col items-center w-full">
        <h2
          className="
            m-4
            text-xl
            lg:text-2xl
            font-semibold
            w-full
            ml-[3.5rem]
            lg:ml-[6.5rem]
          "
        >
          New Songs
        </h2>

        {latestLoading && latestSongs.length === 0 ? (
          <SectionLoader />
        ) : latestSongs.length > 0 ? (
          <div className="flex justify-center items-center gap-3 w-full">
            <button
              type="button"
              aria-label="Scroll new songs left"
              onClick={() =>
                scrollLeft(
                  latestSongsScrollRef
                )
              }
              className="
                text-3xl
                hover:scale-125
                transition-all
                duration-200
                cursor-pointer
                h-[9rem]
                arrow-btn
                hidden
                lg:flex
                items-center
                justify-center
              "
            >
              <MdOutlineKeyboardArrowLeft />
            </button>

            <div
              ref={latestSongsScrollRef}
              className="
                grid
                grid-rows-1
                lg:grid-rows-2
                grid-flow-col
                justify-start
                overflow-x-auto
                scroll-hide
                items-center
                gap-3
                lg:gap-2
                w-full
                px-3
                lg:px-0
                scroll-smooth
              "
            >
              {latestSongs.map(
                (song, index) => (
                  <SongGrid
                    key={
                      song?.id ??
                      song?.songId ??
                      index
                    }
                    {...song}
                    songs={latestSongs}
                  />
                )
              )}
            </div>

            <button
              type="button"
              aria-label="Scroll new songs right"
              onClick={() =>
                scrollRight(
                  latestSongsScrollRef
                )
              }
              className="
                text-3xl
                hover:scale-125
                transition-all
                duration-200
                cursor-pointer
                h-[9rem]
                arrow-btn
                hidden
                lg:flex
                items-center
                justify-center
              "
            >
              <MdOutlineKeyboardArrowRight />
            </button>
          </div>
        ) : (
          <p className="px-5 opacity-60">
            No new songs available.
          </p>
        )}
      </section>

      <br />

      {/* ====================================================
          TODAY TRENDING
      ===================================================== */}

      <section className="flex flex-col justify-center items-center w-full">
        <h2
          className="
            m-4
            mt-0
            text-xl
            lg:text-2xl
            font-semibold
            w-full
            ml-[3.5rem]
            lg:ml-[6.5rem]
          "
        >
          Today Trending
        </h2>

        {trendingLoading && trending.length === 0 ? (
          <SectionLoader />
        ) : trending.length > 0 ? (
          <div className="flex justify-center items-center gap-3 w-full">
            <button
              type="button"
              aria-label="Scroll trending songs left"
              onClick={() =>
                scrollLeft(
                  trendingScrollRef
                )
              }
              className="
                text-3xl
                hover:scale-125
                transition-all
                duration-200
                cursor-pointer
                h-[9rem]
                arrow-btn
                hidden
                lg:flex
                items-center
                justify-center
              "
            >
              <MdOutlineKeyboardArrowLeft />
            </button>

            <div
              ref={trendingScrollRef}
              className="
                grid
                grid-rows-1
                sm:grid-rows-2
                grid-flow-col
                justify-start
                overflow-x-auto
                scroll-hide
                items-center
                gap-3
                lg:gap-2
                w-full
                px-3
                lg:px-0
                scroll-smooth
              "
            >
              {trending.map(
                (song, index) => (
                  <SongGrid
                    key={
                      song?.id ??
                      song?.songId ??
                      index
                    }
                    {...song}
                    songs={trending}
                  />
                )
              )}
            </div>

            <button
              type="button"
              aria-label="Scroll trending songs right"
              onClick={() =>
                scrollRight(
                  trendingScrollRef
                )
              }
              className="
                text-3xl
                hover:scale-125
                transition-all
                duration-200
                cursor-pointer
                h-[9rem]
                arrow-btn
                hidden
                lg:flex
                items-center
                justify-center
              "
            >
              <MdOutlineKeyboardArrowRight />
            </button>
          </div>
        ) : (
          <p className="px-5 opacity-60">
            No trending songs available.
          </p>
        )}
      </section>

      <br />

      {/* ====================================================
          TOP ALBUMS
      ===================================================== */}

      <section className="w-full">
        <h2
          className="
            m-4
            mt-0
            text-xl
            lg:text-2xl
            font-semibold
            w-full
            ml-[1rem]
            lg:ml-[3rem]
          "
        >
          Top Albums
        </h2>

        {albumsLoading && albums.length === 0 ? (
          <SectionLoader />
        ) : albums.length > 0 ? (
          <AlbumSlider albums={albums} />
        ) : (
          <p className="px-5 opacity-60">
            No albums available.
          </p>
        )}
      </section>

      <br />

      {/* ====================================================
          TOP ARTISTS
      ===================================================== */}

      <section className="w-full">
        <h2
          className="
            pr-1
            m-4
            mt-0
            text-xl
            lg:text-2xl
            font-semibold
            w-full
            ml-[1rem]
            lg:ml-[3.5rem]
          "
        >
          Top Artists
        </h2>

        {artists.length > 0 ? (
          <ArtistSlider artists={artists} />
        ) : (
          <p className="px-5 opacity-60">
            No artists available.
          </p>
        )}
      </section>

      <br />

      {/* ====================================================
          TOP PLAYLISTS
      ===================================================== */}

      <section className="w-full flex flex-col gap-3">
        <h2
          className="
            m-1
            text-xl
            lg:text-2xl
            font-semibold
            w-full
            ml-[1rem]
            lg:ml-[2.8rem]
          "
        >
          Top Playlists
        </h2>

        {playlistsLoading &&
        playlists.length === 0 ? (
          <SectionLoader />
        ) : playlists.length > 0 ? (
          <PlaylistSlider
            playlists={playlists}
          />
        ) : (
          <p className="px-5 opacity-60">
            No playlists available.
          </p>
        )}
      </section>
    </main>
  );
};

export default MainSection;
