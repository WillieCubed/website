type SpotifyType = 'track' | 'album' | 'playlist' | 'episode' | 'show';

interface SpotifyEmbedProps {
  url: string;
  compact?: boolean;
  theme?: 'light' | 'dark';
}

function parseSpotifyUrl(
  url: string
): { type: SpotifyType; id: string } | null {
  const match = url.match(
    /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/
  );
  if (match) {
    return { type: match[1] as SpotifyType, id: match[2] };
  }
  return null;
}

export default function SpotifyEmbed({
  url,
  compact = false,
  theme = 'dark',
}: SpotifyEmbedProps) {
  const parsed = parseSpotifyUrl(url);

  if (!parsed) {
    return <p className="text-error">Invalid Spotify URL</p>;
  }

  const { type, id } = parsed;
  const height = compact ? 152 : type === 'track' ? 152 : 352;
  const src = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=${theme === 'dark' ? '0' : '1'}`;

  return (
    <div className="my-6 w-full overflow-hidden rounded-lg">
      <iframe
        src={src}
        width="100%"
        height={height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="border-0"
        title={`Spotify ${type}`}
      />
    </div>
  );
}
