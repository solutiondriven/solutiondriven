import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
const app = new Hono();

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const modelMap: Record<string, string> = {
  "gpt-4": "gpt-4o",
  "gpt-3.5-turbo": "gpt-4o-mini",
  "claude-3-opus": "gpt-4o",
  "claude-3-sonnet": "gpt-4o-mini",
  micromax: "gpt-4o-mini",
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-3e6a90b9/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/make-server-3e6a90b9/chat", async (c) => {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return c.json({ error: "OPENAI_API_KEY is not configured in Supabase secrets." }, 500);
  }

  const body = await c.req.json();
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: modelMap[body.model] || "gpt-4o-mini",
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.maxTokens ?? 500,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return c.json({ error: payload?.error?.message || "OpenAI chat request failed." }, response.status);
  }

  return c.json({
    reply: payload?.choices?.[0]?.message?.content || "No response generated",
  });
});

app.post("/make-server-3e6a90b9/analyze-chart", async (c) => {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return c.json({ error: "OPENAI_API_KEY is not configured in Supabase secrets." }, 500);
  }

  const body = await c.req.json();
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: "You are Micromax, an expert technical analyst. Analyze trading charts and provide detailed, actionable insights with specific entry/exit points, risk levels, and confidence scores.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                body.userQuery ||
                "Analyze this trading chart in detail. Identify patterns, support/resistance levels, trend direction, volume analysis, and provide specific trading recommendations with entry/exit points and risk management.",
            },
            {
              type: "image_url",
              image_url: {
                url: body.imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return c.json({ error: payload?.error?.message || "OpenAI chart analysis failed." }, response.status);
  }

  return c.json({
    analysis: payload?.choices?.[0]?.message?.content || "Analysis failed",
  });
});

Deno.serve(app.fetch);
