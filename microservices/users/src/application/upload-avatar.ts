import { detectAvatarType } from "../domain/avatar.js";
import type { User } from "../domain/user.js";
import type { AvatarStorage } from "./ports/avatar-storage.js";
import type { UserStore } from "./ports/user-store.js";

export type UploadAvatarResult = { kind: "updated"; user: User } | { kind: "not_found" } | { kind: "unsupported" };

export type UploadAvatarDependencies = { users: UserStore; avatars: AvatarStorage };

export async function uploadAvatar(
  userId: string,
  contentType: string,
  bytes: Buffer,
  { users, avatars }: UploadAvatarDependencies,
): Promise<UploadAvatarResult> {
  const type = detectAvatarType(bytes);
  if (!type || type.contentType !== contentType) return { kind: "unsupported" };
  if (!(await users.findActive(userId))) return { kind: "not_found" };

  const url = await avatars.upload(userId, type, bytes);
  const user = await users.setAvatarUrl(userId, (version) => `${url}?v=${version}`);
  if (!user) {
    // Deleted while uploading: the account is being purged, so its picture must not stay behind.
    await avatars.remove(userId);
    return { kind: "not_found" };
  }
  return { kind: "updated", user };
}
