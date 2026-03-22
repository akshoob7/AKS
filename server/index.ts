import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency needed)
try {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {}

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Garagii API",
      version: "1.0.0",
      description: "Backend API for the Garagii AI chat assistant",
    },
    servers: [{ url: "/" }],
  },
  apis: ["./server/index.ts"],
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are GARAGII, an expert AI assistant specializing exclusively in garages and car parts. You help users with:

- Car parts (engines, brakes, suspension, exhaust, electrical, transmission, etc.)
- Garage setup, tools, and equipment
- Car maintenance and DIY repairs
- Sourcing and pricing auto parts
- Diagnosing car problems and fault codes

If a user asks about anything outside of garages and car parts, politely decline and let them know you only cover automotive and garage topics. Keep responses concise, practical, and helpful.`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface Message {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

/**
 * @openapi
 * /api/chat:
 *   post:
 *     summary: Send a chat message to Garagii AI
 *     description: Accepts a conversation history and streams back an AI response using Server-Sent Events (SSE).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Conversation history
 *                 items:
 *                   type: object
 *                   required:
 *                     - role
 *                     - content
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       oneOf:
 *                         - type: string
 *                           description: Plain text message
 *                         - type: array
 *                           description: Multipart message (text + images)
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                                 enum: [text, image_url]
 *                               text:
 *                                 type: string
 *                               image_url:
 *                                 type: object
 *                                 properties:
 *                                   url:
 *                                     type: string
 *                                     description: Base64 data URL or remote URL
 *           example:
 *             messages:
 *               - role: user
 *                 content: What brake pads do you recommend for a 2019 Ford F-150?
 *     responses:
 *       200:
 *         description: SSE stream of AI response chunks
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *             example: |
 *               data: {"text":"For a 2019 Ford F-150..."}\n\n
 *               data: {"done":true}\n\n
 *       500:
 *         description: Streaming error event
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *             example: "data: {\"error\":\"Missing API key\"}\n\n"
 */
app.post("/api/chat", async (req, res) => {
  const { messages }: { messages: Message[] } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      stream: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ] as any,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      if (chunk.choices[0]?.finish_reason) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

// Serve static frontend in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`GARAGII API server running on http://localhost:${PORT}`);
});
