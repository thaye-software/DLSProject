import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSupabaseAuth } from "@/lib/useSupabaseAuth"
import { LogOut, Settings, Truck, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export function UserNavbarDropdown() {

  function handleSignOut() {
    signOut();
    redirect('/');
  }

  const { user, signOut } = useSupabaseAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="font-bold"><User />{user?.user_metadata.display_name}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuGroup>
            <DropdownMenuItem>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings />
              Settings
            </Link>
            </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/orders" className="flex items-center gap-2">
              <Truck />
              Order history
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
