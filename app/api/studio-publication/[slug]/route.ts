import matter from "gray-matter";

import { readWritingFile } from "@/lib/writings";

/** Public proof contains only the marker already present in published MDX. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (process.env.SITE_MODE === "preview")
    return new Response("Not found", { status: 404 });
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return new Response("Not found", { status: 404 });
  try {
    const { data } = matter(readWritingFile(slug).source.toString());
    if (data.draft || data.hidden || typeof data.studioRevision !== "string")
      return new Response("Not found", { status: 404 });
    return Response.json(
      {
        revisionId: data.studioRevision,
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
