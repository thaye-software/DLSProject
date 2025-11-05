import { NextResponse } from "next/server";
import { brandService } from "@/services/brandService";
export async function GET() {
  const result = await brandService.getAllBrands();
  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}