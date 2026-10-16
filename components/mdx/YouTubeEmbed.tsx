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
  const src =
    startTime !== undefined && startTime !== 0 && !Number.isNaN(startTime)
      ? `https://www.youtube.com/embed/${videoId}?start=${startTime}`
      : `https://www.youtube.com/embed/${videoId}`;

  return (
    <figure className="my-6 w-full">
      <div className="aspect-video overflow-hidden rounded-lg">
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
      <figcaption>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
        >{`Watch ${title} on YouTube`}</a>
      </figcaption>
    </figure>
  );
}
