"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import constants from "@/lib/constants";
import CustomSelect from "@/components/CustomSelect";
import { BrandModel } from "@/database/types";
import MultiImageUpload from "@/components/MultiImageUpload";
import { createNewWatchSchema } from "./validation";
import { z } from "zod";

export default function NewWatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<BrandModel[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  async function fetchBrands() {
    try {
      const res = await fetch("/api/brands");
      if (!res.ok) {
        throw new Error("Failed to fetch brands");
      }

      const data = await res.json();
      setBrands(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchBrands();
  }, []);

  const [form, setForm] = useState({
    brand: "",
    model: "",
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
    productSafetyInfoId: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Basic client validation
    const newErrors: Record<string, string> = {};
    if (!form.brand) newErrors.brand = "Brand is required";
    if (!form.model) newErrors.model = "Model is required";
    if (!form.reference) newErrors.reference = "Reference is required";
    if (!form.serialNumber)
      newErrors.serialNumber = "Serial number is required";
    if (!form.year || isNaN(Number(form.year)))
      newErrors.year = "Year must be a number";
    if (!form.condition || isNaN(Number(form.condition)))
      newErrors.condition = "Condition must be a number";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    let parsed;
    try {
      parsed = createNewWatchSchema.parse(form);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors({ submit: err.message });
      }
      setLoading(false);
      return;
    }

    // Build payload for transactional creation: watch + product + images using parsed/coerced values
    const payload = {
      brandId: parsed.brand,
      model: parsed.model,
      reference: parsed.reference,
      serialNumber: parsed.serialNumber,
      year: parsed.year,
      size: parsed.size || null,
      movement: parsed.movement || null,
      glassType: parsed.glassType || null,
      limited: parsed.limited ?? false,
      box: parsed.box ?? false,
      papers: parsed.papers ?? false,
      condition: parsed.condition,
      braceletType: parsed.braceletType || null,
      braceletColor: parsed.braceletColor || null,
      dialColor: parsed.dialColor || null,
      vat: parsed.vat,
      productSafetyInfoId: parsed.productSafetyInfoId,
      // productData that will be created and linked to the watch
      productData: {
        productType: "watch",
        name: `${parsed.model}`,
        priceDkk: parsed.price ?? 0,
        description: `${parsed.model} ${parsed.reference}`,
      },
      imageUrls: uploadedImages,
    };

    try {
      const response = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to create watch: ${errText}`);
      }

      const data = await response.json();
      // transaction returns { watch, product, images }
      const watchId = data?.watch?.id ?? data?.id;
      if (watchId) router.push(`/admin/watches/${watchId}`);
    } catch (error) {
      console.error(error);
      setErrors({ submit: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.push("/admin/watches")}>
          <ArrowLeft />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">New Watch</h1>
        <div />
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 max-w-3xl">
        <Field>
          <FieldLabel>Brand</FieldLabel>
          <FieldContent>
            <CustomSelect
              placeholderText={"Select a brand"}
              array={brands}
              value={form.brand}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, brand: val }))
              }
            />
            <FieldDescription>Brand of the watch</FieldDescription>
            {errors.brand && <FieldError>{errors.brand}</FieldError>}
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

          <Field>
            <FieldLabel>VAT (DKK)</FieldLabel>
            <FieldContent>
              <Input
                name="vat"
                // value={form.vat}
                defaultValue={20}
                onChange={handleChange}
                type="number"
              />
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
          </FieldContent>
        </Field>
        <MultiImageUpload
          onComplete={(items) => {
            // prefer publicUrl, fallback to path
            const urls = items.map((i) => i.publicUrl ?? i.path);
            setUploadedImages(urls.filter(Boolean) as string[]);
          }}
        />

        {errors.submit && (
          <div className="text-destructive">{errors.submit}</div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Create watch"}
          </Button>
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
