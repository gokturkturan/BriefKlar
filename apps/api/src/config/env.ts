import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  UPLOAD_DIR: z.string().default("./uploads"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().min(1, "Create a key at https://aistudio.google.com"),
  // Model names change often, so the model is configuration, not code
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  // Optional: used when the main model is overloaded (503) or rate limited (429). Empty = disabled.
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-flash-lite-latest"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
