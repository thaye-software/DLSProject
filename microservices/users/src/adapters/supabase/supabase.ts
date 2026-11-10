import { createClient, isAuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import type { AvatarStorage } from "../../application/ports/avatar-storage.js";
import type { IdentityProvider } from "../../application/ports/identity-provider.js";
import { AVATAR_TYPES, avatarPath, type AvatarType } from "../../domain/avatar.js";

export type SupabaseOptions = { url: string; serviceRoleKey: string; avatarBucket: string };

// The service-role key bypasses row-level security, so it lives only here, never in the frontend.
export function createSupabaseAdmin({ url, serviceRoleKey }: SupabaseOptions): SupabaseClient {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class SupabaseIdentityProvider implements IdentityProvider {
  constructor(private readonly client: SupabaseClient) {}

  async setDisplayName(userId: string, displayName: string): Promise<void> {
    // Supabase merges user_metadata keys, so other metadata stays.
    const { error } = await this.client.auth.admin.updateUserById(userId, { user_metadata: { display_name: displayName } });
    if (error) throw error;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error && !(isAuthApiError(error) && error.status === 404)) throw error;
  }
}

export class SupabaseAvatarStorage implements AvatarStorage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
  ) {}

  async upload(userId: string, type: AvatarType, bytes: Buffer): Promise<string> {
    const path = avatarPath(userId, type);
    const storage = this.client.storage.from(this.bucket);
    const { error } = await storage.upload(path, bytes, { contentType: type.contentType, cacheControl: "3600", upsert: true });
    if (error) throw error;

    // A PNG replacing a JPEG (or the other way round) would otherwise leave the old file behind.
    const others = AVATAR_TYPES.filter((other) => other.extension !== type.extension).map((other) => avatarPath(userId, other));
    const { error: removeError } = await storage.remove(others);
    if (removeError) console.warn(`Could not remove the previous avatar of user ${userId}`, removeError);

    return storage.getPublicUrl(path).data.publicUrl;
  }

  async remove(userId: string): Promise<void> {
    // Removing paths that do not exist is not an error in Supabase Storage.
    const { error } = await this.client.storage.from(this.bucket).remove(AVATAR_TYPES.map((type) => avatarPath(userId, type)));
    if (error) throw error;
  }
}

// IDENTITY_PROVIDER=fake: for the CI security scan and local runs without a Supabase project.
export class FakeIdentityProvider implements IdentityProvider {
  async setDisplayName(userId: string, displayName: string): Promise<void> {
    console.log(`[fake identity] display_name of ${userId} is now ${displayName}`);
  }

  async deleteUser(userId: string): Promise<void> {
    console.log(`[fake identity] deleted Supabase user ${userId}`);
  }
}

export class FakeAvatarStorage implements AvatarStorage {
  constructor(private readonly baseUrl: string) {}

  async upload(userId: string, type: AvatarType): Promise<string> {
    return `${this.baseUrl}/storage/v1/object/public/avatars/${avatarPath(userId, type)}`;
  }

  async remove(): Promise<void> {}
}
