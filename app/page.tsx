import { getLocalUser } from "@/lib/local-user";
import { ResearchWorkspace } from "./research-workspace";

export const dynamic = "force-dynamic";

export default function Home() {
  const { displayName, email } = getLocalUser();
  return <ResearchWorkspace user={{ displayName, email }} />;
}
