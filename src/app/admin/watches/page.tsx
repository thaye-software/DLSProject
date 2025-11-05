import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function WatchesAdminPage() {

  return (
    <div>
      <h1>Watches Administration</h1>
      <Link href="/admin/watches/new">
        <Button>Create new listing</Button>
      </Link>
      
    </div>
  );
}