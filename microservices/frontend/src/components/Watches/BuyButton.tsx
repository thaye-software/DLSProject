import Link from "next/link";
import { Button } from "../ui/button";

export default function BuyButton({ productId, available }: { productId: string; available: boolean }) {
  return available ? (
    <Link href={`/orders/checkout/infomation?product=${encodeURIComponent(productId)}`}>
      <Button className="h-12 cursor-pointer font-bold py-4 px-20 transition-all">Buy</Button>
    </Link>
  ) : (
    <Button disabled className="h-12 font-bold py-4 px-8">
      Not available
    </Button>
  );
}
