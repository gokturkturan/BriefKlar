import "../config/env";
import { prisma } from "../lib/prisma";
import { priceOf } from "../llm/pricing";

/**
 * Sets the cost of every logged LLM call from the current price table. Run it after a change
 * to the prices, and once for calls logged before costs were recorded:
 * npm run llm:reprice -w @briefklar/api
 */
async function main() {
  const models = await prisma.llmCall.groupBy({ by: ["model"], _count: { _all: true } });

  for (const { model, _count } of models) {
    const price = priceOf(model);
    if (!price) {
      console.warn(`No price for ${model}: ${_count._all} call(s) keep their cost`);
      continue;
    }
    const updated = await prisma.$executeRaw`
      UPDATE "LlmCall"
      SET "costUsd" = round(("inputTokens" * ${price.inputPerMillion}::numeric
                           + "outputTokens" * ${price.outputPerMillion}::numeric) / 1000000, 6)
      WHERE model = ${model}`;
    console.log(`${model}: ${updated} call(s) repriced`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
