import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  defaultModel: "claude-3-haiku-20240307",
  maxTokens: {
    validation: 256,
    generation: 8192,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
};
