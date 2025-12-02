"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { z } from "zod";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import MultiImageUpload from "@/components/Admin/MultiImageUpload";
import CustomSelect from "@/components/Admin/watches/CustomSelect";

import { createWatch } from "@/app/admin/watches/new/actions";
import { updateWatch } from "@/app/admin/watches/[id]/edit/actions";

import { createNewWatchSchema } from "@/app/admin/watches/new/validation";


import constants from "@/lib/constants";
import { calculateVAT } from "@/lib/priceUtils";

import { BrandModel } from "@/database/types";



export default function CreateWatchForm({
  initialBrands,
  initialProduct,
}: {
  initialBrands: any[];
  // Optional product when used for editing
  initialProduct?: import("@/database/types").ProductModel | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<BrandModel[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  useEffect(() => {
    async function fetchBrands() {
      const brandsData = await initialBrands;
      setBrands(brandsData);
    }
    fetchBrands();
  }, [initialBrands]);

  const [form, setForm] = useState(() => ({
    brand: "",
    internalId: "",
    model: "",
    description: "",
    reference: "",
    serialNumber: "",
    year: "",
    size: "",
    movement: "",
    glassType: "",
    limited: "false",
    box: "false",
    papers: "false",
    condition: "5",
    price: "",
    braceletType: "",
    braceletColor: "",
    dialColor: "",
    vat: "0",
    stock: "1",
    productSafetyInfoId: "",
  }));

  const initialPriceWithVAT = initialProduct
    ? (initialProduct.priceDkk +
        calculateVAT(initialProduct.priceDkk * 100, 0.25)) /
      100
    : "";

  // If we were given an initialProduct (edit mode), prefill the form
  useEffect(() => {
    if (!initialProduct) return;

    setForm((prev) => ({
      ...prev,
      brand: initialProduct.watch?.brand?.id ?? prev.brand,
      internalId: initialProduct.watch?.internalId ?? prev.internalId,
      reference: initialProduct.watch?.reference ?? prev.reference,
      serialNumber: initialProduct.watch?.serialNumber ?? prev.serialNumber,
      year: String(initialProduct.watch?.year ?? prev.year),
      condition: String(initialProduct.watch?.condition ?? prev.condition),
      box: initialProduct.watch?.box ? "true" : "false",
      papers: initialProduct.watch?.papers ? "true" : "false",
      limited: initialProduct.watch?.limited ? "true" : "false",
      glassType: initialProduct.watch?.glassType ?? prev.glassType,
      braceletType: initialProduct.watch?.braceletType ?? prev.braceletType,
      braceletColor: initialProduct.watch?.braceletColor ?? prev.braceletColor,
      dialColor: initialProduct.watch?.dialColor ?? prev.dialColor,
      vat: String(initialProduct.watch?.vat ?? prev.vat),
      size: String(initialProduct.watch?.size ?? prev.size),
      movement: initialProduct.watch?.movement ?? prev.movement,
      model: initialProduct.name ?? initialProduct.watch?.model ?? prev.model,
      description: initialProduct.description ?? prev.description,
      price: String(initialPriceWithVAT),
      stock: String(initialProduct.stock ?? prev.stock),
    }));

    console.log("internalid", initialProduct.watch?.internalId);

    // Prefill any existing product images into uploadedImages
    if (initialProduct.productImages && initialProduct.productImages.length) {
      const urls = initialProduct.productImages
        .map((img: any) => img.imageUrl)
        .filter(Boolean);
      setUploadedImages(urls);
    }
  }, [initialProduct, brands]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // client-side zod validation (same schema used previously)
    const result = createNewWatchSchema.safeParse(form);
    if (!result.success) {
      const issues = result.error.issues;
      const fieldErrors: Record<string, string> = {};
      issues.forEach((issue: z.ZodIssue) => {
        if (
          issue.path &&
          issue.path.length > 0 &&
          typeof issue.path[0] === "string"
        ) {
          const key = issue.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
      });
      setErrors({
        ...fieldErrors,
        submitList: issues.map((i) => i.message).join("|"),
      });
      setLoading(false);
      return;
    }

    // Build FormData for server action (action expects FormData)
    const fd = new FormData();
    fd.append("brandId", form.brand);
    fd.append("internalId", form.internalId);
    fd.append("model", form.model ?? "");
    fd.append("reference", form.reference ?? "");
    fd.append("serialNumber", form.serialNumber ?? "");
    fd.append("year", form.year ?? "");
    fd.append("condition", String(form.condition ?? ""));
    fd.append("box", String(form.box ?? "false"));
    fd.append("papers", String(form.papers ?? "false"));
    fd.append("limited", String(form.limited ?? "false"));
    fd.append("glassType", form.glassType ?? "");
    fd.append("braceletType", form.braceletType ?? "");
    fd.append("braceletColor", form.braceletColor ?? "");
    fd.append("dialColor", form.dialColor ?? "");
    fd.append("vat", String(form.vat ?? ""));
    fd.append("size", form.size ?? "");
    fd.append("movement", form.movement ?? "");
    // Map product fields expected by action
    fd.append("productName", form.model ?? "");
    fd.append("description", form.description ?? "");
    fd.append("price", form.price);
    // default stock if not present
    fd.append("stock", String(form.stock ?? "1"));
    // imageUrls as comma separated string (action splits)
    fd.append("imageUrls", uploadedImages.join(","));

    // if we're editing (initialProduct provided or on edit route), call update
    const onEditPath = Boolean(
      pathname && /\/admin\/watches\/[^/]+\/edit$/.test(pathname)
    );

    // When updating, ensure we include productId (prefer initialProduct, otherwise parse from path)
    if (initialProduct?.id) {
      fd.append("productId", initialProduct.id);
    } else if (onEditPath && pathname) {
      const m = pathname.match(/\/admin\/watches\/([^/]+)\/edit$/);
      if (m) fd.append("productId", m[1]);
    }

    try {
      const res =
        initialProduct || onEditPath
          ? await updateWatch(fd)
          : await createWatch(fd);
      if (res?.success) {
        // update and create actions return different shapes — try both
        const watchId =
          res?.data?.watch?.id ??
          res?.data?.id ??
          res?.data?.product?.id ??
          undefined;
        if (watchId) {
          router.push(`/admin/watches`);
          return;
        }
      }
      // If not successful, set an error
      setErrors({ submit: res?.error ?? "Failed to create watch" });
    } catch (err) {
      console.error("Error creating watch:", err);
      setErrors({ submit: (err as Error).message ?? "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid gap-6 max-w-3xl">
        <Field>
          <FieldLabel>Brand</FieldLabel>
          <FieldContent>
            <CustomSelect
              placeholderText={"Select a brand"}
              array={brands}
              value={form.brand}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, brand: value }))
              }
            />
            <FieldDescription>Brand of the watch</FieldDescription>
            {errors.brand && <FieldError>{errors.brand}</FieldError>}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Internal ID</FieldLabel>
          <FieldContent>
            <Input
              name="internalId"
              value={form.internalId}
              onChange={handleChange}
            />
            {errors.internalId && (
              <FieldError>{errors.internalId}</FieldError>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Model</FieldLabel>
          <FieldContent>
            <Input name="model" value={form.model} onChange={handleChange} />
            {errors.model && <FieldError>{errors.model}</FieldError>}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Reference</FieldLabel>
          <FieldContent>
            <Input
              name="reference"
              value={form.reference}
              onChange={handleChange}
            />
            {errors.reference && <FieldError>{errors.reference}</FieldError>}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Serial Number</FieldLabel>
          <FieldContent>
            <Input
              name="serialNumber"
              value={form.serialNumber}
              onChange={handleChange}
            />
            {errors.serialNumber && (
              <FieldError>{errors.serialNumber}</FieldError>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Description</FieldLabel>
          <FieldContent>
            <Textarea
              name="description"
              value={form.description}
              onChange={handleChange}
            />
            {errors.description && (
              <FieldError>{errors.description}</FieldError>
            )}
          </FieldContent>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field>
            <FieldLabel>Year</FieldLabel>
            <FieldContent>
              <Input
                name="year"
                value={form.year}
                onChange={handleChange}
                type="number"
              />
              {errors.year && <FieldError>{errors.year}</FieldError>}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>
              Size<span className="text-xs text-muted-foreground mt-1">mm</span>
            </FieldLabel>
            <FieldContent>
              <Input name="size" value={form.size} onChange={handleChange} />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Movement</FieldLabel>
            <FieldContent>
              <CustomSelect
                placeholderText={"Select a movement"}
                array={constants.MOVEMENT_OPTIONS}
                value={form.movement}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, movement: val }))
                }
              />
            </FieldContent>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field>
            <FieldLabel>Glass Type</FieldLabel>
            <FieldContent>
              <CustomSelect
                placeholderText={"Select a glass type"}
                array={constants.GLASS_OPTIONS}
                value={form.glassType}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, glassType: val }))
                }
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Condition</FieldLabel>
            <FieldContent>
              <Input
                name="condition"
                value={form.condition}
                onChange={handleChange}
                type="number"
              />
              {errors.condition && <FieldError>{errors.condition}</FieldError>}
            </FieldContent>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field>
            <FieldLabel>Box</FieldLabel>
            <FieldContent>
              <Checkbox
                name="box"
                checked={form.box === "true"}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({
                    ...prev,
                    box: checked ? "true" : "false",
                  }));
                }}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Papers</FieldLabel>
            <FieldContent>
              <Checkbox
                name="papers"
                checked={form.papers === "true"}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({
                    ...prev,
                    papers: checked ? "true" : "false",
                  }));
                }}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Limited</FieldLabel>
            <FieldContent>
              <Checkbox
                name="limited"
                checked={form.limited === "true"}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({
                    ...prev,
                    limited: checked ? "true" : "false",
                  }));
                }}
              />
            </FieldContent>
          </Field>
        </div>

        <Field>
          <FieldLabel>Price (DKK)</FieldLabel>
          <FieldContent>
            <Input name="price" value={form.price} onChange={handleChange} />
            {errors.price && <FieldError>{errors.price}</FieldError>}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Bracelet Type</FieldLabel>
          <FieldContent>
            <CustomSelect
              placeholderText={"Select a bracelet type"}
              array={constants.BRACELET_OPTIONS}
              value={form.braceletType}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, braceletType: val }))
              }
            />
            {errors.braceletType && (
              <FieldError>{errors.braceletType}</FieldError>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Bracelet Color</FieldLabel>
          <FieldContent>
            <Input
              name="braceletColor"
              value={form.braceletColor}
              onChange={handleChange}
            />
            {errors.braceletColor && (
              <FieldError>{errors.braceletColor}</FieldError>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Dial Color</FieldLabel>
          <FieldContent>
            <Input
              name="dialColor"
              value={form.dialColor}
              onChange={handleChange}
            />
            {errors.dialColor && <FieldError>{errors.dialColor}</FieldError>}
          </FieldContent>
        </Field>
        {/* Show any already-uploaded images for this product */}
        {uploadedImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {uploadedImages.map((src) => (
              <div key={src} className="p-2">
                <img
                  src={src}
                  alt="existing image"
                  className="h-28 w-full object-cover rounded-md"
                />
                <div className="flex justify-center mt-1">
                  <button
                    type="button"
                    className="text-xs text-destructive underline"
                    onClick={() =>
                      setUploadedImages((prev) => prev.filter((u) => u !== src))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <MultiImageUpload
          // when editing, pass productId so upload endpoint attaches files to product
          productId={initialProduct?.id}
          onComplete={(items) => {
            // prefer publicUrl, fallback to path
            const urls = items.map((i) => i.publicUrl ?? i.path);
            // merge with any existing uploadedImages (avoid duplicates)
            setUploadedImages((prev) =>
              Array.from(new Set([...prev, ...urls.filter(Boolean)]))
            );
          }}
        />

        <div className="flex gap-2">
          {initialProduct ? (
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Update watch"}
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Create watch"}
            </Button>
          )}
          <Button
            variant="ghost"
            type="button"
            onClick={() => router.push("/admin/watches")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
