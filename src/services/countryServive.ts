import { db } from "@/database/drizzle";
import { countries, users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { getUserById } from "./userService";



export interface Country {
    id: number;
    name: string;
    abbreviation: string;
    currency: {
        id: number;
        code: string;
        exchangeRate: number;
        isActive: boolean;
        updatedAt: Date | string;
    } 
}


export async function getAllCountries() {
    try {
        const allCountries = await db.query.countries.findMany();
        return allCountries;

    } catch (error) {
        console.error("(server) failed to get all countries...", error);
        throw error;
    }
}

export async function saveCustomerCountry(countryName: string, userUuid: string) {
    try {
        const formatCountryName = countryName.charAt(0).toUpperCase() + countryName.slice(1).toLowerCase();
        const foundCountry = await db.query.countries.findFirst({
            where: eq(countries.name, formatCountryName)
        })

        const userWithSavedCountry = await db.update(users).set({countryId: foundCountry?.id}).where(eq(users.id, userUuid));
        return userWithSavedCountry;

    } catch(error) {
        console.error("(server) Failed to save coutry to user...", error);
        throw error;
    }
}

export async function deleteCustomerCountry(userUuid: string) {
    try {
        const foundUser = await getUserById(userUuid);
        const countryAlreadySaved = foundUser?.countryId;
        if(!countryAlreadySaved) {
            return;
        }

        const deletedCountryFromUser = await db.update(users).set({countryId: null}).where(eq(users.id, userUuid));
        return deletedCountryFromUser;

    } catch(error) {
        console.error("(server) Failed to delete country from user...", error);
        throw error;
    }
}