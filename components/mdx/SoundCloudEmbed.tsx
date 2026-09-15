interface SoundCloudEmbedProps {
  url: string;
  visual?: boolean;
  showComments?: boolean;
  color?: string;
}

export default function SoundCloudEmbed({
  url,
  visual = false,
  showComments = false,
  color = '3C84FC',
}: SoundCloudEmbedProps) {
  const height = visual ? 300 : 166;
  const encodedUrl = encodeURIComponent(url);
  const src = `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23${color}&auto_play=false&hide_related=true&show_comments=${showComments}&show_user=true&show_reposts=false&show_teaser=false${visual ? '&visual=true' : ''}`;

  return (
    <div className="my-6 w-full overflow-hidden rounded-lg">
      <iframe
        width="100%"
        height={height}
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={src}
        loading="lazy"
        title="SoundCloud player"
      />
    </div>
  );
}
