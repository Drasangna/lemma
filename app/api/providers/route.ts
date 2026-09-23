import { providerStatus } from "@/lib/providers";
import { route } from "@/lib/http";

export const GET = route(async () => providerStatus());
