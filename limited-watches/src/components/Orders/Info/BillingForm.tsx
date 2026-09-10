"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { BillingDetails, updateBillingInfo } from "@/app/settings/actions";

import { CustomerInfo } from "@/services/userService";
import { getAllCountries } from "@/services/countryService";

import { CountryModel } from "@/database/types";



export default function BillingForm({customer, customerGeoLocation}: {customer: CustomerInfo, customerGeoLocation: string}) {

    const [customerToUpdate, setCustomerUpdated] = useState(customer);
    
    const [countries, setCountries] = useState<CountryModel[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<CountryModel | null>(
        null
    );

    const [isSavingChanges, setIsSavingChanges] = useState<boolean>(false);
    const [isBillingInfoSaved, setIsBillingInfoSaved] = useState<boolean>(
        customerToUpdate?.country != null && customerToUpdate?.address != null
    );




    useEffect(()=> {
        async function getCountries() {
            const allCountries: CountryModel[] = await getAllCountries();
            setCountries(allCountries);

            const foundCountry = allCountries.find(
                (country) => country.abbreviation === customerGeoLocation
            );
            if (foundCountry) setSelectedCountry(foundCountry);
        }
        getCountries();
    }, [])



    async function handleSubmit(event: any) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const data = Object.fromEntries(formData.entries());

        data.customerId = customerToUpdate.id;

        try {
            setIsSavingChanges(true);
            //@ts-ignore
            const success = await updateBillingInfo(data as BillingDetails);
            if(success) {
                toast.success("Changes have been saved.");
            }
        } catch (error) {
            //@ts-ignore
            toast.error(error.message);

        } finally {
            setIsSavingChanges(false);
        }
    }



    return(
        <form onSubmit={handleSubmit}>
            <div className="space-y-8">
                {/* Billing Address */}
                <Card className="p-6">
                    <h2 className="flex gap-2 items-center text-xl font-semibold text-foreground mb-6">
                        <FileText/> Billing Address
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name*</Label>
                            {/* {form.formState.errors.firstName && (
                                                        <p className="text-red-500 text-sm">
                                                            {form.formState.errors.firstName.message}
                                                        </p>
                                                    )} */}
                            {/* {...form.register("firstName")} */}
                            <Input
                            id="firstName"
                            name="firstName"
                            placeholder="your first name"
                            defaultValue={
                                isBillingInfoSaved &&
                                customerToUpdate.firstName != null
                                ? customerToUpdate.firstName
                                : undefined
                            }
                            required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="middleName">
                            Middle Name (Optional)
                            </Label>
                            <Input
                            id="middleName"
                            name="middleName"
                            placeholder="your middle name"
                            defaultValue={
                                isBillingInfoSaved &&
                                customerToUpdate.middleName != null
                                ? customerToUpdate.middleName
                                : undefined
                            }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name*</Label>
                            <Input
                            id="lastName"
                            name="lastName"
                            placeholder="your last name"
                            defaultValue={
                                isBillingInfoSaved &&
                                customerToUpdate.lastName != null
                                ? customerToUpdate.lastName
                                : undefined
                            }
                            required
                            />
                        </div>
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="email">Email*</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="your email"
                            defaultValue={customerToUpdate?.email}
                            required
                        />
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number (optional)</Label>
                        <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            placeholder="+45 26 46 95 96"
                            defaultValue={
                            isBillingInfoSaved && customerToUpdate.phone != null
                                ? customerToUpdate.phone
                                : undefined
                            }
                        />
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="address">Street Address*</Label>
                        <Input
                            id="address"
                            name="address"
                            placeholder="123 Main Street"
                            defaultValue={
                            isBillingInfoSaved &&
                            customerToUpdate.address?.address1 != null
                                ? customerToUpdate.address.address1
                                : undefined
                            }
                            required
                        />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="city">City*</Label>
                            <Input
                            id="city"
                            name="city"
                            placeholder="Copenhagen"
                            defaultValue={
                                isBillingInfoSaved &&
                                customerToUpdate.address?.city != null
                                ? customerToUpdate.address.city
                                : undefined
                            }
                            required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="postalCode">Postal Code*</Label>
                            <Input
                            id="postalCode"
                            name="postalCode"
                            placeholder="2300"
                            defaultValue={
                                isBillingInfoSaved &&
                                customerToUpdate.address?.zipCode != null
                                ? customerToUpdate.address.zipCode
                                : undefined
                            }
                            required
                            />
                        </div>
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="country">Country*</Label>
                        <select
                            id="country"
                            name="country"
                            required
                            value={
                            selectedCountry?.name ??
                            (isBillingInfoSaved && customerToUpdate.country?.name
                                ? customerToUpdate.country.name
                                : "")
                            }
                            onChange={async (e) => {
                                const name = e.target.value;
                                const found =
                                    countries.find((c) => c.name === name) || null;
                                setSelectedCountry(found);
                                // update the customerUpdated so the form reflects the user's selection when submitted
                                if (found)
                                    setCustomerUpdated((prev) => ({
                                    ...prev,
                                    country: found,
                                }));
                                
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="" disabled>
                                Select a country
                            </option>

                            {countries.map((country) => (
                            <option key={country.name} value={country.name}>
                                {country.name}
                            </option>
                            ))}
                        </select>
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="stateProvince">
                            State Province (optional)
                        </Label>
                        <Input
                            id="stateProvince"
                            name="stateProvince"
                            placeholder="Hovedstaden"
                            defaultValue={
                            isBillingInfoSaved &&
                            customerToUpdate.address?.stateProvince != null
                                ? customerToUpdate.address.stateProvince
                                : undefined
                            }
                        />
                        </div>
                    </div>
                </Card>
            </div>

            {isSavingChanges ? (
                <Button className="w-full mt-6" size="lg" disabled>
                Saving changes... <Spinner />
                </Button>
            ) : (
                <Button className="w-full mt-6" size="lg">
                Save
                </Button>
            )}
            
        </form>
    );
}
