import { z } from "zod";
import type { ProfileChanges, User, UserAddress } from "../../domain/user.js";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "../../domain/user.js";

// Request schemas mirror docs/contracts/openapi.yaml (CreateUserRequest, UserProfileUpdate, UserAddressInput).
// Error messages are the monolith's (limited-watches/src/app/login/validation.ts).
export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(USERNAME_PATTERN, "Only letters, numbers, underscores, dashes and dots are allowed");

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const clearableText = (maxLength: number) => text(maxLength).nullable().optional();
const countryCode = z.string().regex(/^[A-Z]{2}$/, "Must be an ISO 3166-1 alpha-2 code, e.g. DK");
// An empty optional address line means "none".
const optionalLine = z.string().trim().max(255).nullable().optional().transform((value) => value || null);

export const createUserRequestSchema = z.strictObject({ username: usernameSchema });

export const usernameQuerySchema = z.object({ username: usernameSchema });

export const updateProfileRequestSchema = z
  .strictObject({
    username: usernameSchema.optional(),
    first_name: clearableText(255),
    middle_name: clearableText(255),
    last_name: clearableText(255),
    phone: clearableText(20),
    country_code: countryCode.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Send at least one field to change");

export const addressRequestSchema = z.strictObject({
  address_line_1: text(255),
  address_line_2: optionalLine,
  city: text(255),
  zip_code: text(50),
  state_province: optionalLine,
});

// The parts of Supabase's database webhook payload Users reads; the record carries many more columns.
export const supabaseUpdateWebhookSchema = z.object({
  type: z.literal("UPDATE"),
  table: z.literal("users"),
  schema: z.literal("auth"),
  record: z.looseObject({ id: z.uuid(), email: z.string().nullish() }),
  old_record: z.looseObject({ email: z.string().nullish() }),
});

export function toProfileChanges(body: z.infer<typeof updateProfileRequestSchema>): ProfileChanges {
  const changes: ProfileChanges = {};
  if (body.username !== undefined) changes.username = body.username;
  if (body.first_name !== undefined) changes.firstName = body.first_name;
  if (body.middle_name !== undefined) changes.middleName = body.middle_name;
  if (body.last_name !== undefined) changes.lastName = body.last_name;
  if (body.phone !== undefined) changes.phone = body.phone;
  if (body.country_code !== undefined) changes.countryCode = body.country_code;
  return changes;
}

export function toAddress(body: z.infer<typeof addressRequestSchema>): UserAddress {
  return {
    addressLine1: body.address_line_1,
    addressLine2: body.address_line_2,
    city: body.city,
    zipCode: body.zip_code,
    stateProvince: body.state_province,
  };
}

export function userJson(user: User) {
  return {
    user_id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.firstName,
    middle_name: user.middleName,
    last_name: user.lastName,
    phone: user.phone,
    country_code: user.countryCode,
    avatar_url: user.avatarUrl,
    role: user.role,
    address: user.address && {
      address_line_1: user.address.addressLine1,
      address_line_2: user.address.addressLine2,
      city: user.address.city,
      zip_code: user.address.zipCode,
      state_province: user.address.stateProvince,
    },
    version: user.version,
  };
}

export function internalUserJson(user: User) {
  return { user_id: user.id, role: user.role, deleted: user.deletedAt !== null };
}
