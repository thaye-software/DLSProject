"use server";
import { watchService } from "@/services/watchService";
import { revalidatePath } from "next/cache";

export async function updateWatch(formData: FormData): Promise<any> {
  const data = Object.fromEntries(formData);

  // product id is required for updates
  const productId = data.productId as string | undefined;
  if (!productId) {
    throw new Error("productId required for update");
  }

  const priceGross = parseFloat(data.price as string);
  const priceNet = priceGross / 1.25;

  try {
    const res = await watchService.updateWatchWithProductAndImages({
      productId,
      watchData: {
        brandId: data.brandId as string,
        model: data.model as string,
        reference: data.reference as string,
        serialNumber: data.serialNumber as string,
        year: data.year ? parseInt(data.year as string) : undefined,
        condition: data.condition
          ? parseInt(data.condition as string)
          : undefined,
        box: data.box === "true",
        papers: data.papers === "true",
        limited: data.limited === "true",
        glassType: data.glassType as string,
        braceletType: data.braceletType as string,
        braceletColor: data.braceletColor as string,
        dialColor: data.dialColor as string,
        vat: data.vat ? parseFloat(data.vat as string) : null,
        size: data.size ? Number(data.size) : undefined,
        movement: data.movement as string,
      },
      productData: {
        name: data.productName as string,
        description: data.description as string,
        priceDkk: Math.round(priceNet * 100),
        stock: data.stock ? parseInt(data.stock as string) : undefined,
      },
      imageUrls: (data.imageUrls as string)?.split(",") ?? [],
    });

    // revalidate both admin watch pages
    revalidatePath(`/admin/watches`);
    revalidatePath(`/admin/watches/${productId}/edit`);

    return res;
  } catch (err) {
    console.error("Error updating watch/product/images:", err);
    throw err;
  }
}
