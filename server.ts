import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { audioParts, generateTransactionContent, textParts } from "./shared/gemini";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit because audio data can be large
  app.use(express.json({ limit: "50mb" }));

  // API Route for GenAI
  app.post("/api/parse-audio", async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Missing audio" });
      }

      if (process.env.GEMINI_API_KEY === undefined || process.env.GEMINI_API_KEY === "") {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing. Please set it in Settings > Secrets." });
      }

      const result = await generateTransactionContent(process.env.GEMINI_API_KEY, audioParts(audioBase64, mimeType));
      res.json({ result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to process audio" });
    }
  });

  // API Route for text parsing
  app.post("/api/parse-text", async (req, res) => {
    try {
      const { textInput } = req.body;
      if (!textInput) {
        return res.status(400).json({ error: "Missing text input" });
      }

      if (process.env.GEMINI_API_KEY === undefined || process.env.GEMINI_API_KEY === "") {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing. Please set it first." });
      }

      const result = await generateTransactionContent(process.env.GEMINI_API_KEY, textParts(textInput));
      res.json({ result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to process text" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // server.cjs lives inside dist/, so __dirname = dist path
    const distPath = __dirname;
    console.log(`[server] Serving static from: ${distPath}`);
    // Disable static auto-index so we control caching on index.html via the catch-all
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      // HTML must never be cached so users always get the latest asset hashes after redeploy
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();