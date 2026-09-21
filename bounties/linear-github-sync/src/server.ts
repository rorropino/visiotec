import http from "node:http";
import githubWebhook from "../api/webhooks/github.js";
import linearWebhook from "../api/webhooks/linear.js";
import cronSync from "../api/cron/sync.js";

function makeRes(res: http.ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(value: unknown) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(value));
    },
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, service: "linear-github-sync" }));
      return;
    }

    const wrapped = makeRes(res);
    if (req.url === "/api/webhooks/github") return githubWebhook(req, wrapped);
    if (req.url === "/api/webhooks/linear") return linearWebhook(req, wrapped);
    if (req.url === "/api/cron/sync") return cronSync(req, wrapped);

    res.statusCode = 404;
    res.end("Not found");
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`linear-github-sync listening on :${port}`);
});
