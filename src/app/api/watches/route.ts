import { NextResponse } from "next/server";
import { watchService } from "@/services/watchService";
import { NewWatchModel, NewProductModel } from "@/database/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NewWatchModel>;

    const {
      brandId,
      model,
      reference,
      serialNumber,
      year,
      size,
      movement,
      glassType,
      limited,
      box,
      papers,
      condition,
      braceletType,
      braceletColor,
      dialColor,
      vat,
    } = body;

    // Required fields validation
    if (
      brandId === undefined ||
      !model ||
      !reference ||
      !serialNumber ||
      year === undefined ||
      condition === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: brandId, model, reference, serialNumber, year, condition",
        },
        { status: 400 }
      );
    }

    // Coerce numeric fields
    const brand = typeof brandId === "string" ? Number(brandId) : brandId;
    const yearNum = typeof year === "string" ? Number(year) : year;
    const conditionNum =
      typeof condition === "string" ? Number(condition) : condition;
    const vatNum =
      vat !== undefined
        ? typeof vat === "string"
          ? Number(vat)
          : vat
        : undefined;

    const watchData: Omit<NewWatchModel, "id"> = {
      brandId: brand as number,
      productId: undefined as any, // will be set in transactional flow if needed
      model,
      reference,
      serialNumber,
      year: yearNum as number,
      size: size ?? null,
      movement: movement ?? null,
      glassType: glassType ?? null,
      limited: Boolean(limited) ?? false,
      box: Boolean(box) ?? false,
      papers: Boolean(papers) ?? false,
      condition: conditionNum as number,
      braceletType: braceletType ?? null,
      braceletColor: braceletColor ?? null,
      dialColor: dialColor ?? null,
      vat: vatNum as number | undefined,
    };

    // If client provided product data or images, use the transactional flow
    const bodyAny = body as any;
    if (bodyAny.productData || bodyAny.imageUrls) {
      const productData = (bodyAny.productData ??
        {}) as Partial<NewProductModel>;
      const imageUrls = Array.isArray(bodyAny.imageUrls)
        ? bodyAny.imageUrls
        : undefined;

      const txResult = await watchService.createWatchWithProductAndImages({
        watchData,
        productData: productData as Omit<NewProductModel, "id" | "createdAt">,
        imageUrls,
      });

      if (txResult.success) {
        return NextResponse.json(txResult.data, { status: 201 });
      }

      return NextResponse.json({ error: txResult.error }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
