"use server"

import { AddressModel } from "@/database/types";

import { deleteBillingInfo, saveBillingInfo } from "@/services/addressService";
import { convertPrice } from "@/services/currencyService"
import { saveCustomerCountry, deleteCustomerCountry, getAllCountries } from "@/services/countryServive";

import { z } from "zod"

// import shippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm"
// z.infer<typeof shippingAndBillingForm>

export interface customerBillingDetails {
  firstName: string;
  middleName:  string | null;
  lastName:  string;
  email:  string;
  phone:  string | null;
  address:  string;
  city: string;
  postalCode:  string;
  country:  string;
  stateProvince:  string | null;
  shippingFirstName: string | null;
  shippingLastName: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  saveBillingInfo: string;
  customerId: string;
}

export async function submitOrderDetails(formData: customerBillingDetails) {

    const shouldSaveBillingInfo = formData.saveBillingInfo.toLowerCase() == "true" ? true : false;
    if (shouldSaveBillingInfo) {

        const billingInfo = {
            userId: formData.customerId,
            address1: formData.address,
            city: formData.city,
            zipCode: formData.postalCode,
            country: formData.country,
            stateProvince: formData?.stateProvince
        }
        await saveBillingInfo(billingInfo);
        await saveCustomerCountry(formData.country, formData.customerId);
       
    } else {
        await deleteBillingInfo(formData.customerId);
        await deleteCustomerCountry(formData.customerId);
    }

}

// {
//   firstName: '123',
//   middleName: '123',
//   lastName: '123',
//   email: 'chye0001@stud.ek.dk',
//   phone: '123',
//   address: '123',
//   city: '123',
//   postalCode: '123',
//   country: '123',
//   saveBillingInfo: 'true',
//   customerId: '7bf9f8fd-9653-4a3e-b737-2b4f083acd4a'
// }

// (parameter) billingInfo: {
//     id: number;
//     userId: string;
//     address1: string;
//     address2: string | null;
//     city: string;
//     zipCode: string;
//     stateProvince: string | null;
// }

export async function convertPriceAction(priceInDkkInCents: number, targetCountryCode: string) {
    try {
        const convertedPrice = await convertPrice(priceInDkkInCents, targetCountryCode);
        return convertedPrice;

    } catch (error) {
        throw error;
    }
}

export async function saveBillingInfoAction(billingInfo: AddressModel) {
    try {
        const savedBillingInfo = await saveBillingInfo(billingInfo);
        return savedBillingInfo;

    } catch (error) {
        throw error;
    }
}

export async function getAllCountriesNameAction(): Promise<string[]> {
    try{
        const allCountries = await getAllCountries();

        const countryNames = allCountries.map((country) => country.name);
        return countryNames;

    }catch(error) {
        throw error;
    }
}