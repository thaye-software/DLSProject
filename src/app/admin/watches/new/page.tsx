"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateWatchForm from "@/components/admin/watches/CreateWatchForm";
import { BrandModel } from "@/database/types";

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
    productSafetyInfoId: "",
  });

  return (
    <div>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push("/admin/watches")}>
            <ArrowLeft />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">New Watch</h1>
          <div />
        </div>
      </div>

      <CreateWatchForm
        form={form}
        setForm={setForm}
        brands={brands}
        errors={errors}
        setErrors={setErrors}
        loading={loading}
        setLoading={setLoading}
        uploadedImages={uploadedImages}
        setUploadedImages={setUploadedImages}
      />
    </div>
  );
}
