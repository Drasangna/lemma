export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const LOCAL_USER: ChatGPTUser = {
  userId: "local-owner",
  displayName: "Researcher",
  email: "researcher@localhost",
  fullName: null,
};

export async function getChatGPTUser(): Promise<ChatGPTUser> {
  return LOCAL_USER;
}

export const requireChatGPTUser = getChatGPTUser;
