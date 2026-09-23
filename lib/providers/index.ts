import { OpenRouterAdapter } from "./openrouter";
import type { ModelProviderAdapter } from "./types";

export function getProvider(): ModelProviderAdapter {
  return new OpenRouterAdapter(process.env.OPENROUTER_API_KEY);
}

/** What the UI needs to know: is a key configured, and which models can be chosen. */
export function providerStatus() {
  const provider = getProvider();
  const models = provider.configuredModels();
  return { provider: provider.providerId, configured: models.length > 0, models };
}

export * from "./types";
