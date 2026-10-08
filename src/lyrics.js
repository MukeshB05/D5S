const LRCLIB_BASE_URL = "https://lrclib.net/api";

export function parseLrc(lrcText) {
  if (!lrcText || typeof lrcText !== "string") return [];
  const result = [];
  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lrcText.split(/\r?\n/)) {
    const matches = [...line.matchAll(timeRegex)];
    if (!matches.length) continue;
    const text = line.replace(timeRegex, "").trim();
    if (!text) continue;
    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] || "0";
      const milliseconds = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction.slice(0, 3));
      result.push({ time: minutes * 60 + seconds + milliseconds / 1000, text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

export async function fetchSyncedLyrics(trackName, artistName, duration) {
  const cleanTrack = String(trackName || "").replace(/\(.*?\)|\[.*?\]/g, "").trim();
  const cleanArtist = String(artistName || "").split(",")[0].trim();
  if (!cleanTrack) return { synced: false, lines: [], plain: "No lyrics available." };

  try {
    let url = `${LRCLIB_BASE_URL}/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    if (duration && Number.isFinite(Number(duration))) url += `&duration=${Math.round(Number(duration))}`;
    let response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data?.syncedLyrics) return { synced: true, lines: parseLrc(data.syncedLyrics), plain: data.plainLyrics || "" };
      if (data?.plainLyrics) return { synced: false, lines: data.plainLyrics.split(/\r?\n/).filter(Boolean).map(text => ({ time: 0, text })), plain: data.plainLyrics };
    }

    response = await fetch(`${LRCLIB_BASE_URL}/search?q=${encodeURIComponent(`${cleanTrack} ${cleanArtist}`.trim())}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        const item = data.find(x => x?.syncedLyrics) || data.find(x => x?.plainLyrics);
        if (item?.syncedLyrics) return { synced: true, lines: parseLrc(item.syncedLyrics), plain: item.plainLyrics || "" };
        if (item?.plainLyrics) return { synced: false, lines: item.plainLyrics.split(/\r?\n/).filter(Boolean).map(text => ({ time: 0, text })), plain: item.plainLyrics };
      }
    }
    return { synced: false, lines: [], plain: "No lyrics available for this song." };
  } catch (error) {
    console.error("LRCLIB error:", error);
    return { synced: false, lines: [], plain: "Could not load lyrics." };
  }
}
