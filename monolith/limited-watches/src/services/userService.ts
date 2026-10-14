"use server";

import { eq } from "drizzle-orm";

import { db, DbTransaction } from "@/database/drizzle";
import { orders, users } from "@/database/schema";
import { NewUserModel, UserModel } from "@/database/types";
import { createClient } from "@/lib/supabase/server";

import { CustomerNameAndPhone } from "@/app/orders/actions"
import { SupabaseClient } from "@supabase/supabase-js";
import { deleteAddress } from "./addressService";
import { deleteFavorites } from "./favoriteService";
import { deleteOrderAddresses } from "./orderAddressService";
import { baseUrl } from "@/lib/utils/client/utils";



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

// users/customer who have completed orders
export async function getAllUniqueCustomers() {
  const customers = await db.query.users.findMany({
    where: eq(users.role, "customer"),
    with: {
      orders: {
        where: eq(orders.status, "DELIVERED"),
      },
    },
  });

  return customers.filter(c => c.orders.length > 0).length;
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
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      {
        emailRedirectTo: `${baseUrl}/confirm-email-change`
      }
    );

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

//this actually also "creates a new" upload avatar, always overwrites the old one.
export async function changeAvatar(userId: string, newAvatarUrl: string) {
  try {
    const updatedUser = await db
      .update(users)
      .set({avatarUrl: newAvatarUrl})
      .where(eq(users.id, userId))
      .returning();

    if(updatedUser.length === 0 || updatedUser.length > 1) {
      throw new Error("(server) failed to update user, or updated multple users");
    }

    return updatedUser[0];

  } catch (error) {
    console.error("(server) failed to save new avatar url", error)
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

export async function softDeleteAccount(userId: string) {
  try {
    const supabase = await createClient();
    
    const result = await db.transaction(async (tx) => {
    
      const userToDelete = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!userToDelete) {
        throw new Error(`User not found with id: ${userId}`);
      }

      await nukeUserDependencies(userToDelete, supabase, tx);
      
      return true;
    })

    return result;

  } catch (error) {
    console.error(`Failed to delete account for user ${userId}:`, error);
    throw error;
  }
}

export async function deleteAvatar(userToDelete: UserModel, supabase: SupabaseClient) {
  try{

    const fileExtention = extractExtension(userToDelete.avatarUrl as string);
 
    const fileName = `${userToDelete.id}.${fileExtention}`;
    const { error } = await supabase.storage
      .from("avatars")
      .remove([fileName]);
    
    if (error) {
      console.error("Failed to delete avatar:", error);
      throw new Error("Failed to delete avatar");
    }

  } catch (error) {
    console.error("(server) failed to delete avatar from supabase buckets", error);
    throw error;
  }
}

async function softDeleteUser(userId: string, tx?: DbTransaction) {
  try {
    const dbContext = tx || db;
    const softDeletedUser = await dbContext
      .update(users)
      .set({
        username: `deleted_${userId}`,
        firstName: "deleted",
        middleName: "deleted",
        lastName: "deleted",
        phone: "deleted",
        email: `deleted_${userId}@deleted.com`,
        avatarUrl: "deleted",
        countryId: null,
        deletedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return softDeletedUser;

  } catch(error) {
    console.error(`(server) failed to soft delete user with id: ${userId}`, error);
    throw error;
  } 
}

async function deleteSupabaseAuthUser(userId: string, supabase: SupabaseClient) {
  try {
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error("Failed to delete supabase auth user:", authError);
      throw authError;
    }

  }catch(error) {
    console.error(`(server) failed to delete supabase auth user`, error); 
    throw error;
  }
}

async function nukeUserDependencies(userToNuke: UserModel, supabase: SupabaseClient, tx: DbTransaction) {
  try {
    const userId = userToNuke.id;
    
    await softDeleteUser(userId, tx);
    await deleteAddress(userId, tx);
    await deleteFavorites(userId, tx);
    await deleteOrderAddresses(userId, tx);
    
    await deleteSupabaseAuthUser(userId, supabase)

    if (userToNuke.avatarUrl) {
      await deleteAvatar(userToNuke, supabase)
    }
    
  } catch(error) {
    console.error(`(server) failed to nuke user dependencies`, error);
    throw error;
  }
} 








//----------------------------- helper function -----------------------------
function extractExtension(url: string): string | null {
  // Get the part before any query parameters ex: https://jnthehekxywelxnpuplb.supabase.co/storage/v1/object/public/avatars/4ffb1ffc-6ce3-4f31-b42a-03805a0032f5.jpg?updated=1764431609344
  const cleanUrl = url.split("?")[0];
  const fileExtention = cleanUrl.split(".").pop()?.toLowerCase();

  const supportedExtentions = ["jpg", "jpeg", "png"];

  const extractedExtension = supportedExtentions.includes(fileExtention as string) ? fileExtention as string : null;
  return extractedExtension;
}