import { OpenRouterAdapter } from "./openrouter";
import type { ModelProviderAdapter } from "./types";

export function getProvider(): ModelProviderAdapter {
  return new OpenRouterAdapter(process.env.OPENROUTER_API_KEY);
}
export function providerCatalog() {
  const adapter = getProvider();
  return [{ id: adapter.providerId, configured: adapter.configuredModels().length > 0, capabilities: adapter.capabilities, models: adapter.configuredModels() }];
}
export * from "./types";
