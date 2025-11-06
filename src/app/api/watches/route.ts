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

    if (
      Number.isNaN(Number(brand)) ||
      Number.isNaN(Number(yearNum)) ||
      Number.isNaN(Number(conditionNum))
    ) {
      return NextResponse.json(
        { error: "brandId, year and condition must be valid numbers" },
        { status: 400 }
      );
    }

    const watchData: Omit<NewWatchModel, "id"> = {
      brandId: brand as number,
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

      // Basic product validation
      if (
        !productData.productType ||
        !productData.name ||
        productData.priceDkk === undefined ||
        !productData.description
      ) {
        return NextResponse.json(
          {
            error:
              "Missing required product fields: productType, name, priceDkk, description",
          },
          { status: 400 }
        );
      }

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

    // fallback: just create the watch
    const result = await watchService.createWatch(watchData);

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
