export type AvatarType = { contentType: "image/jpeg"; extension: "jpg" } | { contentType: "image/png"; extension: "png" };

export const AVATAR_TYPES: readonly AvatarType[] = [
  { contentType: "image/jpeg", extension: "jpg" },
  { contentType: "image/png", extension: "png" },
];

// The monolith's form said "Max size 50MB" but enforced nothing; 5 MB is plenty for a profile picture.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

// The type the file's own bytes say it is, so a renamed or mislabelled upload is caught.
export function detectAvatarType(bytes: Buffer): AvatarType | null {
  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return AVATAR_TYPES[1]!;
  if (bytes.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return AVATAR_TYPES[0]!;
  return null;
}

// Stored at the bucket root as {user_id}.{ext}, as in the monolith.
export const avatarPath = (userId: string, type: AvatarType) => `${userId}.${type.extension}`;
