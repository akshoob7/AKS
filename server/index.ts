import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are GARAGII, an expert AI assistant specializing exclusively in garages and car parts. You help users with:

- Car parts (engines, brakes, suspension, exhaust, electrical, transmission, etc.)
- Garage setup, tools, and equipment
- Car maintenance and DIY repairs
- Sourcing and pricing auto parts
- Diagnosing car problems and fault codes

If a user asks about anything outside of garages and car parts, politely decline and let them know you only cover automotive and garage topics. Keep responses concise, practical, and helpful.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

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
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`GARAGII API server running on http://localhost:${PORT}`);
});
