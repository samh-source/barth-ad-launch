/**
 * POST /api/launch — start a Barth launch (video + clients + optional brief).
 * GET /api/launch/stream?runId= — SSE stream of status messages for the run.
 */

import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { loadAllClients } from "core";
import { createRun, getRun, appendMessage, finishRun } from "../launchStore.js";
import { runBarthMetaLaunch } from "../barth/meta.js";
import { runBarthTikTokLaunch } from "../barth/tiktok.js";
import { preflightSelectedClients, type LaunchPlatform } from "../launchReadiness.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename(_req, file, cb) {
      const extension = extname(file.originalname || "").trim() || ".mp4";
      cb(null, `barth-${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("video/")) {
      cb(new Error("Only video files are allowed"));
      return;
    }
    cb(null, true);
  },
});

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function launchRoutes(projectRoot: string) {
  const postLaunch = async (req: Request, res: Response) => {
    if (!req.file?.path) {
      res.status(400).json({ error: "Missing video file" });
      return;
    }
    const uploadedFilePath = req.file.path;
    const clientIds = parseStringArray(req.body?.clientIds);
    const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() : undefined;
    const platforms = parseStringArray(req.body?.platforms).filter(
      (platform): platform is LaunchPlatform => platform === "meta" || platform === "tiktok"
    );

    if (clientIds.length === 0) {
      await rm(uploadedFilePath, { force: true }).catch(() => {});
      res.status(400).json({ error: "Select at least one client" });
      return;
    }
    if (platforms.length === 0) {
      await rm(uploadedFilePath, { force: true }).catch(() => {});
      res.status(400).json({ error: "Select at least one platform" });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      await rm(uploadedFilePath, { force: true }).catch(() => {});
      res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY." });
      return;
    }

    const clientsDir = join(projectRoot, "config", "clients");
    const { clients, errors } = await loadAllClients({ clientsDir });
    const preflight = preflightSelectedClients(clients, clientIds, platforms);
    if (preflight.errors.length > 0) {
      await rm(uploadedFilePath, { force: true }).catch(() => {});
      res.status(400).json({
        error: `Launch blocked: ${preflight.errors.join(" | ")}`,
      });
      return;
    }

    const runId = randomUUID();
    createRun(runId);
    const file = req.file;
    const filePath = file.path;

    res.status(202).json({ runId });

    const onStatus = (message: string) => appendMessage(runId, message);

    (async () => {
      let videoBuffer: Buffer | undefined;
      try {
        if (errors.length > 0) {
          onStatus(`Barth: Config warnings: ${errors.map((err) => err.file).join(", ")}`);
        }
        onStatus(`Barth: Launch validated for ${preflight.selectedClients.length} client(s).`);
        videoBuffer = await readFile(filePath);

        const videoFileName = file.filename || file.originalname || "video.mp4";
        if (platforms.includes("meta")) {
          onStatus("Barth: Launching to Meta…");
          await runBarthMetaLaunch({
            projectRoot,
            videoBuffer,
            videoFileName,
            clientIds,
            brief,
            onStatus,
          });
        }
        if (platforms.includes("tiktok")) {
          onStatus("Barth: Launching to TikTok…");
          await runBarthTikTokLaunch({
            projectRoot,
            videoBuffer,
            videoFileName,
            clientIds,
            brief,
            onStatus,
          });
        }
      } catch (err) {
        let msg = err instanceof Error ? err.message : String(err);
        if (/Unexpected token.*is not valid JSON/i.test(msg)) {
          msg = "Server or API returned a non-JSON response (request may be too large or a gateway error).";
        }
        appendMessage(runId, `Barth: Launch failed — ${msg}`);
      } finally {
        await rm(filePath, { force: true }).catch(() => {});
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
