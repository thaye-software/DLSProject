import type { User } from "../../src/domain/user.js";

export const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
export const OTHER_USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

export function aUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    username: "mette_j",
    email: "mette@example.com",
    firstName: "Mette",
    middleName: null,
    lastName: "Jensen",
    phone: "+45 26 46 95 96",
    countryCode: "DK",
    avatarUrl: null,
    role: "customer",
    address: {
      addressLine1: "Nørregade 12",
      addressLine2: null,
      city: "København K",
      zipCode: "1165",
      stateProvince: null,
    },
    version: 4,
    deletedAt: null,
    ...overrides,
  };
}

// The smallest valid files of each type: just their signatures.
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
export const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
