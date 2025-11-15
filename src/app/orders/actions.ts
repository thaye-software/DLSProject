"use server"

import { z } from "zod"

import { userService } from "@/services/userService";
import { convertPrice } from "@/services/currencyService"
import { deleteBillingAddress, saveBillingAddress } from "@/services/addressService";
import { saveCustomerCountry, deleteCustomerCountry, getAllCountries, Country } from "@/services/countryServive";

import { getUserLocation } from "@/lib/utils/serverutils/utils";

import { OrderStatus } from "./type";
import { Product } from "../watches/type";
import { createOrder } from "@/services/orderService";

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
  shippingStateProvince: string | null;

  saveBillingInfo: string;
  shippingSameAsBilling: string;
  customerId: string;
}

export interface Address {
    userId: string;
    address1: string;
    city: string;
    zipCode: string;
    country: string;
    stateProvince: string | null;
}

export interface CustomerNameAndPhone {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    phone: string | null;
}



export async function submitOrderDetails(formData: customerBillingDetails, product: Product, country: Country) {

    // const userGeoLocationData = await getUserLocation();
    // const countryCode = userGeoLocationData.countryCode;
    
    // return;
    // let customerCountry;
    // if(!country) {
    //     // customerCountry = await getCountryByCustomerId(formData.customerId);
    // }

    const billingAddress: Address = {
        userId: formData.customerId,
        address1: formData.address,
        city: formData.city,
        zipCode: formData.postalCode,
        country: formData.country,
        stateProvince: formData?.stateProvince
    }

    const shippingAddress: Address = {
        userId: formData.customerId,
        address1: formData.shippingAddress as string,
        city: formData.shippingCity as string,
        zipCode: formData.shippingPostalCode as string,
        country: formData.shippingCountry as string,
        stateProvince: formData?.shippingStateProvince as string
    }

    const customerInfo: CustomerNameAndPhone = {
        id: formData.customerId,
        firstName: formData.firstName, 
        middleName: formData.middleName || null,
        lastName: formData.lastName,
        phone: formData.phone || null
    }

    const orderDetails = {
        userId: formData.customerId,
        currencyId: country.currency.id,
        status: "PROCESSING",
        totalPriceDkk: String(product.priceDkk), // In cents
        totalPriceCurrency: String(Math.round(product.priceDkk * country.currency.exchangeRate)), // In cents
        deliveryAddressId: undefined,
        billingAddressId: undefined,
        createdAt: undefined, // this will be populated in db
        
        productId: product.id
    }


    try {
        const isShippingSameAsBilling = formData.shippingSameAsBilling.toLocaleLowerCase() == "true" ? true : false;
        const isSaveBillingAddress = formData.saveBillingInfo.toLowerCase() == "true" ? true : false;
        await updateBillingPreferences(formData, isSaveBillingAddress, billingAddress, customerInfo);
    
        if (!isShippingSameAsBilling) {
            await createOrder(orderDetails, billingAddress, shippingAddress);
        }
        
        await createOrder(orderDetails, billingAddress);

    } catch (error) {
        throw error;
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

// export async function saveBillingAddressAction(billingAddress: AddressModel) {
//     try {
//         const savedBillingAddress = await saveBillingAddress(billingAddress);
//         return savedBillingAddress;

//     } catch (error) {
//         throw error;
//     }
// }

export async function getAllCountriesNameAction(): Promise<string[]> {
    try{
        const allCountries = await getAllCountries();

        const countryNames = allCountries.map((country) => country.name);
        return countryNames;

    }catch(error) {
        throw error;
    }
}






//---------------------------------------------------- Helper functions ----------------------------------------------------

async function updateBillingPreferences(
    formData: customerBillingDetails, 
    isSaveBillingAddress: boolean, 
    billingAddress: Address, 
    customerInfo: CustomerNameAndPhone
): Promise<void> {

    if (isSaveBillingAddress) {
        await saveBillingAddress(billingAddress);
        await saveCustomerCountry(formData.country, formData.customerId);
        await userService.saveCustomerNameAndPhone(customerInfo);
    } else {
        await deleteBillingAddress(formData.customerId);
        await deleteCustomerCountry(formData.customerId);
        await userService.deleteCustomerNameAndPhone(customerInfo.id);
    }
}