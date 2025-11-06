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

export default function NewWatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<BrandModel[]>([]);

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

    const payload = {
      brand: form.brand,
      model: form.model,
      reference: form.reference,
      serialNumber: form.serialNumber,
      year: Number(form.year),
      size: form.size || null,
      movement: form.movement || null,
      glassType: form.glassType || null,
      limited: form.limited === "true",
      box: form.box === "true",
      papers: form.papers === "true",
      condition: Number(form.condition),
      braceletType: form.braceletType || null,
      braceletColor: form.braceletColor || null,
      dialColor: form.dialColor || null,
      vat: form.vat ? Number(form.vat) : null,
      productSafetyInfoId: form.productSafetyInfoId
        ? Number(form.productSafetyInfoId)
        : null,
    };

    try {
      const res = await fetch("/api/admin/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data?.message || `Request failed: ${res.status}` });
        setLoading(false);
        return;
      }

      // On success redirect to watches list
      router.push("/admin/watches");
    } catch (err: any) {
      setErrors({ submit: err?.message || "Unknown error" });
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

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 max-w-3xl"
      >
        <Field>
          <FieldLabel>Brand</FieldLabel>
          <FieldContent>
            <CustomSelect placeholderText={"Select a brand"} array={brands} />
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
            <FieldLabel>Size<span className="text-xs text-muted-foreground mt-1">mm</span></FieldLabel>
            <FieldContent>
              <Input name="size" value={form.size} onChange={handleChange} />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Movement</FieldLabel>
            <FieldContent>
              <CustomSelect placeholderText={"Select a movement"} array={constants.MOVEMENT_OPTIONS} />
            </FieldContent>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field>
            <FieldLabel>Glass Type</FieldLabel>
            <FieldContent>
              <CustomSelect placeholderText={"Select a glass type"} array={constants.GLASS_OPTIONS} />
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
                value={form.vat}
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
                  setForm((prev) => ({ ...prev, box: checked ? "true" : "false" }));
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
                  setForm((prev) => ({ ...prev, papers: checked ? "true" : "false" }));
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
                  setForm((prev) => ({ ...prev, limited: checked ? "true" : "false" }));
                }}
              />
            </FieldContent>
          </Field>
        </div>

        <Field>
          <FieldLabel>Price (DKK)</FieldLabel>
          <FieldContent>
            <Input
              name="price"
              value={form.price}
              onChange={handleChange}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Bracelet Type</FieldLabel>
          <FieldContent>
            <CustomSelect placeholderText={"Select a bracelet type"} array={constants.BRACELET_OPTIONS} />
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
        <MultiImageUpload />

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
