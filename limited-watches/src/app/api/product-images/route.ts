import { NextResponse } from "next/server";
import { productImagesService } from "@/services/productImagesService";
import { NewProductImageModel } from "@/database/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NewProductImageModel>;

    const { imageUrl, isThumbnail } = body;

    // Basic validation for required fields
    if (!imageUrl) {
      return NextResponse.json(
        {
          error: "Missing required field: imageUrl",
        },
        { status: 400 }
      );
    }

    const productImageData: Omit<NewProductImageModel, "id" | "createdAt"> = {
      imageUrl,
      isThumbnail,
    };

    const result = await productImagesService.createProductImage(
      productImageData
    );

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