import { db, DbTransaction } from "@/database/drizzle";
import { addresses, users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { NewAddressModel, AddressModel } from "@/database/types";
import { BillingDetails } from "@/app/settings/actions";
import getCountryByName from "./countryService";

export async function saveBillingAddress(
  billingInfo: Omit<NewAddressModel, "id">
): Promise<Omit<AddressModel, "user"> | null> {
  try {
    const foundBillingAddress = await db.query.addresses.findFirst({
      where: eq(addresses.userId, billingInfo.userId),
    });

    if (foundBillingAddress) {
      return await updateBillingAddress(foundBillingAddress.id, billingInfo);
    }

    const savedBillingInfo = await db
      .insert(addresses)
      .values(billingInfo)
      .returning();
    await db
      .update(users)
      .set({ addressId: savedBillingInfo[0].id })
      .where(eq(users.id, billingInfo.userId));
    return savedBillingInfo[0];
  } catch (error) {
    console.error("(server) Error saving save billing info...", error);
    throw error;
  }
}






export async function updateBillingAddress(
  id: string,
  newBillingAddress: Omit<NewAddressModel, "id">
): Promise<Omit<AddressModel, "user"> | null> {
  try {
    const updatedBillingAddress = await db
      .update(addresses)
      .set(newBillingAddress)
      .where(eq(addresses.id, id))
      .returning();

    if (!updatedBillingAddress[0]) {
      return null;
    }

    return updatedBillingAddress[0];
  } catch (error) {
    console.error(`(server) failed to update billing address`, error);
    throw error;
  }
}

export async function updateBillingAddressByUserId(
  billingDetails: BillingDetails
) {

  try {
    const updatedBillingAddress = await db
      .update(addresses)
      .set({
        address1: billingDetails.address,
        address2: billingDetails.address2,
        city: billingDetails.city,
        zipCode: billingDetails.postalCode,
        stateProvince: billingDetails.stateProvince
      })
      .where(eq(addresses.userId, billingDetails.customerId))
      .returning();

    // if user has not save billing address before, create and save it.
    if (updatedBillingAddress.length === 0) {
      const transformedBillingDetails = transformBillingDetailsToNewAddressModel(billingDetails);
      saveBillingAddress(transformedBillingDetails);
    }



    const foundCountry = await getCountryByName(billingDetails.country);
    if(!foundCountry) return false;
    const updatedUser = await db
      .update(users)
      .set({
        firstName: billingDetails.firstName,
        middleName: billingDetails.middleName,
        lastName: billingDetails.lastName,
        phone: billingDetails.phone,
        email: billingDetails.email,
        countryId: foundCountry?.id
      })
      .where(eq(users.id, billingDetails.customerId))
      .returning();
    
    if(updatedUser.length === 0) return false;

    return true;

  } catch (error) {
    console.error(`(server) failed to update billing address for user with id: ${billingDetails.customerId}`, error);
    throw error;
  }
}






export async function deleteBillingAddress(userId: string): Promise<boolean> {
  try {
    const billingInfo = await db.query.addresses.findFirst({
      where: eq(addresses.userId, userId),
    });

    if (!billingInfo) {
      return false; // Nothing to delete
    }

    await db.delete(addresses).where(eq(addresses.userId, userId));
    await db.update(users).set({ addressId: null }).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error("(server) Error deleting billing info...", error);
    throw error;
  }
}

export async function deleteAddress(userId: string, tx?: DbTransaction) {
  try {
    const dbContext = tx || db;
    const softDeletedAddress = await dbContext
      .delete(addresses)
      .where(eq(addresses.userId, userId))
      .returning();

    return softDeletedAddress[0];

  } catch(error) {
    console.error(`(server) failed to soft delete user with id: ${userId}`, error);
    throw error;
  } 
}



//------------------------------------- helper function ------------------------------------- 
function transformBillingDetailsToNewAddressModel(billingDetails: BillingDetails): Omit<NewAddressModel, "id"> {
  return {
    userId: billingDetails.customerId,
    address1: billingDetails.address,
    city: billingDetails.city,
    zipCode: billingDetails.postalCode,
    address2: billingDetails.address2 || null,
    stateProvince: billingDetails.stateProvince || null
  }
}
