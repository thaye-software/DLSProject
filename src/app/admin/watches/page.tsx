"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function WatchesAdminPage() {

  async function fetchAllWatches() {
    const response = await fetch('/api/products');
    const data = await response.json();
    console.log('Watches:', data);
  }  

  return (
    <div>
      <h1>Watches Administration</h1>
      <Link href="/admin/watches/new">
        <Button>Create new listing</Button>
      </Link>
      <Button onClick={() => fetchAllWatches()}>Fetch all watches</Button>
    </div>
  );
}