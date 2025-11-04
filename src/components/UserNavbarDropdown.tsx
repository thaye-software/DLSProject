import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { LogOut, Settings, Truck, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "./ui/avatar";
import { AvatarImage } from "@radix-ui/react-avatar";

export function UserNavbarDropdown() {
  const { user, signOut, avatarUrl, role } = useSupabaseAuth();

  function handleSignOut() {
    signOut();
    redirect("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="font-bold">
          {avatarUrl ? (
            <Avatar>
              <AvatarImage src={avatarUrl} alt="User Avatar" />
            </Avatar>
          ) : (
            <User />
          )}{" "}
          {user?.user_metadata.display_name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuGroup>
          {role === "admin" ? (
            <DropdownMenuItem>
              <Link href="/admin" className="flex items-center gap-2">
                <User />
                Admin Panel
              </Link>
            </DropdownMenuItem>
          ) : null}
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
  );
}
