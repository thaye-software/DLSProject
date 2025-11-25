"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CustomerInfo, getUserById } from "@/services/userService";
import ToastWrapper from "@/components/Toast/ToastWrapper";

import { Product } from "@/app/watches/type";
import { submitOrderDetails } from "@/app/orders/actions";

import { getProductBySlug } from "@/services/productService";
import { Spinner } from "@/components/ui/spinner";
import { convertEuroToDkk } from "@/app/orders/actions";

import { toast } from "sonner";

import ProgressSteps from "@/components/Orders/Info/ProgressSteps";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

import constants from "@/lib/constants";
import {
  getLocalCurrencyString,
  convertCurrency,
} from "@/services/currencyService";
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
  const [VAT, setVAT] = useState<number>(0);
  const [formattedPrice, setFormattedPrice] = useState<string>("");
  const [formattedTax, setFormattedTax] = useState<string>("");
  const [formattedShipping, setFormattedShipping] = useState<string>("");
  const [formattedTotal, setFormattedTotal] = useState<string>("");
  const [countries, setCountries] = useState<CountryModel[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryModel | null>(
    null
  );

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
      setCountries(allCountries);

      // Try to pre-select the customer's saved country so VAT shows correctly
      if (customerUpdated?.country) {
        const c = allCountries.find(
          (x) => x.name === customerUpdated.country?.name
        );
        if (c) setSelectedCountry(c);
      }
    }
    getCountries();

    async function updateCustomerInfo() {
      const mostUpdatedCustomer = await getUserById(customerUpdated.id);
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

        // We set product first and compute VAT separately (see effect below)

        // product.priceDkk is stored as NET (no VAT). Price formatting and
        // VAT/gross calculations are handled in the computeVat effect so we
        // always add the correct VAT for the selected country.

        // we need to convert shipping cost from EUR to DKK for total calculation
        const shippingDkk = await convertEuroToDkk(
          constants.SHIPPING_PRICE_EUR * 100
        );
        // Set formatted shipping display based on location
        // Show shipping as a flat 50 EUR to the buyer.
        // If the viewer is Danish, convert 50 EUR -> DKK and format; otherwise show 50 EUR without adding VAT again.
        // Format shipping display without applying VAT again — shipping is a flat EUR amount
        const shippingDisplay =
          customerGeoLocation.toUpperCase() === "DK"
            ? new Intl.NumberFormat("da-DK", {
                style: "currency",
                currency: "DKK",
              }).format(shippingDkk / 100)
            : new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(constants.SHIPPING_PRICE_EUR);
        setFormattedShipping(shippingDisplay);

        setProduct(product);
        // Do not compute totals here — computeVat effect will compute prices
        // (gross/subtotal and total) once `product` and `selectedCountry` are known.
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
  console.log(countries);

  // When server/customer or countries change, make sure selectedCountry is kept in sync
  useEffect(() => {
    if (
      !selectedCountry &&
      countries.length > 0 &&
      customerUpdated?.country?.name
    ) {
      const countryName = customerUpdated?.country?.name;
      const found = countryName
        ? countries.find((c) => c.name === countryName) || null
        : null;
      if (found) setSelectedCountry(found);
    }
  }, [countries, customerUpdated, selectedCountry]);

  // Recalculate VAT & formattedTax whenever product, selectedCountry or locale changes
  // also recalulate subtotal and total based on VAT changes
  useEffect(() => {
    async function computeVat() {
      if (!product) return;
      // NEW: product.priceDkk is net (no VAT). Compute VAT and gross based
      // on the selected country VAT rate (fallback 25%). Then update
      // formatted values for VAT, displayed subtotal (gross) and total.
      const net = product.priceDkk; // net price in DKK cents
      const vatPercent = selectedCountry?.vatRate ?? 25; // ignore legacy product.watch.vat
      // display/formatting should use the shipping/country VAT and currency (abbreviation),
      // fall back to the visitor locale if we don't have a selected country.
      const displayCountryCode =
        selectedCountry?.abbreviation ?? customerGeoLocation;
      const vatAmount = Math.round((net * vatPercent) / 100);
      const gross = net + vatAmount; // subtotal shown to buyer

      setVAT(vatAmount);
      // Format VAT amount without adding VAT again: convert the DKK cents to local currency units then format.
      try {
        const taxConverted = await convertCurrency(
          vatAmount,
          displayCountryCode
        );
        const taxFormatted =
          displayCountryCode.toUpperCase() === "DK" ||
          displayCountryCode.toUpperCase() === "DKK"
            ? new Intl.NumberFormat("da-DK", {
                style: "currency",
                currency: "DKK",
              }).format(taxConverted)
            : new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(taxConverted);
        setFormattedTax(taxFormatted);
      } catch (err) {
        // fallback to legacy formatter if conversion fails
        setFormattedTax(
          await getLocalCurrencyString(vatAmount, displayCountryCode)
        );
      }
      // Use getLocalCurrencyString on the NET price -> this helper will apply the correct VAT
      // and convert to the display country's currency internally.
      setFormattedPrice(await getLocalCurrencyString(net, displayCountryCode));

      // shipping + total
      const shippingDkk = await convertEuroToDkk(
        constants.SHIPPING_PRICE_EUR * 100
      );
      // recalc shipping display without adding VAT
      const shippingDisplay =
        displayCountryCode.toUpperCase() === "DK"
          ? new Intl.NumberFormat("da-DK", {
              style: "currency",
              currency: "DKK",
            }).format(shippingDkk / 100)
          : new Intl.NumberFormat("en-IE", {
              style: "currency",
              currency: "EUR",
            }).format(constants.SHIPPING_PRICE_EUR);
      setFormattedShipping(shippingDisplay);
      // total = gross (net + VAT on product) + shipping (flat EUR converted to DKK cents)
      const totalDkk = gross + shippingDkk;
      if (
        displayCountryCode.toUpperCase() === "DK"
      ) {
        setFormattedTotal(
          new Intl.NumberFormat("da-DK", {
            style: "currency",
            currency: "DKK",
          }).format(totalDkk / 100)
        );
      } else {
        const totalConverted = await convertCurrency(
          totalDkk,
          displayCountryCode
        );
        setFormattedTotal(
          new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: "EUR",
          }).format(totalConverted)
        );
      }
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
    data.shippingPriceDkk = String(
      await convertEuroToDkk(constants.SHIPPING_PRICE_EUR * 100)
    );

    const customerCountry = customerUpdated.country || null;

    try {
      setIsBuyLoading(true);
      //@ts-ignore
      const orderId = await submitOrderDetails(data, product, customerCountry);

      // TODO should replace orderId with ref nr.
      router.push(`/orders/checkouttwo/payment?orderId=${orderId}`);
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

                            // update VAT and formatted tax when country changes
                            if (product) {
                              // product.priceDkk is net — compute vat and gross
                              const net = product.priceDkk;
                              const vatPercent = found?.vatRate ?? 25;
                              const vatAmount = Math.round(
                                (net * vatPercent) / 100
                              );
                              const gross = net + vatAmount;

                              const displayCountryCode =
                                found?.abbreviation ?? customerGeoLocation;

                              setVAT(vatAmount);
                              try {
                                const taxConverted = await convertCurrency(
                                  vatAmount,
                                  displayCountryCode
                                );
                                const taxFormatted =
                                  displayCountryCode.toUpperCase() === "DK" ||
                                  displayCountryCode.toUpperCase() === "DKK"
                                    ? new Intl.NumberFormat("da-DK", {
                                        style: "currency",
                                        currency: "DKK",
                                      }).format(taxConverted)
                                    : new Intl.NumberFormat("en-IE", {
                                        style: "currency",
                                        currency: "EUR",
                                      }).format(taxConverted);
                                setFormattedTax(taxFormatted);
                              } catch (err) {
                                setFormattedTax(
                                  await getLocalCurrencyString(
                                    vatAmount,
                                    displayCountryCode
                                  )
                                );
                              }
                              setFormattedPrice(
                                await getLocalCurrencyString(
                                  net,
                                  displayCountryCode
                                )
                              );
                              const shippingDkk = await convertEuroToDkk(
                                constants.SHIPPING_PRICE_EUR * 100
                              );
                              const totalDkk = gross + shippingDkk;
                              if (
                                displayCountryCode.toUpperCase() === "DK" ||
                                displayCountryCode.toUpperCase() === "DKK"
                              ) {
                                setFormattedTotal(
                                  new Intl.NumberFormat("da-DK", {
                                    style: "currency",
                                    currency: "DKK",
                                  }).format(totalDkk / 100)
                                );
                              } else {
                                const totalConverted = await convertCurrency(
                                  totalDkk,
                                  displayCountryCode
                                );
                                setFormattedTotal(
                                  new Intl.NumberFormat("en-IE", {
                                    style: "currency",
                                    currency: "EUR",
                                  }).format(totalConverted)
                                );
                              }
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
                                const vatAmount = Math.round(
                                  (net * vatPercent) / 100
                                );
                                const gross = net + vatAmount;

                                const displayCountryCode =
                                  found?.abbreviation ?? customerGeoLocation;

                                setVAT(vatAmount);
                                try {
                                  const taxConverted = await convertCurrency(
                                    vatAmount,
                                    displayCountryCode
                                  );
                                  const taxFormatted =
                                    displayCountryCode.toUpperCase() === "DK"
                                      ? new Intl.NumberFormat("da-DK", {
                                          style: "currency",
                                          currency: "DKK",
                                        }).format(taxConverted)
                                      : new Intl.NumberFormat("en-IE", {
                                          style: "currency",
                                          currency: "EUR",
                                        }).format(taxConverted);
                                  setFormattedTax(taxFormatted);
                                } catch (err) {
                                  setFormattedTax(
                                    await getLocalCurrencyString(
                                      vatAmount,
                                      displayCountryCode
                                    )
                                  );
                                }
                                setFormattedPrice(
                                  await getLocalCurrencyString(
                                    net,
                                    displayCountryCode
                                  )
                                );
                                const shippingDkk = await convertEuroToDkk(
                                  constants.SHIPPING_PRICE_EUR * 100
                                );
                                const totalDkk = gross + shippingDkk;
                                if (
                                  displayCountryCode.toUpperCase() === "DK" ||
                                  displayCountryCode.toUpperCase() === "DKK"
                                ) {
                                  setFormattedTotal(
                                    new Intl.NumberFormat("da-DK", {
                                      style: "currency",
                                      currency: "DKK",
                                    }).format(totalDkk / 100)
                                  );
                                } else {
                                  const totalConverted = await convertCurrency(
                                    totalDkk,
                                    displayCountryCode
                                  );
                                  setFormattedTotal(
                                    new Intl.NumberFormat("en-IE", {
                                      style: "currency",
                                      currency: "EUR",
                                    }).format(totalConverted)
                                  );
                                }
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
                          {formattedTotal || formattedPrice}
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
