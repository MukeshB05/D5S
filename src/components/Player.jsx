import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  IoMdSkipBackward,
  IoMdSkipForward,
  IoIosClose,
} from "react-icons/io";

import { IoShareSocial } from "react-icons/io5";
import { PiShuffleBold } from "react-icons/pi";

import {
  LuRepeat,
  LuRepeat1,
} from "react-icons/lu";

import {
  FaPlay,
  FaPause,
  FaHeart,
  FaRegHeart,
} from "react-icons/fa";

import { MdDownload } from "react-icons/md";
import { CiMaximize1 } from "react-icons/ci";

import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

import { Link } from "react-router-dom";
import he from "he";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

import MusicContext from "../context/MusicContext";

import ArtistItems from "./Items/ArtistItems";
import SongGrid from "./SongGrid";

import {
  getSongById,
  getSuggestionSong,
} from "../../fetch";

/* =========================================================
   CONSTANTS
========================================================= */

const FALLBACK_IMAGE = "/Unknown.png";

/* =========================================================
   FFMPEG DOWNLOAD / ID3 METADATA
========================================================= */

const FFMPEG_CORE_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

const getFFmpeg = async () => {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const [coreURL, wasmURL, workerURL] =
        await Promise.all([
          toBlobURL(
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          toBlobURL(
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
          toBlobURL(
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.worker.js`,
            "text/javascript"
          ),
        ]);

      await ffmpegInstance.load({
        coreURL,
        wasmURL,
        workerURL,
      });

      return ffmpegInstance;
    })().catch((error) => {
      ffmpegLoadPromise = null;
      throw error;
    });
  }

  return ffmpegLoadPromise;
};

const sanitizeMetadata = (value, fallback = "") =>
  safeDecode(value ?? "").replace(/\0/g, "").trim() || fallback;

const stripMediaExtensions = (value) =>
  sanitizeMetadata(value, "")
    .replace(
      /(?:\.(?:mp3|m4a|aac|flac|wav|ogg|oga|opus|webm|mp4))+$/i,
      ""
    )
    .trim();

const safeFilename = (value) =>
  stripMediaExtensions(value)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "song";

const bytesFromBuffer = (buffer) =>
  buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer);

const ffDelete = async (ff, filename) => {
  try {
    await ff.deleteFile(filename);
  } catch {
    // Ignore cleanup errors.
  }
};

const embedWithCover = async (
  ff,
  audioData,
  coverData,
  meta
) => {
  const inputName = "input.media";
  const audioMp3Name = "audio-320.mp3";
  const coverName = "cover.jpg";
  const outputName = "output.mp3";

  const metadataArgs = [
    "-map_metadata",
    "-1",
    "-id3v2_version",
    "3",
    "-write_id3v1",
    "1",
    "-metadata",
    `title=${sanitizeMetadata(
      stripMediaExtensions(meta?.title),
      "Unknown Song"
    )}`,
    "-metadata",
    `artist=${sanitizeMetadata(
      meta?.artist,
      "Unknown Artist"
    )}`,
    "-metadata",
    `album=${sanitizeMetadata(
      meta?.album,
      "Unknown Album"
    )}`,
    "-metadata",
    `album_artist=${sanitizeMetadata(
      meta?.albumArtist,
      meta?.artist || "Unknown Artist"
    )}`,
  ];

  if (meta?.year) {
    metadataArgs.push(
      "-metadata",
      `date=${sanitizeMetadata(meta.year)}`
    );
  }

  if (meta?.publisher) {
    metadataArgs.push(
      "-metadata",
      `publisher=${sanitizeMetadata(meta.publisher)}`
    );
  }

  if (meta?.copyright) {
    metadataArgs.push(
      "-metadata",
      `copyright=${sanitizeMetadata(meta.copyright)}`
    );
  }

  await ffDelete(ff, inputName);
  await ffDelete(ff, audioMp3Name);
  await ffDelete(ff, coverName);
  await ffDelete(ff, outputName);

  try {
    /*
     * PASS 1
     * Always create a real MP3 first.
     * This is important on mobile browsers: artwork muxing
     * must never prevent the audio conversion from succeeding.
     */
    await ff.writeFile(
      inputName,
      bytesFromBuffer(audioData)
    );

    await ff.exec([
      "-y",
      "-i",
      inputName,
      "-map",
      "0:a:0",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "320k",
      "-ar",
      "44100",
      "-ac",
      "2",
      ...metadataArgs,
      "-f",
      "mp3",
      audioMp3Name,
    ]);

    /*
     * Remove the original M4A/AAC bytes before artwork muxing.
     * This reduces peak memory usage on Android/mobile browsers.
     */
    await ffDelete(ff, inputName);

    /*
     * No artwork: the first-pass MP3 is already the final file.
     */
    if (!coverData?.length) {
      const output = await ff.readFile(
        audioMp3Name
      );

      const result = new Uint8Array(output);
      await ffDelete(ff, audioMp3Name);

      return result;
    }

    /*
     * PASS 2
     * Attach album artwork without re-encoding the MP3 audio.
     */
    await ff.writeFile(
      coverName,
      bytesFromBuffer(coverData)
    );

    try {
      await ff.exec([
        "-y",
        "-i",
        audioMp3Name,
        "-i",
        coverName,
        "-map",
        "0:a:0",
        "-map",
        "1:v:0",
        "-c:a",
        "copy",
        "-c:v",
        "mjpeg",
        "-disposition:v:0",
        "attached_pic",
        "-map_metadata",
        "0",
        "-id3v2_version",
        "3",
        "-write_id3v1",
        "1",
        "-metadata:s:v:0",
        "title=Album cover",
        "-metadata:s:v:0",
        "comment=Cover (front)",
        "-f",
        "mp3",
        outputName,
      ]);

      const output = await ff.readFile(
        outputName
      );

      const result = new Uint8Array(output);

      await ffDelete(ff, audioMp3Name);
      await ffDelete(ff, coverName);
      await ffDelete(ff, outputName);

      return result;
    } catch (coverError) {
      /*
       * Mobile fallback:
       * artwork failed, but audio-320.mp3 is already valid.
       */
      console.warn(
        "Artwork muxing failed; returning valid 320 kbps MP3 without artwork:",
        coverError
      );

      const output = await ff.readFile(
        audioMp3Name
      );

      const result = new Uint8Array(output);

      await ffDelete(ff, audioMp3Name);
      await ffDelete(ff, coverName);
      await ffDelete(ff, outputName);

      return result;
    }
  } catch (error) {
    await ffDelete(ff, inputName);
    await ffDelete(ff, audioMp3Name);
    await ffDelete(ff, coverName);
    await ffDelete(ff, outputName);
    throw error;
  }
};

/* =========================================================
   DOWNLOAD FORMATTERS
========================================================= */

const formatDownloadSize = (bytes) => {
  const value = Number(bytes) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  const units = [
    "KB",
    "MB",
    "GB",
  ];

  let size = value / 1024;
  let index = 0;

  while (
    size >= 1024 &&
    index < units.length - 1
  ) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(
    size >= 100 ? 0 : 1
  )} ${units[index]}`;
};

const formatDownloadClock = (seconds) => {
  const value = Math.max(
    0,
    Math.floor(
      Number(seconds) || 0
    )
  );

  const minutes = Math.floor(
    value / 60
  );

  const remaining =
    value % 60;

  if (minutes >= 60) {
    const hours = Math.floor(
      minutes / 60
    );

    const mins =
      minutes % 60;

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(mins).padStart(
      2,
      "0"
    )}:${String(remaining).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(remaining).padStart(
    2,
    "0"
  )}`;
};

/* =========================================================
   SAFE DECODE
========================================================= */

const safeDecode = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  try {
    return he.decode(String(value));
  } catch {
    return String(value);
  }
};

/* =========================================================
   RESOLVE IMAGE
========================================================= */

const resolveImage = (value) => {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (
      let index = value.length - 1;
      index >= 0;
      index -= 1
    ) {
      const item = value[index];

      if (
        typeof item === "string" &&
        item.trim()
      ) {
        return item.trim();
      }

      if (
        item &&
        typeof item === "object"
      ) {
        const url =
          item.url ||
          item.link ||
          item.src;

        if (
          typeof url === "string" &&
          url.trim()
        ) {
          return url.trim();
        }
      }
    }
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const url =
      value.url ||
      value.link ||
      value.src;

    if (
      typeof url === "string" &&
      url.trim()
    ) {
      return url.trim();
    }
  }

  return "";
};

/* =========================================================
   GET IMAGE
========================================================= */

const getImage = (
  song,
  coverImage
) => {
  const contextImage =
    resolveImage(coverImage);

  if (contextImage) {
    return contextImage;
  }

  const songImage =
    resolveImage(song?.image);

  if (songImage) {
    return songImage;
  }

  const albumImage =
    resolveImage(
      song?.album?.image
    );

  if (albumImage) {
    return albumImage;
  }

  return FALLBACK_IMAGE;
};

/* =========================================================
   SONG ID
========================================================= */

const getSongId = (song) => {
  return (
    song?.id ||
    song?.songId ||
    song?.song_id ||
    song?.trackId ||
    null
  );
};

/* =========================================================
   LYRIC TIME
========================================================= */

const getLyricTime = (line) => {
  const rawTime = Number(
    line?.time ??
      line?.startTime ??
      line?.start ??
      0
  );

  if (!Number.isFinite(rawTime)) {
    return null;
  }

  return rawTime > 10000
    ? rawTime / 1000
    : rawTime;
};

/* =========================================================
   PLAYER
========================================================= */

const Player = () => {
  const musicContext =
    useContext(MusicContext);

  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    shuffle,
    nextSong,
    prevSong,
    toggleShuffle,
    repeatMode,
    toggleRepeatMode,
    lyrics,
    coverImage,
  } = musicContext || {};

  /* =======================================================
     THEME
  ======================================================= */

  const [themeVersion, setThemeVersion] =
    useState(0);

  const theme =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute(
          "data-theme"
        )
      : "light";

  const isDark =
    theme === "dark" ||
    theme === "black" ||
    theme === "night";

  useEffect(() => {
    if (
      typeof document === "undefined"
    ) {
      return undefined;
    }

    const root =
      document.documentElement;

    const observer =
      new MutationObserver(() => {
        setThemeVersion(
          (value) => value + 1
        );
      });

    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-theme",
      ],
    });

    return () =>
      observer.disconnect();
  }, []);

  void themeVersion;

  /* =======================================================
     STATE
  ======================================================= */

  const [isMaximized, setIsMaximized] =
    useState(false);

  const [showLyrics, setShowLyrics] =
    useState(false);

  const [currentTime, setCurrentTime] =
    useState(0);

  const [audioDuration, setAudioDuration] =
    useState(0);

  const [detail, setDetail] =
    useState(null);

  const [suggestions, setSuggestions] =
    useState([]);

  const [isDownloading, setIsDownloading] =
    useState(false);

  const [downloadProgress, setDownloadProgress] =
    useState(0);

  const [downloadBytes, setDownloadBytes] =
    useState(0);

  const [downloadTotalBytes, setDownloadTotalBytes] =
    useState(0);

  const [downloadElapsed, setDownloadElapsed] =
    useState(0);

  const [downloadEta, setDownloadEta] =
    useState(0);

  const [downloadStatus, setDownloadStatus] =
    useState("");

  const [downloadError, setDownloadError] =
    useState("");

  const downloadStartedAtRef =
    useRef(0);

  const downloadBytesRef =
    useRef(0);

  const downloadTotalBytesRef =
    useRef(0);

  /* =======================================================
     LIKED SONGS
  ======================================================= */

  const [likedSongs, setLikedSongs] =
    useState(() => {
      try {
        const stored =
          localStorage.getItem(
            "likedSongs"
          );

        const data =
          stored
            ? JSON.parse(stored)
            : [];

        return Array.isArray(data)
          ? data
          : [];
      } catch {
        return [];
      }
    });

  /* =======================================================
     REFS
  ======================================================= */

  const scrollRef =
    useRef(null);

  const lyricContainerRef =
    useRef(null);

  useEffect(() => {
    if (!isDownloading) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const started =
        downloadStartedAtRef.current;

      if (!started) {
        return;
      }

      const elapsed =
        Math.max(
          0,
          (Date.now() - started) / 1000
        );

      setDownloadElapsed(elapsed);

      const loaded =
        downloadBytesRef.current;

      const total =
        downloadTotalBytesRef.current;

      if (
        loaded > 0 &&
        total > loaded &&
        elapsed > 0
      ) {
        const speed =
          loaded / elapsed;

        setDownloadEta(
          speed > 0
            ? (total - loaded) / speed
            : 0
        );
      } else {
        setDownloadEta(0);
      }
    }, 500);

    return () =>
      window.clearInterval(timer);
  }, [isDownloading]);

  /* =======================================================
     AUDIO
  ======================================================= */

  const audio = useMemo(() => {
    const value =
      currentSong?.audio;

    if (
      value &&
      typeof value === "object" &&
      typeof value.play === "function" &&
      typeof value.pause === "function"
    ) {
      return value;
    }

    return null;
  }, [currentSong?.audio]);

  /* =======================================================
     SONG DATA
  ======================================================= */

  const songId =
    getSongId(currentSong);

  const duration =
    Number(currentSong?.duration) > 0
      ? Number(currentSong.duration)
      : audioDuration;

  const progress =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (currentTime /
              duration) *
              100
          )
        )
      : 0;

  /* =======================================================
     PROGRESS COLORS
  ======================================================= */

  const progressTrack =
    isDark
      ? "rgba(255,255,255,0.24)"
      : "rgba(0,0,0,0.20)";

  /* =======================================================
     ARTWORK
  ======================================================= */

  const artwork = useMemo(
    () =>
      getImage(
        currentSong,
        coverImage
      ),
    [
      currentSong,
      coverImage,
    ]
  );

  /* =======================================================
     SONG NAME
  ======================================================= */

  const songName = useMemo(() => {
    return safeDecode(
      currentSong?.name ||
        currentSong?.title ||
        "Unknown Song"
    );
  }, [
    currentSong?.name,
    currentSong?.title,
  ]);

  /* =======================================================
     ARTIST
  ======================================================= */

  const artistNames = useMemo(() => {
    const primary =
      currentSong?.artists
        ?.primary;

    if (
      Array.isArray(primary) &&
      primary.length > 0
    ) {
      return primary
        .map((artist) =>
          safeDecode(
            artist?.name ||
              "Unknown Artist"
          )
        )
        .join(", ");
    }

    return safeDecode(
      currentSong?.artists?.name ||
        currentSong?.artist ||
        "Unknown Artist"
    );
  }, [
    currentSong?.artists,
    currentSong?.artist,
  ]);

  /* =======================================================
     LIKE STATUS
  ======================================================= */

  const isLiked =
    likedSongs.some(
      (item) =>
        String(item?.id) ===
        String(
          currentSong?.id
        )
    );

  /* =======================================================
     ACTIVE LYRIC
  ======================================================= */

  const activeLyricIndex =
    useMemo(() => {
      if (
        !lyrics?.synced ||
        !Array.isArray(
          lyrics?.lines
        ) ||
        lyrics.lines.length === 0
      ) {
        return -1;
      }

      let activeIndex = -1;

      lyrics.lines.forEach(
        (line, index) => {
          const lineTime =
            getLyricTime(line);

          if (
            lineTime !== null &&
            lineTime <= currentTime
          ) {
            activeIndex = index;
          }
        }
      );

      return activeIndex;
    }, [
      lyrics,
      currentTime,
    ]);

  /* =======================================================
     RESET SONG
  ======================================================= */

  useEffect(() => {
    setShowLyrics(false);
    setCurrentTime(0);
    setAudioDuration(0);

    if (
      lyricContainerRef.current
    ) {
      lyricContainerRef.current.scrollTo(
        {
          top: 0,
          behavior: "auto",
        }
      );
    }
  }, [songId]);

  /* =======================================================
     AUDIO VOLUME
  ======================================================= */

  useEffect(() => {
    if (!audio) {
      return;
    }

    try {
      audio.volume = 1;
      audio.muted = false;
    } catch {}
  }, [audio]);

  /* =======================================================
     AUDIO EVENTS
  ======================================================= */

  useEffect(() => {
    if (!audio) {
      setCurrentTime(0);
      setAudioDuration(0);
      return undefined;
    }

    const updateTime = () => {
      const time =
        Number(audio.currentTime);

      setCurrentTime(
        Number.isFinite(time)
          ? time
          : 0
      );

      const audioLength =
        Number(audio.duration);

      if (
        Number.isFinite(
          audioLength
        ) &&
        audioLength > 0
      ) {
        setAudioDuration(
          audioLength
        );
      }
    };

    const loaded = () => {
      const audioLength =
        Number(audio.duration);

      if (
        Number.isFinite(
          audioLength
        ) &&
        audioLength > 0
      ) {
        setAudioDuration(
          audioLength
        );
      }

      updateTime();

      try {
        audio.volume = 1;
        audio.muted = false;
      } catch {}
    };

    const ended = async () => {
      if (repeatMode === "one") {
        return;
      }

      try {
        await nextSong?.();
      } catch (error) {
        console.error(
          "Auto-play next song failed:",
          error
        );
      }
    };

    audio.addEventListener(
      "timeupdate",
      updateTime
    );

    audio.addEventListener(
      "loadedmetadata",
      loaded
    );

    audio.addEventListener(
      "durationchange",
      loaded
    );

    audio.addEventListener(
      "ended",
      ended
    );

    updateTime();

    return () => {
      audio.removeEventListener(
        "timeupdate",
        updateTime
      );

      audio.removeEventListener(
        "loadedmetadata",
        loaded
      );

      audio.removeEventListener(
        "durationchange",
        loaded
      );

      audio.removeEventListener(
        "ended",
        ended
      );
    };
  }, [
    audio,
    nextSong,
    repeatMode,
  ]);

  /* =======================================================
     REPEAT
  ======================================================= */

  useEffect(() => {
    if (!audio) {
      return;
    }

    try {
      audio.loop =
        repeatMode === "one";
    } catch {}
  }, [
    audio,
    repeatMode,
  ]);

  /* =======================================================
     FETCH SONG DETAILS
  ======================================================= */

  useEffect(() => {
    if (!songId) {
      setDetail(null);
      setSuggestions([]);
      return undefined;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        const [
          detailResult,
          suggestionResult,
        ] =
          await Promise.allSettled([
            getSongById(songId),
            getSuggestionSong(
              songId
            ),
          ]);

        if (cancelled) {
          return;
        }

        if (
          detailResult.status ===
          "fulfilled"
        ) {
          const result =
            detailResult.value;

          setDetail(
            result?.data?.[0] ||
              result?.data ||
              result ||
              null
          );
        } else {
          setDetail(null);
        }

        if (
          suggestionResult.status ===
          "fulfilled"
        ) {
          const result =
            suggestionResult.value;

          const data =
            Array.isArray(result)
              ? result
              : result?.data;

          setSuggestions(
            Array.isArray(data)
              ? data
              : []
          );
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error(
          "Player data error:",
          error
        );

        if (!cancelled) {
          setDetail(null);
          setSuggestions([]);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [songId]);

  /* =======================================================
     MEDIA SESSION
  ======================================================= */

  useEffect(() => {
    if (
      !currentSong ||
      typeof navigator ===
        "undefined" ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata ===
        "undefined"
    ) {
      return undefined;
    }

    try {
      navigator.mediaSession.metadata =
        new MediaMetadata({
          title: songName,
          artist: artistNames,
          album: safeDecode(
            detail?.album?.name ||
              "Dreamly5"
          ),
          artwork: artwork
            ? [
                {
                  src: artwork,
                  sizes:
                    "500x500",
                  type:
                    "image/jpeg",
                },
              ]
            : [],
        });

      navigator.mediaSession.setActionHandler(
        "play",
        () => {
          if (!audio) return;

          audio
            .play()
            .then(() => {
              setIsPlaying?.(
                true
              );
            })
            .catch(() => {});
        }
      );

      navigator.mediaSession.setActionHandler(
        "pause",
        () => {
          if (!audio) return;

          audio.pause();

          setIsPlaying?.(
            false
          );
        }
      );

      navigator.mediaSession.setActionHandler(
        "previoustrack",
        () => {
          prevSong?.();
        }
      );

      navigator.mediaSession.setActionHandler(
        "nexttrack",
        () => {
          nextSong?.();
        }
      );
    } catch (error) {
      console.warn(
        "Media Session error:",
        error
      );
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler(
          "play",
          null
        );

        navigator.mediaSession.setActionHandler(
          "pause",
          null
        );

        navigator.mediaSession.setActionHandler(
          "previoustrack",
          null
        );

        navigator.mediaSession.setActionHandler(
          "nexttrack",
          null
        );
      } catch {}
    };
  }, [
    currentSong,
    songName,
    artistNames,
    detail,
    artwork,
    audio,
    setIsPlaying,
    prevSong,
    nextSong,
  ]);

  /* =======================================================
     LYRIC AUTO SCROLL
  ======================================================= */

  useEffect(() => {
    if (
      !showLyrics ||
      activeLyricIndex < 0 ||
      !lyricContainerRef.current
    ) {
      return undefined;
    }

    const container =
      lyricContainerRef.current;

    const frame =
      requestAnimationFrame(() => {
        const activeElement =
          container.querySelector(
            `[data-lyric-index="${activeLyricIndex}"]`
          );

        if (!activeElement) {
          return;
        }

        const containerRect =
          container.getBoundingClientRect();

        const activeRect =
          activeElement.getBoundingClientRect();

        const relativeTop =
          activeRect.top -
          containerRect.top +
          container.scrollTop;

        const targetScroll =
          relativeTop -
          container.clientHeight /
            2 +
          activeElement.clientHeight /
            2;

        const maxScroll =
          container.scrollHeight -
          container.clientHeight;

        container.scrollTo({
          top: Math.max(
            0,
            Math.min(
              targetScroll,
              maxScroll
            )
          ),
          behavior: "smooth",
        });
      });

    return () =>
      cancelAnimationFrame(
        frame
      );
  }, [
    activeLyricIndex,
    showLyrics,
  ]);

  /* =======================================================
     PLAY / PAUSE
  ======================================================= */

  const playPause = async () => {
    if (!audio) {
      return;
    }

    try {
      if (audio.paused) {
        await audio.play();

        setIsPlaying?.(
          true
        );
      } else {
        audio.pause();

        setIsPlaying?.(
          false
        );
      }
    } catch (error) {
      console.error(
        "Play/pause error:",
        error
      );

      setIsPlaying?.(
        false
      );
    }
  };

  /* =======================================================
     SEEK
  ======================================================= */

  const seek = (event) => {
    if (
      !audio ||
      duration <= 0
    ) {
      return;
    }

    const value =
      Number(
        event.target.value
      );

    if (
      !Number.isFinite(value)
    ) {
      return;
    }

    const time =
      (value / 100) *
      duration;

    try {
      audio.currentTime =
        Math.max(
          0,
          Math.min(
            duration,
            time
          )
        );
    } catch {}

    setCurrentTime(time);
  };

  /* =======================================================
     FORMAT TIME
  ======================================================= */

  const formatTime = (
    value
  ) => {
    const seconds =
      Math.max(
        0,
        Math.floor(
          Number(value) || 0
        )
      );

    const minutes =
      Math.floor(
        seconds / 60
      );

    const remaining =
      seconds % 60;

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      remaining
    ).padStart(
      2,
      "0"
    )}`;
  };

  /* =======================================================
     LIKE
  ======================================================= */

  const toggleLike = () => {
    if (
      !currentSong?.id
    ) {
      return;
    }

    setLikedSongs(
      (oldSongs) => {
        const exists =
          oldSongs.some(
            (item) =>
              String(
                item?.id
              ) ===
              String(
                currentSong.id
              )
          );

        const nextSongs =
          exists
            ? oldSongs.filter(
                (item) =>
                  String(
                    item?.id
                  ) !==
                  String(
                    currentSong.id
                  )
              )
            : [
                ...oldSongs,
                {
                  id:
                    currentSong.id,
                  name:
                    currentSong.name,
                  duration:
                    currentSong.duration,
                  image:
                    currentSong.image,
                  artists:
                    currentSong.artists,
                  audio:
                    currentSong?.downloadUrl ||
                    currentSong?.audioUrl ||
                    currentSong?.audio_url ||
                    currentSong?.download_url ||
                    "",
                },
              ];

        try {
          localStorage.setItem(
            "likedSongs",
            JSON.stringify(
              nextSongs
            )
          );
        } catch {}

        return nextSongs;
      }
    );
  };

  /* =======================================================
     SHARE
  ======================================================= */

  const share = async () => {
    const albumId =
      detail?.album?.id ||
      currentSong?.album?.id;

    const url =
      albumId
        ? `${window.location.origin}/albums/${albumId}`
        : window.location.href;

    try {
      if (
        typeof navigator.share ===
        "function"
      ) {
        await navigator.share({
          title:
            songName,
          text: `Listen to ${songName} on Dreamly5`,
          url,
        });
      } else if (
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          url
        );

        alert(
          "Link copied"
        );
      }
    } catch (error) {
      if (
        error?.name !==
        "AbortError"
      ) {
        console.error(
          "Share failed:",
          error
        );
      }
    }
  };

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  const handleDownload = async () => {
    if (isDownloading) {
      return;
    }

    const isHttpUrl = (value) =>
      typeof value === "string" &&
      /^https?:\/\//i.test(value.trim());

    const isRelativeUrl = (value) =>
      typeof value === "string" &&
      value.trim().startsWith("/") &&
      !value.trim().startsWith("//");

    /*
     * Prefer the real song media URL.
     * Never send a temporary browser blob: URL to the server.
     */
    const getValidDownloadSource = () => {
      const candidates = [
        currentSong?.downloadUrl,
        currentSong?.audioUrl,
        currentSong?.download_url,
        currentSong?.audio_url,
        currentSong?.url,
        audio?.currentSrc,
        audio?.src,
      ];

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }

        const value = String(candidate).trim();

        if (!value || /^blob:/i.test(value)) {
          continue;
        }

        if (isHttpUrl(value)) {
          return value;
        }

        if (isRelativeUrl(value)) {
          try {
            return new URL(
              value,
              window.location.origin
            ).href;
          } catch {
            continue;
          }
        }
      }

      return "";
    };

    const url = getValidDownloadSource();

    if (!url) {
      setDownloadError(
        "Download URL is not available. Please play the song again and retry."
      );
      setDownloadStatus("Download failed");
      return;
    }

    const title = sanitizeMetadata(
      stripMediaExtensions(songName),
      "Unknown Song"
    );

    const artist = sanitizeMetadata(
      artistNames,
      "Unknown Artist"
    );

    const album = sanitizeMetadata(
      detail?.album?.name ||
        currentSong?.album?.name ||
        currentSong?.albumName ||
        "Unknown Album",
      "Unknown Album"
    );

    const albumArtist = sanitizeMetadata(
      detail?.album?.artists?.primary?.[0]?.name ||
        detail?.album?.artists?.all?.[0]?.name ||
        detail?.album?.artist?.name ||
        detail?.albumArtist ||
        currentSong?.album?.artist?.name ||
        currentSong?.albumArtist ||
        currentSong?.artists?.primary?.[0]?.name ||
        artist,
      artist
    );

    const year = sanitizeMetadata(
      detail?.year ||
        detail?.releaseDate?.slice?.(0, 4) ||
        currentSong?.year ||
        ""
    );

    const publisher = sanitizeMetadata(
      detail?.label ||
        detail?.publisher ||
        currentSong?.label ||
        currentSong?.publisher ||
        ""
    );

    const copyright = sanitizeMetadata(
      detail?.copyright ||
        currentSong?.copyright ||
        ""
    );

    const filename =
      `${safeFilename(title)} - ${safeFilename(artist)}.mp3`;

    const downloadBlob = (blob, name) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = name;
      link.rel = "noopener";
      link.style.display = "none";

      document.body.appendChild(link);

      try {
        link.click();
      } finally {
        link.remove();
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 5000);
    };

    const getDownloadResourceUrl = (resourceUrl) => {
      if (!resourceUrl) {
        throw new Error("Resource URL is empty.");
      }

      const value = String(resourceUrl).trim();

      if (!value) {
        throw new Error("Resource URL is empty.");
      }

      if (/^blob:/i.test(value)) {
        throw new Error(
          "Temporary browser Blob URL cannot be downloaded from the server."
        );
      }

      let parsed;

      try {
        parsed = new URL(
          value,
          window.location.href
        );
      } catch {
        throw new Error("Invalid media URL.");
      }

      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
      ) {
        throw new Error(
          `Unsupported media URL protocol: ${parsed.protocol}`
        );
      }

      if (
        parsed.origin === window.location.origin
      ) {
        return parsed.href;
      }

      return `/api/download?url=${encodeURIComponent(
        parsed.href
      )}`;
    };

    const readResponseError = async (response) => {
      try {
        const contentType =
          response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const json = await response.json();
          return json?.error || json?.message || "";
        }

        if (contentType.includes("text/")) {
          const text = await response.text();
          return text
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);
        }
      } catch {
        // Ignore response parsing errors.
      }

      return "";
    };

    const fetchBytes = async (resourceUrl, statusText) => {
      if (!resourceUrl) {
        throw new Error("Resource URL is empty.");
      }

      setDownloadStatus(statusText);
      setDownloadProgress(0);
      setDownloadBytes(0);
      setDownloadTotalBytes(0);
      setDownloadEta(0);

      const proxyUrl =
        getDownloadResourceUrl(resourceUrl);

      const response = await fetch(proxyUrl, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "follow",
      });

      if (!response.ok) {
        const serverError =
          await readResponseError(response);

        throw new Error(
          serverError
            ? `Download server error ${response.status}: ${serverError}`
            : `Download server error ${response.status}`
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      /* Never send HTML/JSON error pages into FFmpeg. */
      if (
        /text\/html/i.test(contentType) ||
        /application\/json/i.test(contentType)
      ) {
        const details =
          await readResponseError(response);

        throw new Error(
          details
            ? `Server returned ${contentType}: ${details}`
            : `Server returned ${contentType} instead of media.`
        );
      }

      const total =
        Number(
          response.headers.get("content-length")
        ) || 0;

      downloadBytesRef.current = 0;
      downloadTotalBytesRef.current = total;
      setDownloadTotalBytes(total);

      if (
        !response.body ||
        typeof response.body.getReader !== "function"
      ) {
        const buffer = new Uint8Array(
          await response.arrayBuffer()
        );

        if (!buffer.byteLength) {
          throw new Error("Downloaded media is empty.");
        }

        downloadBytesRef.current = buffer.byteLength;
        setDownloadBytes(buffer.byteLength);
        setDownloadProgress(100);

        return buffer;
      }

      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!value?.length) {
          continue;
        }

        chunks.push(value);
        loaded += value.length;

        downloadBytesRef.current = loaded;
        setDownloadBytes(loaded);

        setDownloadProgress(
          total > 0
            ? Math.min(100, (loaded / total) * 100)
            : 0
        );
      }

      if (!loaded) {
        throw new Error("Downloaded media is empty.");
      }

      const result = new Uint8Array(loaded);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      setDownloadBytes(loaded);
      setDownloadProgress(100);

      return result;
    };

    const setStage = (status, progress) => {
      setDownloadStatus(status);
      setDownloadProgress(
        Math.max(
          0,
          Math.min(100, Number(progress) || 0)
        )
      );
    };

    setDownloadError("");
    setDownloadProgress(0);
    setDownloadBytes(0);
    setDownloadTotalBytes(0);
    setDownloadElapsed(0);
    setDownloadEta(0);
    setDownloadStatus("Starting download...");

    downloadStartedAtRef.current = Date.now();
    downloadBytesRef.current = 0;
    downloadTotalBytesRef.current = 0;

    setIsDownloading(true);

    try {
      const audioData = await fetchBytes(
        url,
        "Downloading audio..."
      );

      let coverData = null;

      if (
        artwork &&
        artwork !== FALLBACK_IMAGE
      ) {
        try {
          coverData = await fetchBytes(
            artwork,
            "Downloading artwork..."
          );
        } catch (coverError) {
          console.warn(
            "Cover download failed. Continuing without artwork:",
            coverError
          );

          coverData = null;
          setDownloadStatus(
            "Artwork unavailable — continuing..."
          );
        }
      }

      setStage(
        "Preparing 320 kbps MP3...",
        0
      );

      const ff = await getFFmpeg();

      const onFfmpegProgress = ({ progress: ffProgress }) => {
        const percent = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (Number(ffProgress) || 0) * 100
            )
          )
        );

        setDownloadStatus(
          `Converting to 320 kbps MP3... ${percent}%`
        );
        setDownloadProgress(percent);
      };

      ff.on("progress", onFfmpegProgress);

      let taggedData;

      try {
        taggedData = await embedWithCover(
          ff,
          audioData,
          coverData,
          {
            title,
            artist,
            albumArtist,
            album,
            year,
            publisher,
            copyright,
          }
        );
      } finally {
        try {
          ff.off("progress", onFfmpegProgress);
        } catch {
          // Ignore listener cleanup errors.
        }
      }

      if (!taggedData?.length) {
        throw new Error(
          "FFmpeg returned an empty MP3."
        );
      }

      setStage("Finalizing download...", 100);

      await new Promise((resolve) =>
        window.setTimeout(resolve, 150)
      );

      downloadBlob(
        new Blob([taggedData], {
          type: "audio/mpeg",
        }),
        filename
      );

      /* Completed downloads do not keep the notification visible. */
      setDownloadProgress(100);
      setDownloadEta(0);
      setDownloadStatus("");
      setDownloadError("");
    } catch (error) {
      console.error(
        "MP3 download/conversion failed:",
        error
      );

      const message = String(
        error?.message || ""
      );

      let userMessage =
        "MP3 conversion failed. Please try the download again.";

      if (/blob|temporary browser/i.test(message)) {
        userMessage =
          "The temporary audio URL expired. Please play the song again and retry.";
      } else if (/403|forbidden|host is not allowed/i.test(message)) {
        userMessage =
          "The download server rejected this media source.";
      } else if (/404|not found/i.test(message)) {
        userMessage =
          "The audio file is no longer available. Please try playing the song again.";
      } else if (/content-type|html|json|server returned/i.test(message)) {
        userMessage =
          "The download server returned an invalid media response.";
      } else if (/network|failed to fetch|fetch/i.test(message)) {
        userMessage =
          "Network error while downloading the song. Please try again.";
      } else if (/memory|allocation|out of memory/i.test(message)) {
        userMessage =
          "This song is too large to convert to 320 kbps MP3 in this mobile browser.";
      } else if (message) {
        userMessage =
          message.length > 220
            ? `${message.slice(0, 220)}...`
            : message;
      }

      setDownloadError(userMessage);
      setDownloadStatus("Download failed");
      setDownloadEta(0);
    } finally {
      setIsDownloading(false);
    }
  };

  /* =======================================================
     NO SONG
  ======================================================= */

  if (!currentSong) {
    return null;
  }

  const suggestionList =
    Array.isArray(
      suggestions
    )
      ? suggestions
      : [];

  const hasSyncedLyrics =
    Boolean(
      lyrics?.synced &&
        Array.isArray(
          lyrics?.lines
        ) &&
        lyrics.lines.length
    );

  /* =======================================================
     THEME CLASSES
  ======================================================= */

  const panelClass =
    isDark
      ? "bg-black/75 border-white/10 text-white"
      : "bg-white/85 border-black/10 text-gray-900";

  const softPanelClass =
    isDark
      ? "bg-white/5 border-white/10"
      : "bg-black/5 border-black/10";

  const mutedTextClass =
    isDark
      ? "text-white/55"
      : "text-black/55";

  const iconMutedClass =
    isDark
      ? "text-white/70 hover:text-white"
      : "text-black/65 hover:text-black";

  /* =======================================================
     PROGRESS STYLE
  ======================================================= */

  const progressStyle = {
    "--progress": `${progress}%`,
    "--progress-track":
      progressTrack,
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      className="
        fixed
        bottom-14
        left-0
        z-50
        w-full
        lg:bottom-0
      "
    >
      {isDownloading && (
        <div
          className={`
            mx-auto
            mb-2
            w-[calc(100%-1rem)]
            max-w-2xl
            overflow-hidden
            rounded-2xl
            border
            p-3
            shadow-2xl
            backdrop-blur-2xl
            ${
              isDark
                ? "border-white/10 bg-black/85 text-white"
                : "border-black/10 bg-white/95 text-black"
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div
              className={`
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-full
                ${
                  downloadStatus ===
                  "Download failed"
                    ? "bg-red-500/15 text-red-500"
                    : downloadStatus ===
                        "Download complete"
                      ? "bg-green-500/15 text-green-500"
                      : "bg-red-500/15 text-red-500"
                }
              `}
            >
              <MdDownload
                className={`
                  text-xl
                  ${
                    isDownloading
                      ? "animate-bounce"
                      : ""
                  }
                `}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  {downloadStatus || "Downloading..."}
                </p>

                <span className="shrink-0 text-xs font-bold tabular-nums">
                  {Math.round(downloadProgress)}%
                </span>
              </div>

              <div
                className={`
                  mt-1
                  flex
                  items-center
                  justify-between
                  gap-2
                  text-xs
                  font-medium
                  ${
                    isDark
                      ? "text-white/70"
                      : "text-black/65"
                  }
                `}
              >
                <span className="truncate">
                  Downloaded: {formatDownloadSize(downloadBytes)} / {downloadTotalBytes ? formatDownloadSize(downloadTotalBytes) : "--"}
                </span>

                {downloadElapsed > 0 && (
                  <span className="shrink-0 tabular-nums">
                    {formatDownloadClock(downloadElapsed)}
                  </span>
                )}
              </div>

              <div
                className={`
                  mt-2
                  h-1.5
                  overflow-hidden
                  rounded-full
                  ${
                    isDark
                      ? "bg-white/10"
                      : "bg-black/10"
                  }
                `}
              >
                <div
                  className={`
                    h-full
                    rounded-full
                    bg-red-500
                    transition-[width]
                    duration-200
                    ${
                      isDownloading
                        ? "animate-pulse"
                        : ""
                    }
                  `}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        downloadProgress
                      )
                    )}%`,
                  }}
                />
              </div>

              {isDownloading && downloadEta > 0 && (
                <div
                  className={`
                    mt-1.5
                    text-[11px]
                    ${
                      isDark
                        ? "text-white/55"
                        : "text-black/55"
                    }
                  `}
                >
                  ETA {formatDownloadClock(downloadEta)}
                </div>
              )}

              {downloadError && (
                <p className="mt-1 text-[11px] text-red-500">
                  {downloadError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`
          relative
          w-full
          overflow-hidden
          rounded-t-3xl
          border-t
          shadow-[0_-20px_80px_rgba(0,0,0,0.35)]
          backdrop-blur-3xl
          ${panelClass}
          ${
            isMaximized
              ? "h-[92vh]"
              : ""
          }
        `}
      >
        {/* =================================================
            BACKGROUND
        ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            overflow-hidden
          "
        >
          <img
            src={
              artwork ||
              FALLBACK_IMAGE
            }
            alt=""
            aria-hidden="true"
            className="
              absolute
              inset-0
              h-full
              w-full
              scale-125
              object-cover
              opacity-35
              blur-3xl
            "
            onError={(event) => {
              event.currentTarget.src =
                FALLBACK_IMAGE;
            }}
          />

          <div
            className={`
              absolute
              inset-0
              backdrop-blur-2xl
              ${
                isDark
                  ? "bg-black/70"
                  : "bg-white/70"
              }
            `}
          />
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div
          className={`
            relative
            z-10
            ${
              isMaximized
                ? "h-full overflow-y-auto px-3 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28"
                : "p-3 lg:px-6"
            }
          `}
        >
          {/* =================================================
              MINI PLAYER
          ================================================= */}

          {!isMaximized ? (
            <div
              className="
                flex
                w-full
                items-center
                gap-3
              "
            >
              <img
                src={
                  artwork ||
                  FALLBACK_IMAGE
                }
                alt={songName}
                className="
                  h-12
                  w-12
                  shrink-0
                  rounded-xl
                  object-cover
                  shadow-xl
                "
                onError={(event) => {
                  event.currentTarget.src =
                    FALLBACK_IMAGE;
                }}
              />

              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <div
                  className="
                    truncate
                    text-sm
                    font-semibold
                  "
                >
                  {songName}
                </div>

                <div
                  className={`
                    truncate
                    text-xs
                    ${mutedTextClass}
                  `}
                >
                  {artistNames}
                </div>

                <div
                  className="
                    mt-1
                    flex
                    items-center
                    gap-2
                  "
                >
                  <span className="text-[10px] opacity-60">
                    {formatTime(
                      currentTime
                    )}
                  </span>

                  <input
                    aria-label="Song progress"
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={progress}
                    onChange={seek}
                    className="
                      music-progress
                      flex-1
                    "
                    style={
                      progressStyle
                    }
                  />

                  <span className="text-[10px] opacity-60">
                    {formatTime(
                      duration
                    )}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  prevSong?.()
                }
                title="Previous"
                className={`
                  hidden
                  rounded-full
                  p-2
                  transition
                  hover:bg-white/10
                  sm:block
                  ${iconMutedClass}
                `}
              >
                <IoMdSkipBackward className="text-2xl" />
              </button>

              <button
                type="button"
                onClick={
                  playPause
                }
                title={
                  isPlaying
                    ? "Pause"
                    : "Play"
                }
                className="
                  shrink-0
                  rounded-full
                  bg-white
                  p-2.5
                  text-black
                  shadow-xl
                  transition
                  hover:scale-105
                "
              >
                {isPlaying ? (
                  <FaPause />
                ) : (
                  <FaPlay className="ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  nextSong?.()
                }
                title="Next"
                className={`
                  hidden
                  rounded-full
                  p-2
                  transition
                  hover:bg-white/10
                  sm:block
                  ${iconMutedClass}
                `}
              >
                <IoMdSkipForward className="text-2xl" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setIsMaximized(
                    true
                  )
                }
                title="Open full player"
                aria-label="Open full player"
                className={`
                  shrink-0
                  rounded-full
                  p-2
                  transition
                  hover:bg-white/10
                  ${iconMutedClass}
                `}
              >
                <CiMaximize1 className="text-xl" />
              </button>
            </div>
          ) : (
            /* =================================================
               FULL PLAYER
            ================================================= */

            <div
              className="
                mx-auto
                flex
                min-h-full
                w-full
                max-w-5xl
                flex-col
                items-center
              "
            >
              {/* =================================================
                  CLOSE
              ================================================= */}

              <button
                type="button"
                onClick={() => {
                  setIsMaximized(false);
                  setShowLyrics(false);
                }}
                title="Close player"
                aria-label="Close player"
                className={`
                  absolute
                  right-3
                  top-14
                  z-[100]
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  border
                  backdrop-blur-xl
                  transition-all
                  duration-200
                  hover:scale-105
                  hover:bg-red-500
                  hover:text-white
                  active:scale-95
                  sm:right-5
                  sm:top-16
                  ${softPanelClass}
                `}
              >
                <IoIosClose className="text-4xl" />
              </button>

              {/* =================================================
                  COVER / LYRICS
              ================================================= */}

              {!showLyrics ? (
                <div
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    py-5
                    sm:py-7
                    md:py-8
                  "
                >
                  <div className="relative">
                    <div
                      className="
                        pointer-events-none
                        absolute
                        inset-0
                        scale-90
                        rounded-[2rem]
                        bg-red-500/20
                        blur-3xl
                      "
                    />

                    <img
                      src={
                        artwork ||
                        FALLBACK_IMAGE
                      }
                      alt={songName}
                      className="
                        relative
                        block
                        h-[220px]
                        w-[220px]
                        rounded-[1.5rem]
                        object-cover
                        shadow-[0_25px_80px_rgba(0,0,0,0.55)]
                        ring-1
                        ring-white/10
                        sm:h-[260px]
                        sm:w-[260px]
                        md:h-[300px]
                        md:w-[300px]
                        lg:h-[320px]
                        lg:w-[320px]
                      "
                      onError={(event) => {
                        event.currentTarget.src =
                          FALLBACK_IMAGE;
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  ref={
                    lyricContainerRef
                  }
                  className={`
                    mt-5
                    h-[45vh]
                    min-h-[280px]
                    w-full
                    max-w-3xl
                    overflow-x-hidden
                    overflow-y-auto
                    rounded-3xl
                    border
                    px-3
                    py-8
                    backdrop-blur-xl
                    sm:h-[48vh]
                    sm:px-6
                    ${softPanelClass}
                  `}
                >
                  {hasSyncedLyrics ? (
                    <div
                      className="
                        flex
                        min-h-full
                        flex-col
                        gap-2
                        pb-[25vh]
                        pt-[18vh]
                      "
                    >
                      {lyrics.lines.map(
                        (
                          line,
                          index
                        ) => {
                          const isActive =
                            index ===
                            activeLyricIndex;

                          return (
                            <p
                              key={`${getLyricTime(
                                line
                              )}-${index}`}
                              data-lyric-index={
                                index
                              }
                              className={`
                                mx-auto
                                w-full
                                max-w-2xl
                                rounded-2xl
                                px-4
                                py-3
                                text-center
                                text-sm
                                leading-7
                                transition-all
                                duration-500
                                ${
                                  isActive
                                    ? "scale-[1.03] bg-red-400/20 font-bold text-red-500 shadow-lg ring-1 ring-red-400/20 sm:text-base"
                                    : "opacity-35 hover:opacity-70"
                                }
                              `}
                            >
                              {safeDecode(
                                line?.text ||
                                  ""
                              )}
                            </p>
                          );
                        }
                      )}
                    </div>
                  ) : lyrics?.plain ? (
                    <div
                      className="
                        flex
                        min-h-full
                        items-center
                        justify-center
                        px-4
                      "
                    >
                      <p
                        className="
                          whitespace-pre-line
                          text-center
                          text-sm
                          leading-7
                          opacity-70
                        "
                      >
                        {safeDecode(
                          lyrics.plain
                        )}
                      </p>
                    </div>
                  ) : (
                    <div
                      className="
                        flex
                        min-h-full
                        items-center
                        justify-center
                      "
                    >
                      <p className="opacity-50">
                        No lyrics available.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* =================================================
                  SONG INFO
              ================================================= */}

              <div
                className="
                  mt-3
                  w-full
                  text-center
                "
              >
                <h2
                  className="
                    truncate
                    text-xl
                    font-bold
                    sm:text-2xl
                  "
                >
                  {songName}
                </h2>

                <p
                  className={`
                    mt-1
                    truncate
                    text-sm
                    ${mutedTextClass}
                  `}
                >
                  {artistNames}
                </p>
              </div>

              {/* =================================================
                  PROGRESS
              ================================================= */}

              <div
                className="
                  mt-5
                  flex
                  w-full
                  items-center
                  gap-2
                "
              >
                <span className="w-10 text-[11px] opacity-50">
                  {formatTime(
                    currentTime
                  )}
                </span>

                <input
                  aria-label="Song progress"
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={progress}
                  onChange={seek}
                  className="
                    music-progress
                    flex-1
                  "
                  style={
                    progressStyle
                  }
                />

                <span className="w-10 text-right text-[11px] opacity-50">
                  {formatTime(
                    duration
                  )}
                </span>
              </div>

              {/* =================================================
                  PLAYBACK CONTROLS
              ================================================= */}

              <div
                className="
                  mt-5
                  flex
                  items-center
                  justify-center
                  gap-4
                  sm:gap-7
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleShuffle?.()
                  }
                  title="Shuffle"
                  aria-label="Toggle shuffle"
                  className={`
                    rounded-full
                    p-2
                    transition
                    hover:bg-white/10
                    ${
                      shuffle
                        ? "text-red-500"
                        : "opacity-60 hover:opacity-100"
                    }
                  `}
                >
                  <PiShuffleBold className="text-xl sm:text-2xl" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    prevSong?.()
                  }
                  title="Previous"
                  aria-label="Previous song"
                  className="
                    rounded-full
                    p-2
                    opacity-80
                    transition
                    hover:bg-white/10
                    hover:opacity-100
                  "
                >
                  <IoMdSkipBackward className="text-2xl sm:text-3xl" />
                </button>

                <button
                  type="button"
                  onClick={
                    playPause
                  }
                  title={
                    isPlaying
                      ? "Pause"
                      : "Play"
                  }
                  aria-label={
                    isPlaying
                      ? "Pause"
                      : "Play"
                  }
                  className="
                    rounded-full
                    bg-white
                    p-4
                    text-black
                    shadow-[0_12px_50px_rgba(255,255,255,0.25)]
                    transition
                    hover:scale-105
                    active:scale-95
                    sm:p-5
                  "
                >
                  {isPlaying ? (
                    <FaPause className="text-xl sm:text-2xl" />
                  ) : (
                    <FaPlay className="ml-0.5 text-xl sm:text-2xl" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    nextSong?.()
                  }
                  title="Next"
                  aria-label="Next song"
                  className="
                    rounded-full
                    p-2
                    opacity-80
                    transition
                    hover:bg-white/10
                    hover:opacity-100
                  "
                >
                  <IoMdSkipForward className="text-2xl sm:text-3xl" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleRepeatMode?.()
                  }
                  title="Repeat"
                  aria-label="Toggle repeat"
                  className={`
                    rounded-full
                    p-2
                    transition
                    hover:bg-white/10
                    ${
                      repeatMode ===
                      "one"
                        ? "text-red-500"
                        : "opacity-60 hover:opacity-100"
                    }
                  `}
                >
                  {repeatMode ===
                  "one" ? (
                    <LuRepeat1 className="text-xl sm:text-2xl" />
                  ) : (
                    <LuRepeat className="text-xl sm:text-2xl" />
                  )}
                </button>
              </div>

              {/* =================================================
                  ACTION BAR
              ================================================= */}

              <div
                className="
                  mt-5
                  flex
                  max-w-full
                  flex-wrap
                  items-center
                  justify-center
                  gap-1.5
                  rounded-full
                  border
                  p-1.5
                  shadow-2xl
                  backdrop-blur-2xl
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowLyrics(
                      false
                    )
                  }
                  title="Show Cover"
                  aria-label="Show cover"
                  className={`
                    rounded-full
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    transition-all
                    duration-300
                    ${
                      !showLyrics
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                        : "opacity-60 hover:bg-white/10 hover:opacity-100"
                    }
                  `}
                >
                  Cover
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowLyrics(
                      true
                    )
                  }
                  title="Show Lyrics"
                  aria-label="Show lyrics"
                  className={`
                    rounded-full
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    transition-all
                    duration-300
                    ${
                      showLyrics
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                        : "opacity-60 hover:bg-white/10 hover:opacity-100"
                    }
                  `}
                >
                  Lyrics
                </button>

                <div
                  className={`
                    mx-1
                    h-6
                    w-px
                    ${
                      isDark
                        ? "bg-white/15"
                        : "bg-black/15"
                    }
                  `}
                />

                <button
                  type="button"
                  onClick={
                    toggleLike
                  }
                  title={
                    isLiked
                      ? "Unlike"
                      : "Like"
                  }
                  aria-label={
                    isLiked
                      ? "Unlike song"
                      : "Like song"
                  }
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    transition-all
                    hover:scale-110
                    hover:bg-white/10
                  "
                >
                  {isLiked ? (
                    <FaHeart className="text-lg text-red-500" />
                  ) : (
                    <FaRegHeart className="text-lg opacity-75" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={share}
                  title="Share"
                  aria-label="Share song"
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    opacity-75
                    transition-all
                    hover:scale-110
                    hover:bg-white/10
                    hover:opacity-100
                  "
                >
                  <IoShareSocial className="text-lg" />
                </button>

                <button
                  type="button"
                  onClick={
                    handleDownload
                  }
                  disabled={
                    isDownloading
                  }
                  title={
                    isDownloading
                      ? `${Math.round(downloadProgress)}% downloaded`
                      : "Download"
                  }
                  aria-label={
                    isDownloading
                      ? `Downloading ${Math.round(downloadProgress)} percent`
                      : "Download song"
                  }
                  className={`
                    relative
                    flex
                    h-10
                    min-w-10
                    items-center
                    justify-center
                    gap-1
                    rounded-full
                    px-2
                    opacity-75
                    transition-all
                    hover:scale-110
                    hover:bg-white/10
                    hover:opacity-100
                    disabled:cursor-not-allowed
                    ${
                      isDownloading
                        ? "text-red-500"
                        : ""
                    }
                  `}
                >
                  <MdDownload
                    className={`
                      text-xl
                      ${
                        isDownloading
                          ? "animate-bounce"
                          : ""
                      }
                    `}
                  />

                  {isDownloading && (
                    <span className="text-[10px] font-bold tabular-nums">
                      {Math.round(
                        downloadProgress
                      )}%
                    </span>
                  )}
                </button>
              </div>

              {/* =================================================
                  ALBUM
              ================================================= */}

              {detail?.album?.id && (
                <Link
                  to={`/albums/${detail.album.id}`}
                  className="
                    mt-5
                    w-full
                    max-w-md
                  "
                >
                  <h3 className="mb-2 text-sm font-semibold opacity-80">
                    From Album
                  </h3>

                  <div
                    className={`
                      flex
                      items-center
                      gap-3
                      rounded-2xl
                      border
                      p-2
                      backdrop-blur-xl
                      transition
                      hover:bg-white/10
                      ${softPanelClass}
                    `}
                  >
                    <img
                      src={
                        resolveImage(
                          detail
                            .album
                            .image
                        ) ||
                        artwork ||
                        FALLBACK_IMAGE
                      }
                      alt=""
                      className="
                        h-14
                        w-14
                        rounded-xl
                        object-cover
                      "
                      onError={(event) => {
                        event.currentTarget.src =
                          FALLBACK_IMAGE;
                      }}
                    />

                    <span className="truncate text-sm font-medium">
                      {safeDecode(
                        detail
                          .album
                          .name
                      )}
                    </span>
                  </div>
                </Link>
              )}

              {/* =================================================
                  SUGGESTIONS
              ================================================= */}

              {suggestionList.length >
                0 && (
                <div
                  className="
                    mt-7
                    w-full
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                    "
                  >
                    <h3 className="font-semibold">
                      You Might Like
                    </h3>

                    <div
                      className="
                        hidden
                        gap-2
                        lg:flex
                      "
                    >
                      <button
                        type="button"
                        onClick={() =>
                          scrollRef.current?.scrollBy(
                            {
                              left: -500,
                              behavior:
                                "smooth",
                            }
                          )
                        }
                        className="
                          rounded-full
                          p-2
                          transition
                          hover:bg-white/10
                        "
                      >
                        <MdOutlineKeyboardArrowLeft className="text-2xl" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          scrollRef.current?.scrollBy(
                            {
                              left: 500,
                              behavior:
                                "smooth",
                            }
                          )
                        }
                        className="
                          rounded-full
                          p-2
                          transition
                          hover:bg-white/10
                        "
                      >
                        <MdOutlineKeyboardArrowRight className="text-2xl" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={
                      scrollRef
                    }
                    className="
                      mt-3
                      flex
                      gap-3
                      overflow-x-auto
                      pb-2
                    "
                  >
                    {suggestionList.map(
                      (
                        item,
                        index
                      ) => (
                        <SongGrid
                          key={
                            item?.id ||
                            index
                          }
                          song={item}
                          songs={suggestionList}
                        />
                      )
                    )}
                  </div>
                </div>
              )}

              {/* =================================================
                  ARTISTS
              ================================================= */}

              {Array.isArray(
                currentSong
                  ?.artists
                  ?.primary
              ) &&
                currentSong
                  .artists
                  .primary
                  .length >
                  0 && (
                  <div
                    className="
                      mt-7
                      w-full
                      pb-8
                    "
                  >
                    <h3 className="mb-3 font-semibold">
                      Artists
                    </h3>

                    <div
                      className="
                        flex
                        gap-4
                        overflow-x-auto
                        pb-2
                      "
                    >
                      {currentSong.artists.primary.map(
                        (
                          artist,
                          index
                        ) => (
                          <ArtistItems
                            key={
                              artist?.id ||
                              index
                            }
                            {...artist}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          CORRECTED MUSIC PROGRESS BAR
      ===================================================== */}

      <style>{`
        /* =====================================================
           RANGE CONTAINER

           IMPORTANT:
           The input is 12px tall while the visible track
           remains 4px. This gives the thumb a proper center.
        ===================================================== */

        .music-progress {
          appearance: none;
          -webkit-appearance: none;

          width: 100%;
          height: 12px;

          margin: 0;
          padding: 0;

          border: 0;
          outline: none;

          border-radius: 9999px;

          cursor: pointer;

          background: linear-gradient(
            to right,
            #ef4444 0%,
            #ef4444 var(--progress, 0%),
            var(
              --progress-track,
              rgba(0, 0, 0, 0.20)
            )
              var(--progress, 0%),
            var(
              --progress-track,
              rgba(0, 0, 0, 0.20)
            )
              100%
          );

          transition:
            background 0.15s ease;
        }

        /* =====================================================
           CHROME / EDGE / SAFARI TRACK
        ===================================================== */

        .music-progress::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;

          border: 0;
          border-radius: 9999px;

          background: transparent;
        }

        /* =====================================================
           CHROME / EDGE / SAFARI THUMB

           12px thumb
           4px track

           margin-top: -4px centers:

           (12px - 4px) / 2 = 4px
        ===================================================== */

        .music-progress::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;

          width: 12px;
          height: 12px;

          margin-top: -4px;

          padding: 0;

          border-radius: 50%;

          border: 2px solid #ffffff;

          background: #ef4444;

          cursor: pointer;

          box-sizing: border-box;

          box-shadow:
            0 1px 5px
            rgba(0, 0, 0, 0.30);

          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .music-progress::-webkit-slider-thumb:hover {
          transform: scale(1.2);

          box-shadow:
            0 2px 8px
            rgba(239, 68, 68, 0.45);
        }

        .music-progress::-webkit-slider-thumb:active {
          transform: scale(1.08);
        }

        /* =====================================================
           FIREFOX TRACK
        ===================================================== */

        .music-progress::-moz-range-track {
          width: 100%;
          height: 4px;

          border: 0;
          border-radius: 9999px;

          background: var(
            --progress-track,
            rgba(0, 0, 0, 0.20)
          );
        }

        /* =====================================================
           FIREFOX FILLED TRACK
        ===================================================== */

        .music-progress::-moz-range-progress {
          height: 4px;

          border: 0;
          border-radius: 9999px;

          background: #ef4444;
        }

        /* =====================================================
           FIREFOX THUMB
        ===================================================== */

        .music-progress::-moz-range-thumb {
          width: 12px;
          height: 12px;

          padding: 0;

          border-radius: 50%;

          border: 2px solid #ffffff;

          background: #ef4444;

          cursor: pointer;

          box-sizing: border-box;

          box-shadow:
            0 1px 5px
            rgba(0, 0, 0, 0.30);

          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .music-progress::-moz-range-thumb:hover {
          transform: scale(1.2);

          box-shadow:
            0 2px 8px
            rgba(239, 68, 68, 0.45);
        }

        .music-progress::-moz-range-thumb:active {
          transform: scale(1.08);
        }

        /* =====================================================
           FOCUS
        ===================================================== */

        .music-progress:focus-visible {
          outline: 2px solid
            rgba(239, 68, 68, 0.45);

          outline-offset: 3px;
        }

        /* =====================================================
           MOBILE TOUCH TARGET

           The visible line stays 4px, but the clickable
           area is 12px high, making it easier to seek.
        ===================================================== */

        @media (max-width: 640px) {
          .music-progress {
            height: 12px;
          }

          .music-progress::-webkit-slider-runnable-track {
            height: 4px;
          }

          .music-progress::-webkit-slider-thumb {
            width: 12px;
            height: 12px;
            margin-top: -4px;
          }

          .music-progress::-moz-range-track {
            height: 4px;
          }

          .music-progress::-moz-range-progress {
            height: 4px;
          }

          .music-progress::-moz-range-thumb {
            width: 12px;
            height: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default Player;
