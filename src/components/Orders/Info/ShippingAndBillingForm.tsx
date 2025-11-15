"use client"

import Image from "next/image";
import { useEffect, useState } from "react";

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CustomerInfo } from "@/services/userService";
import ToastWrapper from "@/components/Toast/ToastWrapper";

import { Product } from "@/app/watches/type";
import { getAllCountriesNameAction, submitOrderDetails } from "@/app/orders/actions";

import { getProductBySlug } from "@/services/productService"
import { Spinner } from "@/components/ui/spinner";
import { convertPriceAction } from "@/app/orders/actions";
import SaveBillingInfoCheckBox from "./SaveBillingInfoCheckBox";
import { watch } from "fs";





// export const shippingAndBillingForm = z.object({
// 	firstName: z.string().nonempty("Your first name is required"),
// 	middleName: z.string().optional(),
// 	lastName: z.string().nonempty("Your last name is required"),

// 	email: z.email().nonempty("Your email is required"),
// 	phone: z.string().optional().refine((val) => !val || /^[+\d\s-]{6,20}$/.test(val), {
// 		message: "Invalid phone number format",
// 	}),

// 	address: z.string().nonempty("Your address is required"),
// 	city: z.string().nonempty("Your city is required"),
// 	postalCode: z.string().nonempty("Your postal code is required"),
// 	country: z.string().nonempty("Your country is required"),
	
// 	// shipping
// 	shippingFirstName: z.string().optional(),
// 	shippingMiddleName: z.string().optional(),
// 	shippingLastName: z.string().optional(),
// 	shippingAddress: z.string().optional(),
// 	shippingCity: z.string().optional(),
// 	shippingPostalCode: z.string().optional(),
// 	shippingCountry: z.string().optional(),
// })



	// const form = useForm<z.infer<typeof shippingAndBillingForm>>({
	// 	resolver: zodResolver(shippingAndBillingForm),
	// 	defaultValues: {
	// 		firstName: "bobo",
	// 		middleName: "",
	// 		lastName: "",

	// 		email: "",
	// 		phone: "",

	// 		address: "",
	// 		city: "",
	// 		postalCode: "",
	// 		country: "",
			
	// 		// shipping
	// 		shippingFirstName: "",
	// 		shippingMiddleName:"",
	// 		shippingLastName: "",
	// 		shippingAddress: "",
	// 		shippingCity: "",
	// 		shippingPostalCode: "",
	// 		shippingCountry: "",
	// 	}
	// })



export default function ShippingAndBillingForm({customer, productSlug, customerGeoLocation}: {customer: CustomerInfo, productSlug: string, customerGeoLocation: string}) {
	
	const [isLoading, setIsLoading] = useState<boolean>(true);

	const [product, setProduct] = useState<Product | null>(null);
	const [formatedPrice, setFormatedPrice] = useState<string>("");
	const [formatedTax, setFormatedTax] = useState<string>("");
	const [countries, setCountries] = useState<string[]>([]);

	const [sameAsShipping, setSameAsShipping] = useState<boolean>(true);
  	const [saveBillingInfo, setSaveBillingInfo] = useState<boolean>(true);
	const [isBillingInfoSaved, setIsBillingInfoSaved] = useState<boolean>(customer.country != null && customer.address != null);

	const [errorState, setErrorState] = useState<{
		success: boolean;
		message: string;
		redirectUrl: string;
	} | null>(null);

	
	useEffect(() => {
		if(!productSlug) {
			setErrorState({
				success: false,
				message: "Unexpected error, no products selected, try again...",
				redirectUrl: "/watches/all"
			});
      		setIsLoading(false);
		}

		async function getAllCountries() {
			const allCountries = await getAllCountriesNameAction();
			setCountries(allCountries);
		}
		getAllCountries();

		async function getProduct() {
			try{
				const product = await getProductBySlug(productSlug);
				if(!product) throw new Error("(Client) Error fetching product");
				if(product.stock === 0) throw new Error(`(Client) ${product.watch.brand.name} ${product.watch.model} is out of stock`);

				const formatedPrice = await convertPriceAction(product.priceDkk, customerGeoLocation);
				setFormatedPrice(formatedPrice)
				
				const taxValue = Math.round((product.priceDkk * (product.watch.vat as number)/100));
				const formattedTaxValue = await convertPriceAction(taxValue, customerGeoLocation)
				setFormatedTax(formattedTaxValue);

				setProduct(product)
				
			} catch(error: any) {
				console.error(error)
				setErrorState({
					success: false,
					message: error.message,
					redirectUrl: "/watches/all"
				});

			} finally {
				setIsLoading(false);
			}
		}
		getProduct();

	}, [])



	async function handleSubmit(event: any) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const data = Object.fromEntries(formData.entries());

    	data.saveBillingInfo = String(saveBillingInfo);
		data.shippingSameAsBilling = String(sameAsShipping);
		data.customerId = customer.id;

		const customerCountry = customer.country || null;
		//@ts-ignore
		submitOrderDetails(data, product, customerCountry)
	}

