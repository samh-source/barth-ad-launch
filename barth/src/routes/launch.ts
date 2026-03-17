/**
 * POST /api/launch — start a Barth launch (video + clients + optional brief).
 * GET /api/launch/stream?runId= — SSE stream of status messages for the run.
 */

import multer from "multer";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { createRun, getRun, appendMessage, finishRun } from "../launchStore.js";
import { runBarthMetaLaunch } from "../barth/meta.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("video/")) {
      cb(new Error("Only video files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export function launchRoutes(projectRoot: string) {
  const postLaunch = async (req: Request, res: Response) => {
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Missing video file" });
      return;
    }
    const clientIdsRaw = req.body?.clientIds;
    const clientIds = Array.isArray(clientIdsRaw)
      ? clientIdsRaw
      : typeof clientIdsRaw === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(clientIdsRaw) as unknown;
              return Array.isArray(parsed) ? (parsed as string[]) : [];
            } catch {
              return [];
            }
          })()
        : [];
    const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() : undefined;

    if (clientIds.length === 0) {
      res.status(400).json({ error: "Select at least one client" });
      return;
    }

    const runId = randomUUID();
    createRun(runId);
    const file = req.file;

    res.status(202).json({ runId });

    const onStatus = (message: string) => appendMessage(runId, message);

    (async () => {
      try {
        await runBarthMetaLaunch({
          projectRoot,
          videoBuffer: file.buffer,
          videoFileName: file.originalname || "video.mp4",
          clientIds,
          brief,
          onStatus,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendMessage(runId, `Barth: Launch failed — ${msg}`);
      } finally {
        finishRun(runId);
      }
    })();
  };

  const getStream = (req: Request, res: Response) => {
    const runId = req.query.runId as string;
    if (!runId) {
      res.status(400).json({ error: "Missing runId" });
      return;
    }
    const run = getRun(runId);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let lastSentIndex = 0;

    const sendNewMessages = () => {
      const runNow = getRun(runId);
      if (!runNow) return;
      while (lastSentIndex < runNow.messages.length) {
        const line = runNow.messages[lastSentIndex];
        res.write(`data: ${JSON.stringify({ message: line })}\n\n`);
        lastSentIndex++;
      }
      if (runNow.done) {
        if (runNow.error) res.write(`data: ${JSON.stringify({ error: runNow.error })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    };

    run.listeners.add(sendNewMessages);
    sendNewMessages();

    req.on("close", () => {
      run.listeners.delete(sendNewMessages);
    });
  };

  return {
    postLaunch: [upload.single("video"), postLaunch],
    getStream,
  };
}
