/** Public OAuth identity only; no credentials or private writing. */
export async function GET() {
  if (process.env.SITE_MODE === "preview")
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  return Response.json(
    {
      client_id: "https://willie.page/.well-known/lattice-client.json",
      client_name: "Willie Writing Studio",
      client_uri: "https://willie.page",
      redirect_uris: [
        "https://preview.willie.page/api/studio/lattice/callback",
      ],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "openid offline_access lattice:compute:inference",
      resource: ["https://lattice.uselovelace.com"],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
