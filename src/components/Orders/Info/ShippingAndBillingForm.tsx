"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import ToastWrapper from "@/components/Toast/ToastWrapper";
import BackButton from "@/components/Miscellaneous/BackButton";
import ProgressSteps from "@/components/Orders/Info/ProgressSteps";

import { Product } from "@/app/watches/type";
import { submitOrderDetails } from "@/app/orders/actions";

import {
  getLocalCurrencyString,
  convertCurrency,
} from "@/services/currencyService";
import { getAllCountries } from "@/services/countryService";
import { getProductBySlug } from "@/services/productService";
import { CustomerInfo, getUserById } from "@/services/userService";

import {
  calculateVatCents,
  calculateSubtotalCents,
} from "@/lib/priceUtils";
import constants from "@/lib/constants";

import { CountryModel } from "@/database/types";



export default function ShippingAndBillingForm({
  customer,
  productSlug,
  customerGeoLocation,
  discountedPrice,
  offerToken,
}: {
  customer: CustomerInfo;
  productSlug: string;
  customerGeoLocation: string;
  discountedPrice?: number;
  offerToken?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBuyLoading, setIsBuyLoading] = useState<boolean>(false);

  const [customerUpdated, setCustomerUpdated] = useState(customer);

  const [product, setProduct] = useState<Product | null>(null);
  const [VAT, setVAT] = useState<number>(0);
  const [formattedPrice, setFormattedPrice] = useState<string>("");
  const [formattedTax, setFormattedTax] = useState<string>("");
  const [formattedShipping, setFormattedShipping] = useState<string>("");
  const [formattedTotal, setFormattedTotal] = useState<string>("");
  const [countries, setCountries] = useState<CountryModel[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryModel | null>(
    null
  );

  // Central helper reused by useEffect and onChange handlers.
  async function computeAndSetAmounts(
    netCents: number,
    vatPercentLocal: number,
    displayCountryCode: string
  ) {
    // compute in cents
    const vatCents = calculateVatCents(netCents, vatPercentLocal);
    const subtotalCents = calculateSubtotalCents(netCents, vatPercentLocal);

    // basic pieces
    setVAT(vatCents);
    setFormattedTax(await getLocalCurrencyString(vatCents, displayCountryCode));
    setFormattedPrice(
      await getLocalCurrencyString(subtotalCents, displayCountryCode)
    );

    // totals + shipping
    if (displayCountryCode.toUpperCase() === "DK") {
      const shippingCents = constants.SHIPPING_PRICE_DKK * 100;
      const totalCents = subtotalCents + shippingCents;
      setFormattedShipping(
        await getLocalCurrencyString(shippingCents, displayCountryCode)
      );
      setFormattedTotal(
        await getLocalCurrencyString(totalCents, displayCountryCode)
      );
    } else {
      // Non-DK: convert subtotal to EUR units and add fixed EUR shipping
      const subtotalInEurUnits = await convertCurrency(
        subtotalCents,
        displayCountryCode
      );
      const shippingEurUnits = constants.SHIPPING_PRICE_EUR;
      const totalInEurUnits = subtotalInEurUnits + shippingEurUnits;

      setFormattedShipping(
        new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
        }).format(shippingEurUnits)
      );
      setFormattedTotal(
        new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
        }).format(totalInEurUnits)
      );
    }
  }

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
        redirectUrl: "/watches",
      });
      setIsLoading(false);
    }

    async function getCountries() {
      const allCountries: CountryModel[] = await getAllCountries();
      setCountries(allCountries);
      const foundCountry = allCountries.find(
        (country) => country.abbreviation === customerUpdated.country?.abbreviation
      );
      if (foundCountry) setSelectedCountry(foundCountry);
    }
    getCountries();

    async function updateCustomerInfo() {
      const mostUpdatedCustomer = await getUserById(customerUpdated.id);
      setCustomerUpdated(mostUpdatedCustomer as CustomerInfo);
    }
    updateCustomerInfo();

    async function getProduct() {
      // persist vat value in cents

      try {
        const product = await getProductBySlug(productSlug);
        if (!product) throw new Error("(Client) Error fetching product");
        if (product.stock === 0)
          throw new Error(
            `(Client) ${product.watch.brand.name} ${product.watch.model} is out of stock`
          );

        // Apply discount if available
        if (discountedPrice) {
          // The discountedPrice is the Gross price (including 25% VAT).
          // We need to convert it to Net price because the form logic adds VAT on top of product.priceDkk.
          if (discountedPrice && customerGeoLocation === "DK") {
            product.priceDkk = Math.round(discountedPrice / 1.25);
          } else {
            // TODO: handle non-DK discounted prices properly
            product.priceDkk = discountedPrice;
          }
        }

        // Use fixed EUR shipping for non-DK visitors; for DK format the DKK amount
        const shippingDisplay =
          (customerGeoLocation || "DK").toUpperCase() === "DK"
            ? await getLocalCurrencyString(
                constants.SHIPPING_PRICE_DKK * 100,
                customerGeoLocation
              )
            : new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(constants.SHIPPING_PRICE_EUR);
        setFormattedShipping(shippingDisplay);

        setProduct(product);
      } catch (error: any) {
        console.error(error);
        setErrorState({
          success: false,
          message: error.message,
          redirectUrl: "/watches",
        });
      } finally {
        setIsLoading(false);
      }
    }
    getProduct();
  }, []);

  // Recalculate VAT & formattedTax whenever product, selectedCountry or locale changes
  // also recalulate subtotal and total based on VAT changes
  useEffect(() => {
    async function computeVat() {
      if (!product) return;

      // small helper to calculate amounts & update formatted state consistently
      const net = product.priceDkk; // net price in DKK cents
      const vatPercent = selectedCountry?.vatRate ?? 25;

      await computeAndSetAmounts(
        net,
        vatPercent,
        selectedCountry?.abbreviation ?? customerGeoLocation ?? "DK"
      );
    }

    computeVat();
  }, [product, selectedCountry, customerGeoLocation]);

  async function handleSubmit(event: any) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    data.saveBillingInfo = String(saveBillingInfo);
    data.shippingSameAsBilling = String(sameAsShipping);
    data.customerId = customerUpdated.id;
    data.shippingPriceDkk = String(constants.SHIPPING_PRICE_DKK);
    if (offerToken) {
      data.offerToken = offerToken;
    }

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
            {/* passing redurectUrl, to catch the edge case where a user attempts to buy a watch but has no account, so they sign in, and to avoid going back to register page, we send them back to the original page with the watch details */}
            <BackButton addClassName="mb-8" redirectUrl={`/watches/view/${encodeURIComponent(productSlug)}`}/>

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
                          value={
                            selectedCountry?.name ??
                            (isBillingInfoSaved && customerUpdated.country?.name
                              ? customerUpdated.country.name
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

                            // update VAT, subtotal and formatted totals when country changes
                            if (product) {
                              const net = product.priceDkk; // cents
                              const vatPercent = found?.vatRate ?? 25;
                              const displayCountryCode =
                                found?.abbreviation ??
                                customerGeoLocation ??
                                "DK";

                              await computeAndSetAmounts(
                                net,
                                vatPercent,
                                displayCountryCode
                              );
                            }
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
                            onChange={async (e) => {
                              const name = e.target.value;
                              const found =
                                countries.find((c) => c.name === name) || null;
                              setSelectedCountry(found);

                              // recalc VAT for newly selected shipping country
                              if (product) {
                                const net = product.priceDkk;
                                const vatPercent = found?.vatRate ?? 25;
                                const displayCountryCode =
                                  found?.abbreviation ??
                                  customerGeoLocation ??
                                  "DK";

                                await computeAndSetAmounts(
                                  net,
                                  vatPercent,
                                  displayCountryCode
                                );
                              }
                            }}
                            required={!sameAsShipping}
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
                    Proceed to payment
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
                        <div className="flex flex-col items-end">
                          <span className="text-foreground">
                            {formattedShipping}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex justify-between text-lg font-semibold">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">
                          {formattedTotal}
                        </span>
                      </div>

                      <div className="flex flex-col text-xs text-muted-foreground">
                        <p>
                          Including {formattedTax} VAT (
                          {selectedCountry?.vatRate}%)
                        </p>
                        <p></p>
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
