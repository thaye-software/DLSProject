"use server";
import { watchService } from "@/services/watchService";
import { revalidatePath } from "next/cache";

export async function createWatch(formData: FormData): Promise<any> {
  const newWatch = Object.fromEntries(formData);

  // convert price to net, vat is always 25% on input
  const priceGross = parseFloat(newWatch.price as string);
  const priceNet = priceGross / 1.25;

  try {
    const res = await watchService.createWatchWithProductAndImages({
      watchData: {
        brandId: newWatch.brandId as string,
        model: newWatch.model as string,
        internalId: newWatch.internalId as string,
        reference: newWatch.reference as string,
        serialNumber: newWatch.serialNumber as string,
        year: parseInt(newWatch.year as string),
        condition: parseInt(newWatch.condition as string),
        box: newWatch.box === "true",
        papers: newWatch.papers === "true",
        limited: newWatch.limited === "true",
        glassType: newWatch.glassType as string,
        braceletType: newWatch.braceletType as string,
        braceletColor: newWatch.braceletColor as string,
        dialColor: newWatch.dialColor as string,
        vat: newWatch.vat ? parseFloat(newWatch.vat as string) : null,
        size: Number(newWatch.size),
        movement: newWatch.movement as string,
      },
      productData: {
        name: newWatch.productName as string,
        productType: "watch",
        description: newWatch.description as string,
        // convert price to number of øre
        priceDkk: Math.round(priceNet * 100),
        stock: parseInt(newWatch.stock as string),
      },
      imageUrls: (newWatch.imageUrls as string)?.split(",") || [],
    })
    revalidatePath("/admin/watches/new");
    return res;
  } catch (err) {
    console.error("Error creating watch:", err);
    throw err;
  }
}