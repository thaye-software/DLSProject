import { WatchTable } from "@/components/Admin/watches/WatchTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getAllProducts } from "@/services/productService";

export default async function WatchesAdminPage() {
  // Server-side: fetch all products and pass into the client WatchTable.
  const products = await getAllProducts();

  return (
    <div>
      <h1>Watches Administration</h1>
      <Link href="/admin/watches/new">
        <Button>Create new listing</Button>
      </Link>
      <WatchTable initialProducts={products} />
    </div>
  );
}
