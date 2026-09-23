/**
 * Lemma is a single-user local app, so there is no sign-in. Every record is still scoped to an
 * `ownerId` so that adding real accounts later only means changing this file.
 */
export type LocalUser = { userId: string; displayName: string; email: string };

const LOCAL_USER: LocalUser = {
  userId: "local-owner",
  displayName: "Researcher",
  email: "researcher@localhost",
};

export const getLocalUser = () => LOCAL_USER;