console.log(customer.country)

  return (
		<div>
			{isLoading ? (
				<div className="flex justify-center items-center">
					<Spinner/>
				</div>

			) : product && product?.stock > 0 ? (
				<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
					<div className="max-w-7xl mx-auto">
						<h1 className="text-3xl font-bold text-foreground mb-8">Checkout</h1>
						
						<div className="grid lg:grid-cols-2 gap-8">
							{/* Left Column - Forms */}
							<form onSubmit={handleSubmit}>
								<div className="space-y-8">
									{/* Billing Address */}
									<Card className="p-6">
										<h2 className="text-xl font-semibold text-foreground mb-6">Billing Address</h2>
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
														defaultValue={isBillingInfoSaved && customer.firstName != null ? customer.firstName : undefined}
														required
													/>
												</div>

												<div className="space-y-2">
													<Label htmlFor="middleName">Middle Name (Optional)</Label>
													<Input 
														id="middleName" 
														name="middleName"
														placeholder="your middle name"
														defaultValue={isBillingInfoSaved && customer.middleName != null ? customer.middleName : undefined}
													/>
												</div>
												<div className="space-y-2">
													<Label htmlFor="lastName">Last Name*</Label>
													<Input 
														id="lastName" 
														name="lastName" 
														placeholder="your last name" 
														defaultValue={isBillingInfoSaved && customer.lastName != null ? customer.lastName : undefined}
														required />
												</div>
											</div>

											<div className="space-y-2">
												<Label htmlFor="email">Email*</Label>
												<Input id="email" type="email" name="email" placeholder="your email" defaultValue={customer.email} required/>
											</div>

											<div className="space-y-2">
												<Label htmlFor="phone">Phone Number (optional)</Label>
												<Input 
													id="phone" 
													type="tel" 
													name="phone" 
													placeholder="+45 26 46 95 96"
													defaultValue={isBillingInfoSaved && customer.phone != null ? customer.phone : undefined} 
												/>
											</div>

											<div className="space-y-2">
												<Label htmlFor="address">Street Address*</Label>
												<Input 
													id="address" 
													name="address" 
													placeholder="123 Main Street" 
													defaultValue={isBillingInfoSaved && customer.address?.address1 != null ? customer.address.address1 : undefined}
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
														defaultValue={isBillingInfoSaved && customer.address?.city != null ? customer.address.city : undefined}
														required
													/>
												</div>
												<div className="space-y-2">
													<Label htmlFor="postalCode">Postal Code*</Label>
													<Input 
														id="postalCode" 
														name="postalCode" 
														placeholder="2300" 
														value={isBillingInfoSaved && customer.address?.zipCode != null ? customer.address.zipCode : undefined}
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
													defaultValue={isBillingInfoSaved && customer.country?.name != null ? customer.country.name : undefined}
													className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<option value="" disabled>
														Select a country
													</option>

													{countries.map((countryName) => (
														<option key={countryName} defaultValue={countryName}>
															{countryName}
														</option>
													))}

												</select>
											</div>

											<div className="space-y-2">
												<Label htmlFor="stateProvince">State Province (optional)</Label>
												<Input 
													id="stateProvince" 
													name="stateProvince" 
													placeholder="Hovedstaden"
													defaultValue={isBillingInfoSaved && customer.address?.stateProvince != null ? customer.address.stateProvince : undefined}
												/>
											</div>
										</div>

										<div className="flex items-center ml-auto mr-2">
											<Label
												htmlFor="saveBillingInfo"
												className="mr-2 text-sm font-medium"
											>
												Save billing information
											</Label>
											<Checkbox
												id="saveBillingInfo"
												checked={saveBillingInfo}
												onCheckedChange={(checked) => setSaveBillingInfo(checked as boolean)}
											/>
										</div>

									</Card>

									{/* Shipping Address */}
									<Card className="p-6">
										<div className="flex items-center justify-between mb-6">
											<h2 className="text-xl font-semibold text-foreground">Shipping Address</h2>
											<div className="flex items-center space-x-2">
												<Label
													htmlFor="sameAsShipping"
													className="text-sm font-medium"
												>
													Same as billing
												</Label>
												<Checkbox
													id="sameAsShipping"
													checked={sameAsShipping}
													onCheckedChange={(checked) => setSameAsShipping(checked as boolean)}
												/>
											</div>
										</div>

										{!sameAsShipping && (
											<div className="space-y-4">
												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-2">
														<Label htmlFor="shippingFirstName">First Name*</Label>
														<Input id="shippingFirstName" name="shippingFirstName" placeholder="Reciver first name" />
													</div>
													<div className="space-y-2">
														<Label htmlFor="shippingMiddleName">Middle Name (optional)</Label>
														<Input id="shippingMiddleName" name="middleName" placeholder="Reciver middle name" />
													</div>
													<div className="space-y-2">
														<Label htmlFor="shippingLastName">Last Name*</Label>
														<Input id="shippingLastName" name="shippingLastName" placeholder="Reciver last name" />
													</div>
												</div>

												<div className="space-y-2">
													<Label htmlFor="shippingAddress">Street Address*</Label>
													<Input id="shippingAddress" name="shippingAddress" placeholder="123 Main Street" />
												</div>

												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-2">
														<Label htmlFor="shippingCity">City*</Label>
														<Input id="shippingCity" name="shippingCity" placeholder="Roskilde" />
													</div>
													<div className="space-y-2">
														<Label htmlFor="shippingPostalCode">Postal Code*</Label>
														<Input id="shippingPostalCode" name="shippingPostalCode" placeholder="2640" />
													</div>
												</div>

												<div className="space-y-2">
													<Label htmlFor="shippingCountry">Country*</Label>
													<select 
														id="shippingCountry" 
														name="shippingCountry" 
														className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
													>
														<option value="" disabled>
															Select a country
														</option>

														{countries.map((countryName) => (
															<option key={countryName} defaultValue={countryName}>
																{countryName}
															</option>
														))}

													</select>
												</div>

												<div className="space-y-2">
													<Label htmlFor="shippingStateProvince">State Province (optional)</Label>
													<Input id="shippingStateProvince" name="shippingStateProvince" placeholder="North Sealand" />
												</div>
											</div>
										)}
									</Card>
								</div>

								<Separator/>
								
								<Button className="w-full mt-6" size="lg">
									Complete Purchase
								</Button>
							</form>

							{/* Right Column - Product Summary */}
							<div className="lg:sticky lg:top-8 h-fit">
								<Card className="p-6">
									<h2 className="text-xl font-semibold text-foreground mb-6">Order Summary</h2>
									
									<div className="space-y-6">
										<div className="flex gap-4">
											<div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0 relative">
												<Image
													src={product.productImages[0].imageUrl || ""}
													alt={product.name}
													fill
													className="w-full h-full object-cover"
												/>
											</div>
											<div className="flex-1">
												<h3 className="font-semibold text-foreground">{product.watch.brand.name} {product.watch.model}</h3>
												<p className="text-2xl font-bold text-foreground mt-2">
													{formatedPrice}
												</p>
											</div>
										</div>

										<Separator />

										<div className="space-y-2">
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Subtotal</span>
												<span className="text-foreground">{formatedPrice}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Shipping</span>
												<span className="text-foreground">Free</span>
											</div>
										</div>

										<Separator />

										<div>
											<div className="flex justify-between text-lg font-semibold">
												<span className="text-foreground">Total</span>
												<span className="text-foreground">{formatedPrice}</span>
											</div>
											
											<div className="flex flex-col text-xs text-muted-foreground">
												<p>
													Including {formatedTax} in taxes {" "} ({product.watch.vat}%)
												</p>
												<p>
													//TODO move vat over to country and should be based on shipping address.
												</p>
											</div>
										</div>
									</div>
								</Card>
							</div>
						</div>
					</div>
				</div>
			) : (<div>
				<ToastWrapper state={errorState} />
			</div>
			)}
		</div>
  );
};