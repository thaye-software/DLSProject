import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { UserModel, NewUserModel } from "@/database/types";

export interface CustomerInfo {
  id: number;
  email: string;
  country: {
    id: number;
    name: string;
    abbreviation: string;
    currency: {
      code: string;
    }
  } | null;
  address: {
    address1: string;
    address2: string | null;
    city: string;
    zipCode: string;
    stateProvince: string | null;
  } | null;
} 

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  avatarUrl: string | null;
  emailConfirmed: boolean;
  role: string;
  countryId: number | null;
  addressId: number | null;
}

export const userService = {
  async getAllUsers() {
    try {
      const allUsers = await db.select().from(users);
      return { success: true, data: allUsers };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { success: false, error: "Failed to fetch users" };
    }
  },

  async getUserById(id: number) {
    try {
      const user = await db.select().from(users).where(eq(users.id, id));
      return { success: true, data: user[0] || null };
    } catch (error) {
      console.error("Error fetching user:", error);
      return { success: false, error: "Failed to fetch user" };
    }
  },

  async getUserByUsername(username: string) {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      return { success: true, data: user[0] || null };
    } catch (error) {
      console.error("Error fetching user by username:", error);
      return { success: false, error: "Failed to fetch user by username" };
    }
  },

  async getUserByEmail(email: string): Promise<User> {
    try {
      const user = await db.select().from(users).where(eq(users.email, email));
      return user[0];

    } catch (error) {
      console.error("Error fetching user by email:", error);
      throw error;
    }
  },

  async getCostumerInfoByEmail(email: string): Promise<CustomerInfo | undefined> {
    try {
      // Get user with country and currency info
      const customerInfo = await db.query.users.findFirst({
        where: eq(users.email, email),
        columns: {
          id: true,
          email: true,
        },
        with: {
          country: {
            columns: {
              id: true,
              name: true,
              abbreviation: true,
            },
            with: {
              currency: { // ✅ Now you can nest currency
                columns: {
                  code: true,
                },
              },
            },
          },
          address: {
            columns: {
              address1: true,
              address2: true,
              city: true,
              zipCode: true,
              stateProvince: true,
            },
          },
        },
      })

      return customerInfo;

    }catch(error) {
      console.error(error)
      throw error;
    }
  },

  async createUser(user: NewUserModel) {
    // check if user with the same username already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, user.username));

    if (existingUser.length > 0) {
      return {
        success: false,
        error: "User with the same username already exists",
      };
    }
    // check if user with the same email already exists
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email));

    if (existingEmail.length > 0) {
      return {
        success: false,
        error: "User with the same email already exists",
      };
    }

    try {
      const newUser = await db.insert(users).values(user).returning();
      return { success: true, data: newUser };
    } catch (error) {
      console.error("Error creating user:", error);
      return {
        success: false,
        error: "Something went wrong. please try again.",
      };
    }
  },
} as const;
