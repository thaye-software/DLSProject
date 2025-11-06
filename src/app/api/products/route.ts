import { NextResponse } from "next/server";
import { productService } from "@/services/productService";
import { NewProductModel } from "@/database/types";

export async function GET() {
  const result = await productService.getAllProducts();
  
  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NewProductModel>;

    const { watchId, productType, name, priceDkk, description } = body;

    // Basic validation for required fields
    if (
      watchId === undefined ||
      !productType ||
      !name ||
      priceDkk === undefined ||
      !description
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: watchId, productType, name, priceDkk, description",
        },
        { status: 400 }
      );
    }

    // Ensure price is a number (client may send string)
    const price = typeof priceDkk === "string" ? Number(priceDkk) : priceDkk;
    if (Number.isNaN(price)) {
      return NextResponse.json(
        { error: "priceDkk must be a valid number" },
        { status: 400 }
      );
    }

    // Convert kroner to øre (1 DKK = 100 øre)
    const priceInOere = Math.round(price * 100);

    const productData: Omit<NewProductModel, "id" | "createdAt"> = {
      watchId,
      productType,
      name,
      priceDkk: priceInOere,
      description,
    };

    const result = await productService.createProduct(productData);

    if (result.success) {
      return NextResponse.json(result.data, { status: 201 });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
