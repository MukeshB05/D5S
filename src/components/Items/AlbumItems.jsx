import { Link } from "react-router-dom";
import he from "he";
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

const getArtistNames = (artists) => {
  if (Array.isArray(artists?.primary)) {
    return artists.primary
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(" , ");
  }

  if (Array.isArray(artists)) {
    return artists
      .map((artist) => artist?.name || artist)
      .filter(Boolean)
      .join(" , ");
  }

  if (typeof artists === "string") return artists;
  return "";
};

const AlbumItems = (props) => {
  const {
    name,
    artists,
    id,
    image,
  } = props;

  const spotifyUrl = getSpotifyUrl(props, "album");
  const imageUrl = getImageUrl(image);
  const artistNames = getArtistNames(artists);

  let displayName = name || "Empty";
  try {
    displayName = he.decode(String(displayName));
  } catch {
    displayName = String(displayName);
  }

  const content = (
    <>
      <div className="p-1">
        <img
          src={imageUrl}
          alt={displayName}
          className="rounded-lg imgs w-full"
          onError={(event) => {
            event.currentTarget.src = "/Unknown.png";
          }}
        />
      </div>
      <div className="text-[13px] w-full flex flex-col justify-center pl-2">
        <span className="font-semibold overflow-x-clip">
          {displayName}
        </span>
        {artistNames && (
          <span className="flex gap-1 truncate">
            by <span className="font-semibold truncate">{artistNames}</span>
          </span>
        )}
      </div>
    </>
  );

  if (spotifyUrl) {
    return (
      <a
        href={spotifyUrl}
        className="card relative w-[9.5rem] h-[11.96rem] overflow-clip border-[0.1px] p-1 rounded-lg shadow-md block"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          window.location.assign(spotifyUrl);
        }}
      >
        {content}
        <span className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954] text-white shadow-lg">
          <FaSpotify />
        </span>
      </a>
    );
  }

  return (
    <Link
      to={`/albums/${id}`}
      className="card w-[9.5rem] h-[11.96rem] overflow-clip border-[0.1px] p-1 rounded-lg shadow-md block"
    >
      {content}
    </Link>
  );
};

export default AlbumItems;
