import { useContext } from "react";
import MusicContext from "../context/MusicContext";
import he from "he";

const getImage = (image) => {
  if (!image) return "/Unknown.png";
  if (typeof image === "string") return image;

  if (Array.isArray(image)) {
    for (let i = image.length - 1; i >= 0; i -= 1) {
      const value = image[i];
      const url =
        typeof value === "string"
          ? value
          : value?.url || value?.link || value?.src;

      if (url) return url;
    }
  }

  return image?.url || image?.link || image?.src || "/Unknown.png";
};

const safeDecode = (value) => {
  try {
    return he.decode(String(value || ""));
  } catch {
    return String(value || "");
  }
};

const SongGrid = (props) => {
  const { playMusic } = useContext(MusicContext) || {};

  const {
    name,
    title,
    artists,
    artist,
    duration,
    downloadUrl,
    audio,
    audioUrl,
    image,
    id,
    song,
    songs,
    songList,
  } = props;

  // `song` can be either the current song object or the complete queue.
  const item =
    song && typeof song === "object" && !Array.isArray(song)
      ? song
      : props;

  // Keep the exact list from the page that rendered this card.
  // This is what makes Previous / Next work across the whole section.
  const queue = Array.isArray(song)
    ? song
    : Array.isArray(songs)
      ? songs
      : Array.isArray(songList)
        ? songList
        : [];

  const songName =
    item?.name ||
    item?.title ||
    name ||
    title ||
    "Unknown Song";

  const songImage = getImage(item?.image || image);

  const artistData =
    item?.artists ||
    item?.artist ||
    artists ||
    artist;

  const artistNames = Array.isArray(artistData?.primary)
    ? artistData.primary
        .map((a) => a?.name)
        .filter(Boolean)
        .join(", ")
    : Array.isArray(artistData)
      ? artistData
          .map((a) => a?.name || a)
          .filter(Boolean)
          .join(", ")
      : typeof artistData === "string"
        ? artistData
        : "Unknown Artist";

  const handlePlay = async () => {
    if (typeof playMusic !== "function") return;

    // Always pass the complete queue when this card belongs to a list.
    await playMusic(item, queue);
  };

  return (
    <button
      type="button"
      className="card w-[9.5rem] h-[11.9rem] overflow-hidden p-1 rounded-lg cursor-pointer shadow-md text-left shrink-0"
      onClick={handlePlay}
      aria-label={`Play ${songName}`}
    >
      <div className="p-1">
        <img
          src={songImage}
          alt={songName}
          className="w-full aspect-square rounded-lg object-cover"
          onError={(event) => {
            event.currentTarget.src = "/Unknown.png";
          }}
        />
      </div>

      <div className="px-2 text-[13px]">
        <div className="font-semibold overflow-hidden whitespace-nowrap text-ellipsis">
          {safeDecode(songName)}
        </div>

        <div className="overflow-hidden whitespace-nowrap text-ellipsis">
          by{" "}
          <span className="font-semibold">
            {safeDecode(artistNames)}
          </span>
        </div>
      </div>
    </button>
  );
};

export default SongGrid;
