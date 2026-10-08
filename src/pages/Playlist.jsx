import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Navigator from "../components/Navigator";
import { genreData } from "../genreData";
import he from "he";
import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

function Playlist() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const genres = [
    "For You",
    "Tamil",
    "Malayalam",
    "Hindi",
    "English",
    "Kannada",
    "Telugu",
    "Marathi",
    "Gujarati",
    "Bengali",
    "Haryanvi",
    "Punjabi",
    "Rajasthani",
  ];

  const [selectedGenre, setSelectedGenre] = useState("For You");
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Get safe playlist image
  // --------------------------------------------------
  const getPlaylistImage = (playlist) => {
    if (!playlist) {
      return "/Unknown.png";
    }

    // JioSaavn format:
    // image: [
    //   { url: "..." },
    //   { url: "..." },
    //   { url: "..." }
    // ]
    if (Array.isArray(playlist.image)) {
      return (
        playlist.image?.[2]?.url ||
        playlist.image?.[1]?.url ||
        playlist.image?.[0]?.url ||
        "/Unknown.png"
      );
    }

    // If image is already a string
    if (typeof playlist.image === "string") {
      return playlist.image;
    }

    return "/Unknown.png";
  };

  // --------------------------------------------------
  // Decode playlist name safely
  // --------------------------------------------------
  const getPlaylistName = (playlist) => {
    if (!playlist?.name) {
      return "Unknown Playlist";
    }

    try {
      return he.decode(String(playlist.name));
    } catch (error) {
      console.error("Playlist name decode error:", error);
      return String(playlist.name);
    }
  };

  // --------------------------------------------------
  // Initial "For You" playlists
  // --------------------------------------------------
  useEffect(() => {
    const defaultPlaylists = genreData?.["For You"];

    if (Array.isArray(defaultPlaylists)) {
      setPlaylists(defaultPlaylists);
    } else {
      setPlaylists([]);
    }
  }, []);

  // --------------------------------------------------
  // Scroll controls
  // --------------------------------------------------
  const scrollLeft = () => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollBy({
      left: -800,
      behavior: "smooth",
    });
  };

  const scrollRight = () => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollBy({
      left: 800,
      behavior: "smooth",
    });
  };

  // --------------------------------------------------
  // Genre click
  // --------------------------------------------------
  const handleGenreClick = async (genre) => {
    setSelectedGenre(genre);
    setError("");

    // Reset scroll position when changing genre
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }

    // Local playlists for For You
    if (genre === "For You") {
      const defaultPlaylists = genreData?.["For You"];

      setPlaylists(
        Array.isArray(defaultPlaylists) ? defaultPlaylists : []
      );

      return;
    }

    try {
      setLoading(true);
      setPlaylists([]);

      const query = encodeURIComponent(genre.toLowerCase());

      const response = await fetch(
        `https://jiosaavndev.vercel.app/api/search/playlists?query=${query}&limit=130`
      );

      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      const results = data?.data?.results;

      if (Array.isArray(results)) {
        setPlaylists(results);
      } else {
        setPlaylists([]);
        setError("No playlists found.");
      }
    } catch (error) {
      console.error("Error fetching playlists:", error);

      setPlaylists([]);
      setError("Unable to load playlists. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Playlist click
  // --------------------------------------------------
  const handlePlaylistClick = (playlist) => {
    if (!playlist?.id) {
      console.error("Playlist ID is missing:", playlist);
      return;
    }

    navigate(`/playlists/${playlist.id}`);
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <>
      <Navbar />

      <main className="mt-[8.3rem] lg:mt-[6rem] mb-[12rem] lg:mb-[4rem]">
        {/* -------------------------------------------
            Genre navigation
        -------------------------------------------- */}
        <div className="w-full">
          <ul
            className="
              flex
              items-center
              gap-3
              px-5
              py-2
              overflow-x-auto
              scroll-smooth
              scroll-hide
              lg:justify-center
              lg:flex-wrap
              lg:overflow-visible
            "
          >
            {genres.map((genre) => (
              <li
                key={genre}
                onClick={() => handleGenreClick(genre)}
                className={`
                  flex
                  items-center
                  justify-center
                  whitespace-nowrap
                  cursor-pointer
                  select-none
                  font-semibold
                  border
                  border-zinc-700
                  text-center
                  px-5
                  py-1
                  text-base
                  rounded-3xl
                  transition-all
                  duration-200
                  hover:scale-105
                  ${
                    selectedGenre === genre
                      ? "search-btn arrow-btnn"
                      : "navigator"
                  }
                `}
              >
                {genre}
              </li>
            ))}
          </ul>
        </div>

        {/* -------------------------------------------
            Playlist section
        -------------------------------------------- */}
        <section className="flex flex-col gap-5">
          <h2
            className="
              text-2xl
              font-semibold
              ml-[1.5rem]
              lg:ml-[4rem]
              mt-3
            "
          >
            • {selectedGenre}
          </h2>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center py-16">
              <div
                className="
                  w-10
                  h-10
                  border-4
                  border-zinc-600
                  border-t-transparent
                  rounded-full
                  animate-spin
                "
              />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 px-5">
              <p className="text-red-400 text-center mb-4">
                {error}
              </p>

              <button
                type="button"
                onClick={() => handleGenreClick(selectedGenre)}
                className="
                  px-5
                  py-2
                  rounded-full
                  border
                  border-zinc-600
                  hover:bg-zinc-800
                  transition
                "
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading &&
            !error &&
            playlists.length === 0 && (
              <div className="flex justify-center items-center py-16">
                <p className="text-zinc-400">
                  No playlists available.
                </p>
              </div>
            )}

          {/* Playlist slider */}
          {!loading &&
            !error &&
            playlists.length > 0 && (
              <div className="flex justify-center items-center w-full">
                {/* Left arrow */}
                <button
                  type="button"
                  aria-label="Scroll playlists left"
                  onClick={scrollLeft}
                  className="
                    hidden
                    lg:flex
                    items-center
                    justify-center
                    shrink-0
                    text-3xl
                    w-[2rem]
                    h-[9rem]
                    cursor-pointer
                    arrow-btn
                    hover:scale-125
                    transition-all
                    duration-300
                    ease-in-out
                  "
                >
                  <MdOutlineKeyboardArrowLeft />
                </button>

                {/* Playlist container */}
                <div
                  ref={scrollRef}
                  className="
                    grid
                    grid-cols-2
                    lg:grid-rows-2
                    lg:grid-flow-col
                    lg:grid-cols-none
                    gap-4
                    w-full
                    px-5
                    lg:px-8
                    overflow-x-auto
                    scroll-smooth
                    scroll-hide
                  "
                >
                  {playlists.map((playlist, index) => {
                    if (!playlist?.id) {
                      return null;
                    }

                    const imageUrl = getPlaylistImage(playlist);
                    const playlistName =
                      getPlaylistName(playlist);

                    return (
                      <button
                        key={`${playlist.id}-${index}`}
                        type="button"
                        onClick={() =>
                          handlePlaylistClick(playlist)
                        }
                        className="
                          group
                          flex
                          flex-col
                          items-center
                          text-left
                          h-[13rem]
                          w-[10rem]
                          shrink-0
                          overflow-hidden
                          cursor-pointer
                          py-1
                          card
                          rounded-md
                          focus:outline-none
                          focus:ring-2
                          focus:ring-zinc-500
                        "
                      >
                        {/* Image */}
                        <div className="w-[10rem] h-[10rem] p-2">
                          <img
                            src={imageUrl}
                            alt={playlistName}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src =
                                "/Unknown.png";
                            }}
                            className="
                              w-full
                              h-full
                              object-cover
                              rounded-2xl
                              transition-all
                              duration-300
                              group-hover:brightness-[0.65]
                              group-hover:scale-[1.02]
                            "
                          />
                        </div>

                        {/* Name */}
                        <p
                          className="
                            w-full
                            text-center
                            text-[14px]
                            px-2
                            truncate
                          "
                          title={playlistName}
                        >
                          {playlistName}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Right arrow */}
                <button
                  type="button"
                  aria-label="Scroll playlists right"
                  onClick={scrollRight}
                  className="
                    hidden
                    lg:flex
                    items-center
                    justify-center
                    shrink-0
                    text-3xl
                    w-[2rem]
                    h-[9rem]
                    cursor-pointer
                    arrow-btn
                    hover:scale-125
                    transition-all
                    duration-300
                    ease-in-out
                  "
                >
                  <MdOutlineKeyboardArrowRight />
                </button>
              </div>
            )}
        </section>
      </main>

      {/* IMPORTANT:
          MusicContext is a context object, NOT a React component.
          Do NOT render <MusicContext /> here.
      */}

      <Navigator />
    </>
  );
}

export default Playlist;
