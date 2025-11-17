"use server";

import { eq } from "drizzle-orm";

import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { NewUserModel } from "@/database/types";

import { CustomerNameAndPhone } from "@/app/orders/actions"



export interface CustomerInfo {
  id: string;
  email: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  phone: string | null;
  country: {
    id: string;
    name: string;
    abbreviation: string;
    currency: {
      id: string;
      code: string;
      exchangeRate: string;
      isActive: boolean;
      updatedAt: Date | string;
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
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  countryId: number | null;
  addressId: number | null;
}




export async function getAllUsers() {
  try {
    const allUsers = await db.select().from(users);
    return { success: true, data: allUsers };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

export async function getUserById(id: string) {
  if (!id) {
    return null;
  }
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        country: {
          with: {
            currency: true
          }
        },
        address: true
      }
    })
    return user;

  } catch (error) {
    console.error(`(server) Error fetching user by id: ${id}`, error);
    throw error;
  }
}

export async function getUserByUsername(username: string) {
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
}

export async function getUserByEmail(email: string) {
  try {
    const user = await db.select().from(users).where(eq(users.email, email));
    return user[0];

  } catch (error) {
    console.error("Error fetching user by email:", error);
    throw error;
  }
}

export async function getCostumerInfoByEmail(email: string): Promise<CustomerInfo | undefined> {
  try {
    // Get user with country and currency info
    const customerInfo = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true
      },
      with: {
        country: {
          columns: {
            id: true,
            name: true,
            abbreviation: true,
          },
          with: {
            currency: {
              columns: {
                id: true,
                code: true,
                exchangeRate: true,
                isActive: true,
                updatedAt: true
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
}

export async function createUser(user: NewUserModel) {
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
}


export async function saveCustomerNameAndPhone(customerInfo: CustomerNameAndPhone): Promise<void> {
  try {
    await db.update(users).set({
      firstName: customerInfo.firstName, 
      middleName: customerInfo.middleName,
      lastName: customerInfo.lastName,
      phone: customerInfo.phone
    })
    .where(eq(users.id, customerInfo.id));

  } catch (error) {
    console.error("(server) failed to save customer name and phone...", error);
    throw error;
  }
}

export async function deleteCustomerNameAndPhone(customerId: string) {
  try {
    await db.update(users).set({
      firstName: null,
      middleName: null,
      lastName: null,
      phone: null
    })
    .where(eq(users.id, customerId));
    
  } catch (error) {
    console.error("(server) failed to delete customer name and phone...", error);
    throw error;
  }
}

