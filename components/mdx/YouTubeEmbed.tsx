interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  startTime?: number;
}

export default function YouTubeEmbed({
  videoId,
  title = 'YouTube video',
  startTime,
}: YouTubeEmbedProps) {
  const src = startTime
    ? `https://www.youtube.com/embed/${videoId}?start=${startTime}`
    : `https://www.youtube.com/embed/${videoId}`;

  return (
    <div className="my-6 aspect-video w-full overflow-hidden rounded-lg">
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="h-full w-full border-0"
      />
    </div>
  );
}
