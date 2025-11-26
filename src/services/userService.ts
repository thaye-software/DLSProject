"use server";

import { eq } from "drizzle-orm";

import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { NewUserModel } from "@/database/types";

import { CustomerNameAndPhone } from "@/app/orders/actions"
import { createClient } from "@/database/supabase/server";



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
    return;  // temporary stopped constant errors
    throw new Error("User ID is required");
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

export async function getCustomerInfoByEmail(email: string): Promise<CustomerInfo | undefined> {
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







export async function changeUsername(userId: string, newUsername: string) {
  try {
    const updatedLimitedWatchesUser = await db
      .update(users)
      .set({username: newUsername})
      .where(eq(users.id, userId))
      .returning();

    if(!updatedLimitedWatchesUser[0]) {
      throw new Error(`(server) failed to update username for user with id: ${userId} for the limited watches user table`);
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: newUsername }
    });
    const updatedAuthUser = data.user;

    if(error) {
      console.error(`(server) failed to update username/display_name for supabase auth user`, error);
      throw error;
    }

    return {updatedLimitedWatchesUser, updatedAuthUser};

  } catch(error) {
    console.error(`(server) failed to upadte customer username to: ${newUsername}`, error);
  }
}

export async function initiateEmailChange(userId: string, newEmail: string) {
  try {
    const supabase = await createClient();
    
    // This sends a confirmation email to the NEW email address
    // Once email gets confirmed the new email will get synced with public.users ie. limitecwatches users table
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    });

    if (error) {
      console.error(`(server) failed to initiate email change for auth user: ${userId}`, error);
      throw error;
    }

    return true;
    
  } catch (error) {
    console.error(`(server) failed to initiate email change for user: ${userId}`, error);
    throw error;
  }
}

export async function changePassword(newPassword: string) {
  try{
    const supabase = await createClient();
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    const updatedAuthUser = data.user;

    if(error) {
      console.error(`(server) error happen on the side of supabase, could not change password`);
      throw error;
    }
    
    return updatedAuthUser;
    
  }catch (error) {
    console.error(`(server) failed to change password`, error);
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

export async function deleteAccount(userId: string): Promise<boolean> {
  try {
    const deletedLimitedWatchesUser = await db.delete(users).where(eq(users.id, userId)).returning();
    if(deletedLimitedWatchesUser.length === 0) {
      throw new Error(`(server) could not delete limited watches user, since no user with that id: ${userId}`);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if(error) {
      console.error(`(server) could not delete auth users, potentially could not find user with id: ${userId}`, error);
      throw error;
    }

    return true;

  } catch(error) {
    console.error(`(server) failed to delete account for user with id: ${userId}`, error);
    throw error;
  }
}

