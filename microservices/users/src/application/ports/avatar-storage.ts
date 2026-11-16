import type { AvatarType } from "../../domain/avatar.js";

// Supabase Storage, bucket avatars.
export type AvatarStorage = {
  // Stores the image as the user's only avatar and returns its public URL.
  upload(userId: string, type: AvatarType, bytes: Buffer): Promise<string>;
  // Removes every avatar file of the user; resolves when there was none.
  remove(userId: string): Promise<void>;
};
