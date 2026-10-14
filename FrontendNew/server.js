const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = process.env.PORT || 8080;
const root = path.join(__dirname, "dist");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  let requestPath;

  try {
    requestPath = decodeURIComponent(
      new URL(req.url, `http://${req.headers.host}`).pathname
    );
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const requestedFile = path.resolve(root, relativePath);

  // Prevent requests from escaping the dist directory.
  if (
    requestedFile !== root &&
    !requestedFile.startsWith(`${root}${path.sep}`)
  ) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const serveFile = (file) => {
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const type = contentTypes[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
  };

  fs.stat(requestedFile, (error, stats) => {
    if (!error && stats.isFile()) {
      serveFile(requestedFile);
    } else {
      // SPA fallback for client-side routes.
      serveFile(path.join(root, "index.html"));
    }
  });
});

server.listen(port, () => {
  console.log(`Frontend listening on port ${port}`);
});
