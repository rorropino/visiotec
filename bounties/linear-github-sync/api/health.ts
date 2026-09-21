export default async function handler(): Promise<Response> {
  return Response.json({
    ok: true,
    service: "linear-github-two-way-sync",
    timestamp: new Date().toISOString(),
  });
}
