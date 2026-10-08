import { Link } from "react-router-dom";
import { FaSpotify } from "react-icons/fa6";
import { getSpotifyUrl } from "../../utils/spotify";

const getImageUrl = (image) => {
  if (!image) return "/Unknown.png";
  if (typeof image === "string") return image;

  if (Array.isArray(image)) {
    for (let i = image.length - 1; i >= 0; i -= 1) {
      const value = image[i];
      const url = typeof value === "string" ? value : value?.url || value?.src;
      if (url) return url;
    }
    return "/Unknown.png";
  }

  if (typeof image === "object") {
    return image.url || image.src || "/Unknown.png";
  }

  return "/Unknown.png";
};

const PlaylistItems = (props) => {
  const {
    name,
    image,
    id,
  } = props;

  const spotifyUrl = getSpotifyUrl(props, "playlist");
  const imageUrl = getImageUrl(image);

  if (spotifyUrl) {
    return (
      <a
        href={spotifyUrl}
        className="w-[7.9rem] flex flex-col justify-center items-center gap-3 rounded-lg"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          window.location.assign(spotifyUrl);
        }}
      >
        <div className="relative w-full">
          <img
            src={imageUrl}
            alt={name || "Spotify Playlist"}
            className="rounded w-full"
            onError={(event) => {
              event.currentTarget.src = "/Unknown.png";
            }}
          />
          <span className="absolute right-1 bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954] text-white shadow-lg">
            <FaSpotify />
          </span>
        </div>
        <div className="text-[13px] h-[2.5rem] w-full flex flex-col justify-center items-center">
          <span className="font-semibold overflow-hidden w-[6rem] text-center">
            {name || "Spotify Playlist"}
          </span>
        </div>
      </a>
    );
  }

  return (
    <Link
      to={`/playlists/${id}`}
      className="w-[7.9rem] flex flex-col justify-center items-center gap-3 rounded-lg"
    >
      <img
        src={imageUrl}
        alt={name || "Playlist"}
        className="rounded w-full"
        onError={(event) => {
          event.currentTarget.src = "/Unknown.png";
        }}
      />
      <div className="text-[13px] h-[2.5rem] w-full flex flex-col justify-center items-center">
        <span className="font-semibold overflow-hidden w-[6rem] text-center">
          {name || "Playlist"}
        </span>
      </div>
    </Link>
  );
};

export default PlaylistItems;
