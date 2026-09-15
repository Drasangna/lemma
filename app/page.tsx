import { ResearchWorkspace } from "./research-workspace";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <ResearchWorkspace user={user ? { displayName: user.displayName, email: user.email } : null} />;
}
