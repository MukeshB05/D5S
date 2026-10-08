import {
  GoHome,
  GoHomeFill,
} from "react-icons/go";

import {
  IoHeartOutline,
  IoHeartSharp,
} from "react-icons/io5";

import {
  RiFolderMusicFill,
  RiFolderMusicLine,
} from "react-icons/ri";

import { MdLiveTv } from "react-icons/md";
import { FaSpotify } from "react-icons/fa";

import { useEffect, useState } from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

const Navigator = () => {
  const location = useLocation();

  const [showTVModal, setShowTVModal] =
    useState(false);

  const [wakeLockStatus, setWakeLockStatus] =
    useState("Inactive");

  const [wakeLock, setWakeLock] =
    useState(null);

  /*
  ==================================================
  THEME DETECTION
  ==================================================
  Supports:

  html.dark
  body.dark
  html[data-theme="dark"]
  body[data-theme="dark"]
  ==================================================
  */

  const getTheme = () => {
    if (typeof document === "undefined") {
      return "light";
    }

    const html = document.documentElement;
    const body = document.body;

    const isDark =
      html.classList.contains("dark") ||
      body.classList.contains("dark") ||
      html.getAttribute("data-theme") === "dark" ||
      body.getAttribute("data-theme") === "dark";

    return isDark ? "dark" : "light";
  };

  const [theme, setTheme] = useState(getTheme);

  /*
  ==================================================
  WATCH FOR THEME CHANGES
  ==================================================
  */

  useEffect(() => {
    const updateTheme = () => {
      setTheme(getTheme());
    };

    updateTheme();

    const observer = new MutationObserver(
      updateTheme
    );

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "class",
        "data-theme",
      ],
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "class",
        "data-theme",
      ],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const isDark = theme === "dark";

  /*
  ==================================================
  WAKE LOCK
  ==================================================
  */

  const requestWakeLock = async () => {
    try {
      if (!("wakeLock" in navigator)) {
        setWakeLockStatus("Not Supported");
        return;
      }

      const lock =
        await navigator.wakeLock.request(
          "screen"
        );

      setWakeLock(lock);
      setWakeLockStatus("Active");

      lock.addEventListener(
        "release",
        () => {
          setWakeLockStatus("Inactive");
        }
      );
    } catch (error) {
      console.error(
        "Wake Lock request failed:",
        error
      );

      setWakeLockStatus("Failed");
    }
  };

  const releaseWakeLock = () => {
    if (!wakeLock) return;

    wakeLock.release();
    setWakeLock(null);
    setWakeLockStatus("Inactive");
  };

  const openTVModal = async () => {
    await requestWakeLock();
    setShowTVModal(true);
  };

  const closeTVModal = () => {
    setShowTVModal(false);
    releaseWakeLock();
  };

  /*
  ==================================================
  RE-ACTIVATE WAKE LOCK AFTER VISIBILITY CHANGE
  ==================================================
  */

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === "visible" &&
        showTVModal &&
        !wakeLock
      ) {
        await requestWakeLock();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [showTVModal, wakeLock]);

  /*
  ==================================================
  THEME COLORS
  ==================================================
  */

  const navBackground = isDark
    ? "bg-black"
    : "bg-white";

  const navBorder = isDark
    ? "border-gray-800"
    : "border-gray-200";

  const inactiveText = isDark
    ? "text-gray-300"
    : "text-gray-600";

  const activeText = isDark
    ? "text-green-400"
    : "text-green-500";

  const navShadow = isDark
    ? "shadow-[0_-2px_10px_rgba(255,255,255,0.05)]"
    : "shadow-[0_-2px_10px_rgba(0,0,0,0.08)]";

  return (
    <>
      {/* ==================================================
          MOBILE BOTTOM NAVIGATION
      ================================================== */}

      <nav
        className={`
          lg:hidden
          fixed
          bottom-0
          left-0
          right-0
          z-40
          h-[3.8rem]
          w-full
          flex
          items-center
          justify-around
          ${navBackground}
          border-t
          ${navBorder}
          ${navShadow}
          transition-colors
          duration-200
        `}
      >

        {/* ==================================================
            HOME
        ================================================== */}

        <Link
          to="/"
          className="flex-1 h-full"
        >
          <div
            className={`
              h-full
              flex
              flex-col
              items-center
              justify-center
              text-xs
              transition-colors
              duration-200
              ${
                location.pathname === "/"
                  ? activeText
                  : inactiveText
              }
            `}
          >
            {location.pathname === "/" ? (
              <GoHomeFill className="text-2xl" />
            ) : (
              <GoHome className="text-2xl" />
            )}

            <span>Home</span>
          </div>
        </Link>

        {/* ==================================================
            PLAYLIST
        ================================================== */}

        <Link
          to="/Playlist"
          className="flex-1 h-full"
        >
          <div
            className={`
              h-full
              flex
              flex-col
              items-center
              justify-center
              text-xs
              transition-colors
              duration-200
              ${
                location.pathname === "/Playlist"
                  ? activeText
                  : inactiveText
              }
            `}
          >
            {location.pathname === "/Playlist" ? (
              <RiFolderMusicFill className="text-2xl" />
            ) : (
              <RiFolderMusicLine className="text-2xl" />
            )}

            <span>Playlist</span>
          </div>
        </Link>

        {/* ==================================================
            FAVOURITE
        ================================================== */}

        <Link
          to="/Favourite"
          className="flex-1 h-full"
        >
          <div
            className={`
              h-full
              flex
              flex-col
              items-center
              justify-center
              text-xs
              transition-colors
              duration-200
              ${
                location.pathname === "/Favourite"
                  ? activeText
                  : inactiveText
              }
            `}
          >
            {location.pathname === "/Favourite" ? (
              <IoHeartSharp className="text-2xl" />
            ) : (
              <IoHeartOutline className="text-2xl" />
            )}

            <span>Favourite</span>
          </div>
        </Link>

        {/* ==================================================
            SPOTIFY
        ================================================== */}

        <Link
          to="/spotify-import"
          className="flex-1 h-full"
          aria-label="Import Spotify tracks, albums and playlists"
          title="Import Spotify tracks, albums and playlists"
        >
          <div
            className={`
              h-full
              flex
              flex-col
              items-center
              justify-center
              text-xs
              transition-colors
              duration-200
              ${
                location.pathname ===
                "/spotify-import"
                  ? activeText
                  : inactiveText
              }
            `}
          >
            <FaSpotify className="text-2xl" />

            <span>Spotify</span>
          </div>
        </Link>

        {/* ==================================================
            LIVE TV
        ================================================== */}

        <button
          type="button"
          onClick={openTVModal}
          className={`
            flex-1
            h-full
            ${inactiveText}
            transition-colors
            duration-200
          `}
          aria-label="Open Live TV"
        >
          <div
            className="
              h-full
              flex
              flex-col
              items-center
              justify-center
              text-xs
            "
          >
            <MdLiveTv className="text-2xl" />

            <span>Live TV</span>

            {wakeLockStatus === "Active" && (
              <span
                className={`
                  text-[8px]
                  ${
                    isDark
                      ? "text-green-400"
                      : "text-green-500"
                  }
                `}
              >
                Active
              </span>
            )}
          </div>
        </button>
      </nav>

      {/* ==================================================
          LIVE TV MODAL
      ================================================== */}

      {showTVModal && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/80
          "
        >
          <div
            className="
              relative
              w-full
              h-full
              max-w-4xl
              max-h-[85vh]
              bg-black
            "
          >
            <button
              type="button"
              onClick={closeTVModal}
              className="
                absolute
                -top-10
                right-0
                z-50
                px-3
                py-2
                text-white
                text-lg
                hover:text-green-400
                transition-colors
                duration-200
              "
            >
              × Close
            </button>

            <iframe
              src="https://dreamplay.pages.dev/"
              title="Dreamly5 Live TV"
              className="w-full h-full border-none"
              allowFullScreen
              frameBorder="0"
              scrolling="yes"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Navigator;
