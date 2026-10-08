import { GoPlay } from "react-icons/go";
import { useContext, useState } from "react";
import MusicContext from "../context/MusicContext";
import he from "he";

const safeDecode = (value) => {
  try {
    return he.decode(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
};

const formatTime = (value) => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const getImageUrl = (image) => {
  if (!image) return "/Unknown.png";
  if (typeof image === "string") return image;

  if (Array.isArray(image)) {
    for (let i = image.length - 1; i >= 0; i -= 1) {
      const item = image[i];
      const url =
        typeof item === "string"
          ? item
          : item?.url || item?.link || item?.src;
      if (url) return url;
    }
    return "/Unknown.png";
  }

  if (typeof image === "object") {
    return image.url || image.link || image.src || "/Unknown.png";
  }

  return "/Unknown.png";
};

const getArtistNames = (artists) => {
  if (Array.isArray(artists?.primary)) {
    return artists.primary
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(", ");
  }

  if (Array.isArray(artists)) {
    return artists
      .map((artist) => artist?.name || artist)
      .filter(Boolean)
      .join(", ");
  }

  if (typeof artists === "string") return artists;

  return "Unknown Artist";
};

const SongsList = (props) => {
  const [hovering, setHovering] = useState(false);
  const { playMusic } = useContext(MusicContext) || {};

  const {
    name,
    title,
    artists,
    artist,
    duration,
    image,
    id,
    song,
    songs,
    songList,
    onPlay,
  } = props;

  /*
   * IMPORTANT:
   * Older pages pass the complete queue as `song={list}`.
   * Newer pages may pass it as `songs` or `songList`.
   *
   * Never treat an array as the current song.
   */
  const queue = Array.isArray(song)
    ? song
    : Array.isArray(songs)
      ? songs
      : Array.isArray(songList)
        ? songList
        : [];

  const item =
    song && !Array.isArray(song) && typeof song === "object"
      ? song
      : props;

  const songName =
    item?.name ||
    item?.title ||
    item?.songName ||
    name ||
    title ||
    "Unknown Song";

  const artistData =
    item?.artists ||
    item?.artist ||
    artists ||
    artist;

  const artistNames = getArtistNames(artistData);
  const imageUrl = getImageUrl(item?.image || image);

  const handleClick = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (typeof onPlay === "function") {
      onPlay(item, queue);
      return;
    }

    if (typeof playMusic !== "function") {
      console.error("MusicContext.playMusic is not available.");
      return;
    }

    /*
     * Passing the complete list is what enables:
     * Album -> all album songs -> Next/Previous
     * Artist -> all artist songs -> Next/Previous
     * Playlist -> all playlist songs -> Next/Previous
     * Favourite -> all favourite songs -> Next/Previous
     *
     * With no queue, MusicContext intentionally creates a one-song queue.
     */
    await playMusic(item, queue.length ? queue : undefined);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="overflow-clip h-[3.5rem] w-full song-item flex justify-between items-center p-2 song-info"
      aria-label={`Play ${safeDecode(songName)}`}
    >
      <div className="relative cursor-pointer">
        <img
          src={imageUrl}
          alt=""
          className="w-[5rem] object-cover transition-all duration-700"
          onError={(event) => {
            event.currentTarget.src = "/Unknown.png";
          }}
        />
        {hovering && (
          <GoPlay className="transition-all duration-700 absolute inset-0 hidden lg:flex items-center justify-center w-[2.35rem] h-[2.35rem]  opacity-65 backdrop-brightness-[0.6] icon" />
        )}
      </div>

      <div className="flex w-full pl-5 ">
        <h3 className="overflow-clip text-[0.75rem] lg:text-[0.875rem] h-[1.3rem] font-medium">
          {safeDecode(songName)}
        </h3>
      </div>

      <div className="flex w-full">
        <p className="text-[0.60rem] lg:text-[0.75rem] h-[1rem] mr-3 overflow-clip lg:w-auto">
          {safeDecode(artistNames)}
        </p>
      </div>

      <div className="song-duration mr-2">
        <span className="text-[0.60rem] lg:text-[0.75rem]">
          {formatTime(item?.duration ?? duration)}
        </span>
      </div>
    </button>
  );
};

export default SongsList;
