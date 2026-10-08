import { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FaHeart, FaRegHeart, FaPlay } from "react-icons/fa6";

import Navbar from "../components/Navbar";
import Footer from "../components/footer";
import SongsList from "../components/SongsList";
import Navigator from "../components/Navigator";

import MusicContext from "../context/MusicContext";
import { fetchplaylistsByID } from "../../fetch";

const DEFAULT_IMAGE = "/default-image.png";

const PlaylistDetails = () => {
  const { id } = useParams();

  const musicContext = useContext(MusicContext);
  const playMusic = musicContext?.playMusic;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * ==========================================
   * LIKED PLAYLISTS
   * ==========================================
   */

  const [likedPlaylists, setLikedPlaylists] = useState(() => {
    try {
      const savedPlaylists =
        localStorage.getItem("likedPlaylists");

      if (!savedPlaylists) {
        return [];
      }

      const parsedPlaylists =
        JSON.parse(savedPlaylists);

      return Array.isArray(parsedPlaylists)
        ? parsedPlaylists
        : [];
    } catch (err) {
      console.error(
        "Error reading likedPlaylists:",
        err
      );

      return [];
    }
  });

  /*
   * ==========================================
   * FETCH PLAYLIST DETAILS
   * ==========================================
   */

  useEffect(() => {
    let isMounted = true;

    const loadPlaylist = async () => {
      if (!id) {
        setError("Playlist ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await fetchplaylistsByID(id);

        console.log(
          "Playlist API Response:",
          response
        );

        if (!response) {
          throw new Error(
            "Empty API response."
          );
        }

        if (!isMounted) {
          return;
        }

        /*
         * Support multiple possible API formats.
         *
         * Format 1:
         * response.data
         *
         * Format 2:
         * response.data.data
         *
         * Format 3:
         * response itself is playlist
         */

        let playlistData = response;

        if (
          response?.data &&
          typeof response.data === "object"
        ) {
          playlistData = response.data;
        }

        if (
          playlistData?.data &&
          typeof playlistData.data === "object"
        ) {
          playlistData = playlistData.data;
        }

        if (
          !playlistData ||
          typeof playlistData !== "object"
        ) {
          throw new Error(
            "Playlist data not found."
          );
        }

        setDetails(playlistData);
      } catch (err) {
        console.error(
          "Playlist Details Error:",
          err
        );

        if (isMounted) {
          setError(
            err?.message ||
              "Failed to fetch playlist details. Please try again later."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPlaylist();

    return () => {
      isMounted = false;
    };
  }, [id]);

  /*
   * ==========================================
   * SAVE LIKED PLAYLISTS
   * ==========================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        "likedPlaylists",
        JSON.stringify(likedPlaylists)
      );
    } catch (err) {
      console.error(
        "Error saving likedPlaylists:",
        err
      );
    }
  }, [likedPlaylists]);

  /*
   * ==========================================
   * NORMALIZE PLAYLIST DATA
   * ==========================================
   */

  const playlistData = useMemo(() => {
    if (!details) {
      return {};
    }

    /*
     * If fetch function returns:
     *
     * {
     *   data: {...}
     * }
     */

    if (
      details?.data &&
      typeof details.data === "object" &&
      !Array.isArray(details.data)
    ) {
      return details.data;
    }

    return details;
  }, [details]);

  /*
   * ==========================================
   * GET SONGS
   * ==========================================
   */

  const songs = useMemo(() => {
    if (!playlistData) {
      return [];
    }

    if (Array.isArray(playlistData.songs)) {
      return playlistData.songs;
    }

    if (Array.isArray(playlistData.song)) {
      return playlistData.song;
    }

    if (Array.isArray(playlistData.items)) {
      return playlistData.items;
    }

    if (
      Array.isArray(
        playlistData.tracks
      )
    ) {
      return playlistData.tracks;
    }

    return [];
  }, [playlistData]);

  /*
   * ==========================================
   * GET IMAGE URL
   * ==========================================
   */

  const getImageUrl = (image) => {
    if (!image) {
      return DEFAULT_IMAGE;
    }

    /*
     * String
     */

    if (typeof image === "string") {
      return image;
    }

    /*
     * Array
     */

    if (Array.isArray(image)) {
      const validImages = image
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (
            item &&
            typeof item === "object"
          ) {
            return (
              item.url ||
              item.link ||
              item.src ||
              null
            );
          }

          return null;
        })
        .filter(Boolean);

      if (validImages.length > 0) {
        /*
         * Last image is normally highest quality.
         */

        return validImages[
          validImages.length - 1
        ];
      }
    }

    /*
     * Object
     */

    if (
      typeof image === "object"
    ) {
      return (
        image.url ||
        image.link ||
        image.src ||
        DEFAULT_IMAGE
      );
    }

    return DEFAULT_IMAGE;
  };

  /*
   * ==========================================
   * PLAYLIST IMAGE
   * ==========================================
   */

  const playlistImage = getImageUrl(
    playlistData?.image
  );

  /*
   * ==========================================
   * SONG IMAGE
   * ==========================================
   */

  const getSongImage = (song) => {
    if (!song) {
      return DEFAULT_IMAGE;
    }

    return getImageUrl(song.image);
  };

  /*
   * ==========================================
   * AUDIO URL
   * ==========================================
   */

  const getAudioUrl = (song) => {
    if (!song) {
      return null;
    }

    /*
     * downloadUrl ARRAY
     *
     * Example:
     *
     * [
     *   { quality: "96kbps", url: "..." },
     *   { quality: "160kbps", url: "..." },
     *   { quality: "320kbps", url: "..." }
     * ]
     */

    if (
      Array.isArray(song.downloadUrl)
    ) {
      const urls = song.downloadUrl
        .map((item) => {
          if (
            typeof item === "string"
          ) {
            return item;
          }

          if (
            item &&
            typeof item === "object"
          ) {
            return (
              item.url ||
              item.link ||
              item.downloadUrl ||
              null
            );
          }

          return null;
        })
        .filter(
          (url) =>
            typeof url === "string" &&
            url.trim() !== ""
        );

      if (urls.length > 0) {
        /*
         * Use highest/last available quality.
         */

        return urls[
          urls.length - 1
        ];
      }
    }

    /*
     * downloadUrl STRING
     */

    if (
      typeof song.downloadUrl ===
      "string"
    ) {
      return song.downloadUrl;
    }

    /*
     * downloadUrl OBJECT
     */

    if (
      song.downloadUrl &&
      typeof song.downloadUrl ===
        "object"
    ) {
      return (
        song.downloadUrl.url ||
        song.downloadUrl.link ||
        null
      );
    }

    /*
     * Other possible API properties.
     */

    const possibleUrls = [
      song.audioUrl,
      song.audio,
      song.streamUrl,
      song.mediaUrl,
      song.url,
    ];

    const validUrl =
      possibleUrls.find(
        (url) =>
          typeof url === "string" &&
          url.trim() !== ""
      );

    return validUrl || null;
  };

  /*
   * ==========================================
   * PLAY SONG
   * ==========================================
   */

  const playSong = (
    song,
    index = 0
  ) => {
    if (!song) {
      console.error(
        "Cannot play empty song."
      );

      return;
    }

    if (
      typeof playMusic !== "function"
    ) {
      console.error(
        "MusicContext.playMusic is not available."
      );

      return;
    }

    const audioUrl =
      getAudioUrl(song);

    if (!audioUrl) {
      console.error(
        "No playable audio URL found:",
        song
      );

      return;
    }

    const songName =
      song?.name ||
      song?.title ||
      song?.songName ||
      "Unknown Song";

    const artists =
      song?.artists ||
      song?.artist ||
      [];

    const duration =
      Number(song?.duration) ||
      Number(
        song?.durationInSeconds
      ) ||
      0;

    const image =
      getSongImage(song);

    console.log(
      "Playing:",
      {
        index,
        id: song?.id,
        name: songName,
        audioUrl,
        duration,
        image,
        artists,
      }
    );

    try {
      /*
       * Keep this argument order
       * compatible with MusicContext.
       */

      playMusic(song, songs);
    } catch (err) {
      console.error(
        "Error calling playMusic:",
        err
      );
    }
  };

  /*
   * ==========================================
   * PLAY FIRST SONG
   * ==========================================
   */

  const playFirstSong = () => {
    if (!songs.length) {
      console.warn(
        "Playlist has no songs."
      );

      return;
    }

    playSong(
      songs[0],
      0
    );
  };

  /*
   * ==========================================
   * LIKE / UNLIKE
   * ==========================================
   */

  const playlistId =
    playlistData?.id;

  const isLiked =
    likedPlaylists.some(
      (playlist) =>
        String(playlist?.id) ===
        String(playlistId)
    );

  const toggleLikePlaylist = () => {
    if (!playlistId) {
      console.warn(
        "Playlist ID is missing."
      );

      return;
    }

    setLikedPlaylists(
      (previousPlaylists) => {
        const alreadyLiked =
          previousPlaylists.some(
            (playlist) =>
              String(
                playlist?.id
              ) ===
              String(playlistId)
          );

        /*
         * UNLIKE
         */

        if (alreadyLiked) {
          return previousPlaylists.filter(
            (playlist) =>
              String(
                playlist?.id
              ) !==
              String(playlistId)
          );
        }

        /*
         * LIKE
         */

        return [
          ...previousPlaylists,
          {
            id: playlistId,
            name:
              playlistData?.name ||
              playlistData?.title ||
              "Unknown Playlist",
            image: playlistImage,
          },
        ];
      }
    );
  };

  /*
   * ==========================================
   * TOTAL DURATION
   * ==========================================
   */

  const totalDuration =
    useMemo(() => {
      return songs.reduce(
        (total, song) => {
          const duration =
            Number(
              song?.duration
            ) ||
            Number(
              song?.durationInSeconds
            ) ||
            0;

          return (
            total + duration
          );
        },
        0
      );
    }, [songs]);

  /*
   * ==========================================
   * FORMAT DURATION
   * ==========================================
   */

  const formatDuration = (
    duration
  ) => {
    const totalSeconds =
      Math.max(
        0,
        Math.floor(
          Number(duration) || 0
        )
      );

    if (
      totalSeconds <= 0
    ) {
      return "0m";
    }

    const hours =
      Math.floor(
        totalSeconds / 3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
          60
      );

    const seconds =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m`;
    }

    return `${seconds}s`;
  };

  /*
   * ==========================================
   * SONG COUNT
   * ==========================================
   */

  const songCount =
    Number(
      playlistData?.songCount
    ) ||
    Number(
      playlistData?.songsCount
    ) ||
    songs.length;

  /*
   * ==========================================
   * LOADING
   * ==========================================
   */

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <img
          src="/Loading.gif"
          alt="Loading..."
          className="h-16 w-16 object-contain"
        />
      </div>
    );
  }

  /*
   * ==========================================
   * ERROR
   * ==========================================
   */

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center px-5">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-500">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="
              mt-4
              rounded-lg
              border
              border-gray-500
              px-5
              py-2
              transition
              hover:bg-gray-700
            "
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /*
   * ==========================================
   * MAIN
   * ==========================================
   */

  return (
    <>
      <Navbar />

      <main
        className="
          mt-[11rem]
          flex
          flex-col
          pb-10
          lg:mt-[6rem]
        "
      >
        {/* =====================================
            PLAYLIST HEADER
        ====================================== */}

        <section
          className="
            flex
            flex-col
            items-center
            gap-4
            lg:flex-row
            lg:gap-8
            lg:pl-8
          "
        >
          {/* PLAYLIST IMAGE */}

          <img
            src={playlistImage}
            alt={
              playlistData?.name ||
              playlistData?.title ||
              "Playlist"
            }
            className="
              DetailImg
              h-40
              w-40
              rounded
              object-cover
              lg:h-60
              lg:w-60
            "
            onError={(event) => {
              if (
                event.currentTarget.src.includes(
                  DEFAULT_IMAGE
                )
              ) {
                return;
              }

              event.currentTarget.src =
                DEFAULT_IMAGE;
            }}
          />

          {/* PLAYLIST INFORMATION */}

          <div
            className="
              flex
              flex-col
              items-center
              gap-1
              text-center
            "
          >
            <h1
              className="
                text-2xl
                font-bold
                lg:text-3xl
              "
            >
              {playlistData?.name ||
                playlistData?.title ||
                "Unknown Playlist"}
            </h1>

            <p
              className="
                text-sm
                font-semibold
                lg:text-lg
              "
            >
              Total Songs :{" "}
              {songCount}
            </p>

            <p
              className="
                text-sm
                font-semibold
                lg:text-lg
              "
            >
              Total Duration :{" "}
              {formatDuration(
                totalDuration
              )}
            </p>

            {/* DESKTOP CONTROLS */}

            <div
              className="
                mt-4
                hidden
                gap-4
                lg:flex
              "
            >
              {/* PLAY */}

              <button
                type="button"
                onClick={
                  playFirstSong
                }
                disabled={
                  songs.length === 0
                }
                title="Play Playlist"
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-[#8f8f8f6e]
                  transition
                  hover:scale-105
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <FaPlay className="text-xl" />
              </button>

              {/* LIKE */}

              <button
                type="button"
                onClick={
                  toggleLikePlaylist
                }
                title={
                  isLiked
                    ? "Unlike Playlist"
                    : "Like Playlist"
                }
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-[#8f8f8f6e]
                  transition
                  hover:scale-105
                "
              >
                {isLiked ? (
                  <FaHeart className="text-2xl text-red-500" />
                ) : (
                  <FaRegHeart className="text-2xl" />
                )}
              </button>
            </div>
          </div>

          {/* MOBILE CONTROLS */}

          <div
            className="
              flex
              gap-3
              lg:hidden
            "
          >
            {/* LIKE */}

            <button
              type="button"
              onClick={
                toggleLikePlaylist
              }
              title={
                isLiked
                  ? "Unlike Playlist"
                  : "Like Playlist"
              }
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                border
                border-[#8f8f8f6e]
                transition
                hover:scale-105
              "
            >
              {isLiked ? (
                <FaHeart className="text-2xl text-red-500" />
              ) : (
                <FaRegHeart className="text-2xl" />
              )}
            </button>

            {/* PLAY */}

            <button
              type="button"
              onClick={
                playFirstSong
              }
              disabled={
                songs.length === 0
              }
              title="Play Playlist"
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                border
                border-[#8f8f8f6e]
                transition
                hover:scale-105
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <FaPlay className="text-xl" />
            </button>
          </div>
        </section>

        {/* =====================================
            SONG LIST
        ====================================== */}

        <section className="mt-4">
          <h2
            className="
              mb-2
              ml-2
              text-2xl
              font-semibold
              lg:mt-8
            "
          >
            Top Songs
          </h2>

          <div className="flex flex-col">
            {songs.length > 0 ? (
              songs.map(
                (song, index) => (
                  <SongsList
                    key={
                      song?.id ||
                      song?.songId ||
                      `song-${index}`
                    }

                    /*
                     * Spread song properties.
                     */

                    {...song}

                    /*
                     * IMPORTANT:
                     * This must be the CURRENT song.
                     *
                     * Do NOT use:
                     *
                     * song={songs}
                     */

                    song={song}

                    /*
                     * Complete playlist.
                     */

                    songs={songs}

                    /*
                     * Current index.
                     */

                    index={index}

                    /*
                     * Direct play callback.
                     */

                    onPlay={() =>
                      playSong(
                        song,
                        index
                      )
                    }
                  />
                )
              )
            ) : (
              <p
                className="
                  w-full
                  py-8
                  text-center
                  text-gray-500
                "
              >
                Playlist is Empty......
              </p>
            )}
          </div>
        </section>
      </main>

      {/* NAVIGATION */}

      <Navigator />

      {/* FOOTER */}

      <Footer />
    </>
  );
};

export default PlaylistDetails;
