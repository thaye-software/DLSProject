"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CustomerInfo, getUserById } from "@/services/userService";
import ToastWrapper from "@/components/Toast/ToastWrapper";

import { Product } from "@/app/watches/type";
import {
  submitOrderDetails,
} from "@/app/orders/actions";

import { getProductBySlug } from "@/services/productService";
import { Spinner } from "@/components/ui/spinner";
import { convertEuroToDkk } from "@/app/orders/actions";

import { toast } from "sonner";

import ProgressSteps from "@/components/Orders/Info/ProgressSteps";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

import constants from "@/lib/constants";
import { getLocalCurrencyString } from "@/services/currencyService";
import { getAllCountries } from "@/services/countryService";
import { CountryModel } from "@/database/types";

export default function ShippingAndBillingForm({
  customer,
  productSlug,
  customerGeoLocation,
}: {
  customer: CustomerInfo;
  productSlug: string;
  customerGeoLocation: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBuyLoading, setIsBuyLoading] = useState<boolean>(false);

  const [customerUpdated, setCustomerUpdated] = useState(customer);

  const [product, setProduct] = useState<Product | null>(null);
  const [formattedPrice, setFormattedPrice] = useState<string>("");
  const [formattedTax, setFormattedTax] = useState<string>("");
  const [formattedShipping, setFormattedShipping] = useState<string>("");
  const [formattedTotal, setFormattedTotal] = useState<string>("");
  const [countries, setCountries] = useState<string[]>([]);

  const [sameAsShipping, setSameAsShipping] = useState<boolean>(true);
  const [saveBillingInfo, setSaveBillingInfo] = useState<boolean>(true);
  const [isBillingInfoSaved, setIsBillingInfoSaved] = useState<boolean>(
    customerUpdated.country != null && customerUpdated.address != null
  );

  const [errorState, setErrorState] = useState<{
    success: boolean;
    message: string;
    redirectUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!productSlug) {
      setErrorState({
        success: false,
        message: "Unexpected error, no products selected, try again...",
        redirectUrl: "/watches/all",
      });
      setIsLoading(false);
    }

    async function getCountries() {
      const allCountries: CountryModel[] = await getAllCountries();
      const countryNames = allCountries.map((country) => country.name);
      setCountries(countryNames);
    }
    getCountries();

    async function updateCustomerInfo() {
      const mostUpdatedCustomer = await getUserById(
        customerUpdated.id
      );
      setCustomerUpdated(mostUpdatedCustomer as CustomerInfo);
    }
    updateCustomerInfo();

    async function getProduct() {
      try {
        const product = await getProductBySlug(productSlug);
        if (!product) throw new Error("(Client) Error fetching product");
        if (product.stock === 0)
          throw new Error(
            `(Client) ${product.watch.brand.name} ${product.watch.model} is out of stock`
          );

        const formattedPrice = await getLocalCurrencyString(
          product.priceDkk,
          customerGeoLocation
        );
        setFormattedPrice(formattedPrice);

        const taxValue = Math.round(
          (product.priceDkk * (product.watch.vat as number)) / 100
        );
        const formattedTaxValue = await getLocalCurrencyString(
          taxValue,
          customerGeoLocation
        );
        setFormattedTax(formattedTaxValue);

        // we need to convert shipping cost from EUR to DKK for total calculation
        const shippingDkk = await convertEuroToDkk(constants.SHIPPING_PRICE_EUR * 100);
        // Set formatted shipping display based on location
        const formattedShipping = await getLocalCurrencyString(
          shippingDkk,
          customerGeoLocation
        );
        setFormattedShipping(formattedShipping);

        setProduct(product);
        // Calculate total price
        try {
          const shippingDkk = await convertEuroToDkk(constants.SHIPPING_PRICE_EUR * 100)
          const total = product.priceDkk + shippingDkk;
          const formattedTotalPrice = await getLocalCurrencyString(
            total,
            customerGeoLocation
          );
          setFormattedTotal(formattedTotalPrice);

        } catch (err) {
          console.warn("Could not compute total price at fetch time", err);
        }
      } catch (error: any) {
        console.error(error);
        setErrorState({
          success: false,
          message: error.message,
          redirectUrl: "/watches/all",
        });
      } finally {
        setIsLoading(false);
      }
    }
    getProduct();
  }, []);

  async function handleSubmit(event: any) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    data.saveBillingInfo = String(saveBillingInfo);
    data.shippingSameAsBilling = String(sameAsShipping);
    data.customerId = customerUpdated.id;
    data.shippingPriceDkk = String(await convertEuroToDkk(constants.SHIPPING_PRICE_EUR * 100));

    const customerCountry = customerUpdated.country || null;

    try {
      setIsBuyLoading(true);
      //@ts-ignore
      const orderId = await submitOrderDetails(data, product, customerCountry);

      // TODO should replace orderId with ref nr.
      router.push(`/orders/checkout/payment?orderId=${orderId}`);
    } catch (error) {
      //@ts-ignore
      toast.error(error.message);
    } finally {
      setIsBuyLoading(false);
    }
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ProgressSteps currentStep={1} />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center">
          <Spinner />
        </div>
      ) : product && product?.stock > 0 ? (
        <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
            <BackButton addClassName="mb-8" />

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Forms */}
              <form ref={formRef} onSubmit={handleSubmit}>
                <div className="space-y-8">
                  {/* Billing Address */}
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold text-foreground mb-6">
                      Billing Address
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
                              customerUpdated.firstName != null
                                ? customerUpdated.firstName
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
                              customerUpdated.middleName != null
                                ? customerUpdated.middleName
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
                              customerUpdated.lastName != null
                                ? customerUpdated.lastName
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
                          defaultValue={customerUpdated.email}
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
                            isBillingInfoSaved && customerUpdated.phone != null
                              ? customerUpdated.phone
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
                            customerUpdated.address?.address1 != null
                              ? customerUpdated.address.address1
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
                              customerUpdated.address?.city != null
                                ? customerUpdated.address.city
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
                              customerUpdated.address?.zipCode != null
                                ? customerUpdated.address.zipCode
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
                          defaultValue={
                            isBillingInfoSaved &&
                            customerUpdated.country?.name != null
                              ? customerUpdated.country.name
                              : undefined
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="" disabled>
                            Select a country
                          </option>

                          {countries.map((countryName) => (
                            <option
                              key={countryName}
                              defaultValue={countryName}
                            >
                              {countryName}
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
                            customerUpdated.address?.stateProvince != null
                              ? customerUpdated.address.stateProvince
                              : undefined
                          }
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
                        onCheckedChange={(checked) =>
                          setSaveBillingInfo(checked as boolean)
                        }
                      />
                    </div>
                  </Card>

                  {/* Shipping Address */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-foreground">
                        Shipping Address
                      </h2>
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
                          onCheckedChange={(checked) =>
                            setSameAsShipping(checked as boolean)
                          }
                        />
                      </div>
                    </div>

                    {!sameAsShipping && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="shippingFirstName">
                              First Name*
                            </Label>
                            <Input
                              id="shippingFirstName"
                              name="shippingFirstName"
                              placeholder="Reciver first name"
                              required={!sameAsShipping}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shippingMiddleName">
                              Middle Name (optional)
                            </Label>
                            <Input
                              id="shippingMiddleName"
                              name="shippingMiddleName"
                              placeholder="Reciver middle name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shippingLastName">Last Name*</Label>
                            <Input
                              id="shippingLastName"
                              name="shippingLastName"
                              placeholder="Reciver last name"
                              required={!sameAsShipping}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="shippingAddress">
                            Street Address*
                          </Label>
                          <Input
                            id="shippingAddress"
                            name="shippingAddress"
                            placeholder="123 Main Street"
                            required={!sameAsShipping}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="shippingCity">City*</Label>
                            <Input
                              id="shippingCity"
                              name="shippingCity"
                              placeholder="Roskilde"
                              required={!sameAsShipping}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shippingPostalCode">
                              Postal Code*
                            </Label>
                            <Input
                              id="shippingPostalCode"
                              name="shippingPostalCode"
                              placeholder="2640"
                              required={!sameAsShipping}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="shippingCountry">Country*</Label>
                          <select
                            id="shippingCountry"
                            name="shippingCountry"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            required={!sameAsShipping}
                          >
                            <option value="" disabled>
                              Select a country
                            </option>

                            {countries.map((countryName) => (
                              <option
                                key={countryName}
                                defaultValue={countryName}
                              >
                                {countryName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="shippingStateProvince">
                            State Province (optional)
                          </Label>
                          <Input
                            id="shippingStateProvince"
                            name="shippingStateProvince"
                            placeholder="North Zealand"
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                </div>

                <Separator />

                {isBuyLoading ? (
                  <Button className="w-full mt-6" size="lg" disabled>
                    Proceding to payment <Spinner />
                  </Button>
                ) : (
                  <Button className="w-full mt-6" size="lg">
                    Procede to payment
                  </Button>
                )}
              </form>

              {/* Right Column - Product Summary */}
              <div className="lg:sticky lg:top-8 h-fit">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-6">
                    Order Summary
                  </h2>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                        <Image
                          src={product.productImages[0].imageUrl || ""}
                          alt={product.name}
                          fill
                            className="w-full h-full object-cover"
                            unoptimized
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {product.watch.brand.name} {product.watch.model}
                        </h3>
                        <p className="text-2xl font-bold text-foreground mt-2">
                          {formattedPrice}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">
                          {formattedPrice}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="text-foreground">
                          {formattedShipping}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex justify-between text-lg font-semibold">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">
                          {formattedTotal || formattedPrice}
                        </span>
                      </div>

                      <div className="flex flex-col text-xs text-muted-foreground">
                        <p>
                          Including {formattedTax} in taxes ({product.watch.vat}
                          %)
                        </p>
                        <p>
                          //TODO move vat over to country and should be based on
                          shipping address.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <ToastWrapper state={errorState} />
        </div>
      )}
    </div>
  );
}
