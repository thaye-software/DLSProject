import { NextResponse } from "next/server";
import { productService } from "@/services/productService";

export async function GET() {
  const result = await productService.getAllProducts();
  
  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}
