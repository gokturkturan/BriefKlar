import "dotenv/config";
import { z } from "zod";

const PROVIDERS = ["gemini", "anthropic", "openai"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    UPLOAD_DIR: z.string().default("./uploads"),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),

    // Which provider answers, which one takes over when it is down, and which one embeds the
    // knowledge base. Changing the embedding provider requires running knowledge:seed again.
    LLM_PROVIDER: z.enum(PROVIDERS).default("gemini"),
    LLM_FALLBACK_PROVIDER: z.union([z.enum(PROVIDERS), z.literal("")]).default(""),
    LLM_EMBEDDING_PROVIDER: z.enum(PROVIDERS).optional(),

    // Gemini. Model names change often, so the model is configuration, not code
    GEMINI_API_KEY: z.string().default(""),
    GEMINI_MODEL: z.string().default("gemini-flash-latest"),
    // Optional: used when the main model is overloaded (503) or rate limited (429). Empty = disabled.
    GEMINI_FALLBACK_MODEL: z.string().default("gemini-flash-lite-latest"),
    GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),

    // Claude (Anthropic). Anthropic has no embedding model.
    ANTHROPIC_API_KEY: z.string().default(""),
    ANTHROPIC_MODEL: z.string().default("claude-haiku-5-5"),
    ANTHROPIC_FALLBACK_MODEL: z.string().default(""),

    // OpenAI
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_MODEL: z.string().default("gpt-6-luna"),
    OPENAI_FALLBACK_MODEL: z.string().default(""),
    OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  })
  .transform((env) => ({
    ...env,
    // Without a choice, the main provider embeds; Anthropic cannot, so OpenAI does it then
    LLM_EMBEDDING_PROVIDER:
      env.LLM_EMBEDDING_PROVIDER ?? (env.LLM_PROVIDER === "anthropic" ? "openai" : env.LLM_PROVIDER),
  }))
  .superRefine((env, ctx) => {
    if (env.LLM_EMBEDDING_PROVIDER === "anthropic") {
      ctx.addIssue({ code: "custom", path: ["LLM_EMBEDDING_PROVIDER"], message: "Anthropic has no embedding model" });
    }
    const used = new Set([env.LLM_PROVIDER, env.LLM_FALLBACK_PROVIDER, env.LLM_EMBEDDING_PROVIDER]);
    const keys = { gemini: "GEMINI_API_KEY", anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" } as const;
    for (const provider of PROVIDERS) {
      if (used.has(provider) && !env[keys[provider]]) {
        ctx.addIssue({ code: "custom", path: [keys[provider]], message: `Needed for the ${provider} provider` });
      }
    }
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
