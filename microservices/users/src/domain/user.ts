export type Role = "customer" | "admin";

// The user's one saved billing address. The country is the profile's countryCode.
export type UserAddress = {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  zipCode: string;
  stateProvince: string | null;
};

export type User = {
  // The Supabase Auth user's id.
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  phone: string | null;
  // ISO 3166-1 alpha-2
  countryCode: string | null;
  avatarUrl: string | null;
  role: Role;
  address: UserAddress | null;
  // Aggregate version, +1 on every change (user_deleted.data.version).
  version: number;
  deletedAt: Date | null;
};

export type ProfileChanges = Partial<Pick<User, "username" | "firstName" | "middleName" | "lastName" | "phone" | "countryCode">>;

// The monolith's RegisterSchema (limited-watches/src/app/login/validation.ts).
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

// What a deleted account keeps: its id (other services and statistics refer to it), role and version.
// Every personal field is cleared; username and email stay unique so the constraints keep holding.
export type AnonymisedProfile = Omit<User, "id" | "role" | "address" | "version" | "deletedAt">;

export function anonymisedProfile(userId: string): AnonymisedProfile {
  return {
    username: `deleted_${userId}`,
    // .invalid is reserved (RFC 2606), so mail to it can never reach anyone.
    email: `deleted_${userId}@deleted.invalid`,
    firstName: null,
    middleName: null,
    lastName: null,
    phone: null,
    countryCode: null,
    avatarUrl: null,
  };
}
