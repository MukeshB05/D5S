import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import AlbumDetail from "./pages/AlbumDetails";
import Home from "./pages/Home";
import MusicContext from "./context/MusicContext";
import ArtistsDetails from "./pages/ArtistsDetails";
import SearchResult from "./pages/searchResult";
import PlaylistDetails from "./pages/PlaylistDetails";
import Playlist from "./pages/Playlist";
import Favourite from "./pages/Favourite";
import SpotifyImport from "./pages/SpotifyImport";
import Player from "./components/Player";

import he from "he";
import { fetchSyncedLyrics } from "./lyrics";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { IoIosCheckmarkCircle } from "react-icons/io";

/* ---------------------------------------
   URL HELPERS
--------------------------------------- */

const firstUrl = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i -= 1) {
      const url = firstUrl(value[i]);

      if (url) {
        return url;
      }
    }

    return "";
  }

  if (typeof value === "object") {
    return firstUrl(
      value.url ??
        value.link ??
        value.src ??
        value.downloadUrl ??
        value.audioUrl ??
        value.audio ??
        value.streamUrl ??
        value.mediaUrl
    );
  }

  return "";
};

const imageUrl = (value) => {
  if (!value) return "/Unknown.png";

  const url = firstUrl(value);

  return url || "/Unknown.png";
};

/* ---------------------------------------
   ARTIST NORMALIZER
--------------------------------------- */

const normaliseArtists = (artists) => {
  if (Array.isArray(artists)) {
    return {
      primary: artists,
    };
  }

  if (artists && typeof artists === "object") {
    return artists;
  }

  if (typeof artists === "string") {
    return {
      primary: [
        {
          name: artists,
        },
      ],
    };
  }

  return {
    primary: [],
  };
};

/* ---------------------------------------
   SONG NORMALIZER
--------------------------------------- */

const normaliseSong = (input, legacy = {}) => {
  const source =
    input &&
    typeof input === "object" &&
    !Array.isArray(input)
      ? input
      : {
          audio: input,
          name: legacy.name,
          duration: legacy.duration,
          image: legacy.image,
          id: legacy.id,
          artists: legacy.artists,
        };

  const audioUrl = firstUrl(
    source.downloadUrl ??
      source.audioUrl ??
      source.audio ??
      source.streamUrl ??
      source.mediaUrl ??
      source.url
  );

  return {
    ...source,

    id:
      source.id ??
      source.songId ??
      source.trackId ??
      audioUrl,

    name:
      source.name ??
      source.title ??
      source.songName ??
      "Unknown Song",

    duration:
      Number(
        source.duration ??
          source.durationInSeconds ??
          source.length
      ) || 0,

    image: imageUrl(
      source.image ??
        source.cover ??
        source.coverImage
    ),

    artists: normaliseArtists(
      source.artists ??
        source.artist
    ),

    audioUrl,
  };
};

/* ---------------------------------------
   APP
--------------------------------------- */

