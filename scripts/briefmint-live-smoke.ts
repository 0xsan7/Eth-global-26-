import { getServerEnv } from "../src/lib/server/env";
import { createBriefInferenceProvider } from "../src/lib/server/brief-inference";

const AUTHORIZATION_FLAG = "--authorize-paid-inference";
const args = process.argv.slice(2);

if (args.length !== 1 || args[0] !== AUTHORIZATION_FLAG) {
  console.error(`Refusing to call inference. Re-run with the explicit ${AUTHORIZATION_FLAG} flag to authorize a potentially paid request.`);
  process.exit(2);
}

try {
  const env = getServerEnv();
  if (!env.inferenceKey || !env.modelId) {
    console.error("Refusing to call inference: ZERO_G_API_KEY is not configured.");
    process.exit(2);
  }

  const provider = createBriefInferenceProvider(env, fetch);
  await provider.assertReady();

  // Fixed synthetic content only; no CLI or environment supplied text is accepted.
  const { result, evidence } = await provider.compile(
    [{ id: "seg_001", text: "Synthetic public demo task: make a short checklist for labeling three sample folders." }],
    {
      title: "Synthetic folder checklist",
      summary: "A harmless synthetic example used only to verify provider wiring.",
      category: "writing",
      language: "en",
      budgetUsdCents: null,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      contactUrl: null,
    },
  );

  // Validate the provider's output locally, but never print model text or source content.
  const { modelResultSchema, validateModelResult } = await import("../src/lib/shared/briefs");
  validateModelResult(modelResultSchema.parse(result), [
    { id: "seg_001", text: "Synthetic public demo task: make a short checklist for labeling three sample folders." },
  ]);

  console.log(JSON.stringify({
    status: "completed",
    requestId: evidence.requestId,
    modelId: evidence.modelId,
    verificationStatus: evidence.independentResponseVerification,
    routerVerification: evidence.routerVerification,
  }));
} catch {
  // Error objects may contain provider diagnostics or echoed prompts; never print them.
  console.error("BriefMint inference smoke failed. Details were suppressed to protect credentials and private content.");
  process.exitCode = 1;
}
