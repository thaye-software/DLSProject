"use server";

import { db } from "@/database/drizzle";
import { countries, users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { getUserById } from "./userService";
import { CountryModel } from "@/database/types";

export default async function getCountryByName(name: string): Promise<Omit<CountryModel, "currency"> | null> {
    try {
        const foundCountry = await db.query.countries.findFirst({
            where: eq(countries.name, name)
        });
        return foundCountry || null;
        
    } catch(error) {
        console.error(`(server) failded to get country from databse with name: ${name}`, error);
        throw error;
    }
}

export async function getAllCountries(): Promise<CountryModel[]> {
    try {
      const allCountries = await db.query.countries.findMany({
        with: {
          currency: true
        }
        });
        return allCountries;

    } catch (error) {
        console.error("(server) failed to get all countries...", error);
        throw error;
    }
}

export async function saveCustomerCountry(countryName: string, userUuid: string): Promise<void> {
    try {
        const formatCountryName = countryName.charAt(0).toUpperCase() + countryName.slice(1).toLowerCase();
        const foundCountry = await db.query.countries.findFirst({
            where: eq(countries.name, formatCountryName)
        })

        await db.update(users).set({countryId: foundCountry?.id}).where(eq(users.id, userUuid));

    } catch(error) {
        console.error("(server) Failed to save coutry to user...", error);
        throw error;
    }
}

export async function deleteCustomerCountry(userUuid: string): Promise<void> {
    try {
        const foundUser = await getUserById(userUuid);
        const countryAlreadySaved = foundUser?.countryId;
        if(!countryAlreadySaved) {
            return;
        }

        await db.update(users).set({countryId: null}).where(eq(users.id, userUuid));

    } catch(error) {
        console.error("(server) Failed to delete country from user...", error);
        throw error;
    }
}

export async function getCountryVATByCode(countryCode: string): Promise<number> {
    try {
        const foundCountry = await db.query.countries.findFirst({
            where: eq(countries.abbreviation, countryCode.toUpperCase())
        });

        if(!foundCountry) {
            throw new Error(`Country with code ${countryCode} not found`);
        }

        return foundCountry.vatRate;

    } catch(error) {
        console.error(`(server) failded to get country VAT from databse with code: ${countryCode}`, error);
        throw error;
    }
}