import { db } from "@/database/drizzle";
import { addresses, users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { NewAddressModel, AddressModel } from "@/database/types";

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