export default function App() {
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [shuffle, setShuffle] = useState(false);

  const [repeatMode, setRepeatMode] = useState("none");

  const [lyrics, setLyrics] = useState({
    synced: false,
    lines: [],
    plain: "",
  });

  const [showSuccessPopup, setShowSuccessPopup] =
    useState(false);

  const currentSongRef = useRef(null);
  const queueRef = useRef([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef("none");

  /* ---------------------------------------
     CURRENT SONG
  --------------------------------------- */

  const setCurrent = useCallback((value) => {
    currentSongRef.current = value;
    setCurrentSong(value);
  }, []);

  /* ---------------------------------------
     SAVE PLAYED SONG
  --------------------------------------- */

  const savePlayedSong = useCallback((item) => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("playedSongs") || "[]"
      );

      const list = Array.isArray(saved)
        ? saved
        : [];

      const id = item.id;

      const without = list.filter(
        (x) => String(x?.id) !== String(id)
      );

      without.unshift({
        id: item.id,
        name: item.name,
        duration: item.duration,
        image: item.image,
        artists: item.artists,
        audio: item.audioUrl,
      });

      localStorage.setItem(
        "playedSongs",
        JSON.stringify(without.slice(0, 20))
      );
    } catch (error) {
      console.error(
        "Could not save played song:",
        error
      );
    }
  }, []);

  /* ---------------------------------------
     PLAY NORMALISED SONG
  --------------------------------------- */

  const playNormalisedSong = useCallback(
    async (item) => {
      const audioUrl = firstUrl(item?.audioUrl);

      if (!audioUrl) {
        console.error(
          "No playable audio URL:",
          item
        );
        return false;
      }

      const previous =
        currentSongRef.current;

      if (
        previous?.audio &&
        previous.audio !== item.audio
      ) {
        try {
          previous.audio.pause();
          previous.audio.removeAttribute("src");
          previous.audio.load();
        } catch (error) {
          console.warn(
            "Could not clean previous audio:",
            error
          );
        }
      }

      const audio = new Audio();

      audio.preload = "metadata";
      audio.src = audioUrl;

      // MusicMax uses a fixed default volume of 100%.
      // Do not restore an old localStorage volume value.
      audio.volume = 1;
      audio.muted = false;

      const current = {
        ...item,
        audio,
        url: audioUrl,
        audioUrl,
        coverImage: item.image,
      };

      setCurrent(current);
      setIsPlaying(false);

      savePlayedSong(item);

      try {
        await audio.play();

        setIsPlaying(true);

        return true;
      } catch (error) {
        console.error(
          "Audio play failed:",
          error
        );

        setIsPlaying(false);

        return false;
      }
    },
    [savePlayedSong, setCurrent]
  );

  /* ---------------------------------------
     PLAY MUSIC
  --------------------------------------- */

  const playMusic = useCallback(
    async (
      songOrUrl,
      name,
      duration,
      image,
      id,
      artists,
      songList
    ) => {
      let rawSong;
      let list = [];

      /*
        New API:
        playMusic(songObject, queue)

        Legacy API:
        playMusic(
          url,
          name,
          duration,
          image,
          id,
          artists,
          queue
        )
      */

      if (
        songOrUrl &&
        typeof songOrUrl === "object" &&
        !Array.isArray(songOrUrl)
      ) {
        rawSong = songOrUrl;

        list = Array.isArray(name)
          ? name
          : Array.isArray(songList)
          ? songList
          : [];
      } else {
        rawSong = {
          audio: songOrUrl,
          name,
          duration,
          image,
          id,
          artists,
        };

        list = Array.isArray(songList)
          ? songList
          : [];
      }

      const normalised = normaliseSong(
        rawSong,
        {
          name,
          duration,
          image,
          id,
          artists,
        }
      );

      if (!normalised.audioUrl) {
        console.error(
          "playMusic: invalid audio URL",
          songOrUrl
        );

        return;
      }

      /* ---------------------------------------
         UPDATE QUEUE
         ---------------------------------------

         A queue is replaced whenever a page explicitly
         supplies its complete song list.

         If no list is supplied, this is a true single-song
         playback session. Do NOT append it to a previous
         album/playlist queue.
      */

      if (list.length) {
        const normalisedQueue = list
          .map((item) => normaliseSong(item))
          .filter((item) => item.audioUrl);

        if (normalisedQueue.length) {
          const currentIndex = normalisedQueue.findIndex(
            (item) =>
              String(item.id) === String(normalised.id)
          );

          const finalQueue =
            currentIndex >= 0
              ? normalisedQueue
              : [normalised, ...normalisedQueue];

          queueRef.current = finalQueue;
          setQueue(finalQueue);
        } else {
          queueRef.current = [normalised];
          setQueue([normalised]);
        }
      } else {
        queueRef.current = [normalised];
        setQueue([normalised]);
      }

      /* Same song = toggle play/pause */

      const existing =
        currentSongRef.current;

      if (
        existing &&
        String(existing.id) ===
          String(normalised.id)
      ) {
        if (existing.audio.paused) {
          try {
            await existing.audio.play();

            setIsPlaying(true);
          } catch (error) {
            console.error(
              "Resume failed:",
              error
            );

            setIsPlaying(false);
          }
        } else {
          existing.audio.pause();

          setIsPlaying(false);
        }

        return;
      }

      await playNormalisedSong(
        normalised
      );
    },
    [playNormalisedSong]
  );

  /* ---------------------------------------
     NEXT SONG
  --------------------------------------- */

  const nextSong = useCallback(
    async () => {
      const current =
        currentSongRef.current;

      const list =
        queueRef.current;

      if (
        !current ||
        !list.length
      ) {
        return;
      }

      let index = list.findIndex(
        (item) =>
          String(item.id) ===
          String(current.id)
      );

      if (index < 0) {
        index = 0;
      }

      let nextIndex;

      if (
        shuffleRef.current &&
        list.length > 1
      ) {
        do {
          nextIndex = Math.floor(
            Math.random() *
              list.length
          );
        } while (
          nextIndex === index
        );
      } else {
        nextIndex = index + 1;

        if (
          nextIndex >=
          list.length
        ) {
          if (
            repeatRef.current ===
            "all"
          ) {
            nextIndex = 0;
          } else {
            current.audio.pause();

            setIsPlaying(false);

            return;
          }
        }
      }

      await playNormalisedSong(
        list[nextIndex]
      );
    },
    [playNormalisedSong]
  );

  /* ---------------------------------------
     PREVIOUS SONG
  --------------------------------------- */

  const prevSong = useCallback(
    async () => {
      const current =
        currentSongRef.current;

      const list =
        queueRef.current;

      if (
        !current ||
        !list.length
      ) {
        return;
      }

      if (
        current.audio &&
        current.audio.currentTime > 3
      ) {
        current.audio.currentTime = 0;

        return;
      }

      const index =
        list.findIndex(
          (item) =>
            String(item.id) ===
            String(current.id)
        );

      const safeIndex =
        index < 0
          ? 0
          : index;

      let previousIndex = safeIndex - 1;

      if (previousIndex < 0) {
        previousIndex =
          repeatRef.current === "all"
            ? list.length - 1
            : 0;
      }

      await playNormalisedSong(list[previousIndex]);
    },
    [playNormalisedSong]
  );

  /* ---------------------------------------
     SHUFFLE
  --------------------------------------- */

  const toggleShuffle =
    useCallback(() => {
      setShuffle((value) => {
        const next = !value;

        shuffleRef.current =
          next;

        return next;
      });
    }, []);

  /* ---------------------------------------
     REPEAT
  --------------------------------------- */

  const toggleRepeatMode =
    useCallback(() => {
      setRepeatMode((value) => {
        const next =
          value === "none"
            ? "one"
            : value === "one"
            ? "all"
            : "none";

        repeatRef.current =
          next;

        const audio =
          currentSongRef
            .current?.audio;

        if (audio) {
          audio.loop =
            next === "one";
        }

        return next;
      });
    }, []);

  /* ---------------------------------------
     DOWNLOAD
  --------------------------------------- */

  const downloadSong =
    useCallback(async () => {
      const audio =
        currentSongRef.current
          ?.audio;

      const url =
        audio?.currentSrc ||
        audio?.src ||
        currentSongRef.current
          ?.audioUrl;

      if (!url) {
        alert(
          "Download URL is not available."
        );

        return;
      }

      const filename =
        `${he.decode(
          String(
            currentSongRef.current
              ?.name || "song"
          )
        )}.mp3`;

      const safeFilename =
        filename.replace(
          /[\\/:*?"<>|]/g,
          "_"
        );

      try {
        const response =
          await fetch(url);

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const blob =
          await response.blob();

        const objectUrl =
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href =
          objectUrl;

        link.download =
          safeFilename;

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          URL.revokeObjectURL(
            objectUrl
          );
        }, 1000);
      } catch (error) {
        console.warn(
          "Blob download failed. Trying direct download:",
          error
        );

        const link =
          document.createElement(
            "a"
          );

        link.href = url;
        link.download =
          safeFilename;
        link.target = "_blank";
        link.rel = "noopener";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();
      }

      setShowSuccessPopup(
        true
      );

      window.setTimeout(() => {
        setShowSuccessPopup(
          false
        );
      }, 2500);
    }, []);

  /* ---------------------------------------
     LYRICS
  --------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const loadLyrics =
      async () => {
        if (!currentSong) {
          setLyrics({
            synced: false,
            lines: [],
            plain: "",
          });

          return;
        }

        const primary =
          currentSong.artists
            ?.primary;

        const artistName =
          Array.isArray(primary)
            ? primary
                .map(
                  (a) =>
                    a?.name
                )
                .filter(Boolean)
                .join(", ")
            : currentSong.artist ||
              "";

        setLyrics({
          synced: false,
          lines: [],
          plain:
            "Loading lyrics...",
        });

        try {
          const result =
            await fetchSyncedLyrics(
              currentSong.name,
              artistName,
              currentSong.duration
            );

          if (!cancelled) {
            setLyrics(
              result || {
                synced: false,
                lines: [],
                plain:
                  "No lyrics available.",
              }
            );
          }
        } catch (error) {
          console.error(
            "Lyrics load failed:",
            error
          );

          if (!cancelled) {
            setLyrics({
              synced: false,
              lines: [],
              plain:
                "Could not load lyrics.",
            });
          }
        }
      };

    loadLyrics();

    return () => {
      cancelled = true;
    };
  }, [
    currentSong?.id,
    currentSong?.name,
    currentSong?.duration,
  ]);

  /* ---------------------------------------
     MUSIC CONTEXT
  --------------------------------------- */

  const value = useMemo(
    () => ({
      songs: queue,
      song: queue,

      setSongs: (items) => {
        const normalised =
          Array.isArray(items)
            ? items
                .map((item) =>
                  normaliseSong(item)
                )
                .filter(
                  (item) =>
                    item.audioUrl
                )
            : [];

        queueRef.current =
          normalised;

        setQueue(normalised);
      },

      setSong: () => {},

      queue,

      currentSong,

      playMusic,

      nextSong,

      prevSong,

      isPlaying,

      setIsPlaying,

      shuffle,

      toggleShuffle,

      repeatMode,

      toggleRepeatMode,

      downloadSong,

      lyrics,

      coverImage:
        currentSong?.coverImage ||
        currentSong?.image ||
        "/Unknown.png",
    }),
    [
      queue,
      currentSong,
      playMusic,
      nextSong,
      prevSong,
      isPlaying,
      lyrics,
      shuffle,
      toggleShuffle,
      repeatMode,
      toggleRepeatMode,
      downloadSong,
    ]
  );

  /* ---------------------------------------
     RENDER
  --------------------------------------- */

  return (
    <>
      <Analytics />

      <SpeedInsights />

      <MusicContext.Provider
        value={value}
      >
        <Router>
          <Routes>
            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/artists/:id"
              element={
                <ArtistsDetails />
              }
            />

            <Route
              path="/albums/:id"
              element={
                <AlbumDetail />
              }
            />

            <Route
              path="/search/:query"
              element={
                <SearchResult />
              }
            />

            <Route
              path="/playlists/:id"
              element={
                <PlaylistDetails />
              }
            />

            <Route
              path="/Playlist"
              element={<Playlist />}
            />

            <Route
              path="/playlist"
              element={<Playlist />}
            />

            <Route
              path="/Favourite"
              element={
                <Favourite />
              }
            />

            <Route
              path="/favourite"
              element={
                <Favourite />
              }
            />

            <Route
              path="/spotify-import"
              element={
                <SpotifyImport />
              }
            />
          </Routes>

          <Player />
        </Router>
      </MusicContext.Provider>

      {showSuccessPopup && (
        <div className="fixed top-6 left-0 z-[100] flex w-full justify-center">
          <div className="flex items-center gap-3 rounded bg-[#2c2c2c] p-3 text-white shadow-xl">
            <IoIosCheckmarkCircle className="text-xl" />

            <span className="font-semibold">
              Downloaded
            </span>
          </div>
        </div>
      )}
    </>
  );
}
