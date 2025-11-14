import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { LogOut, Settings, Truck, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "../ui/avatar";
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
            <Link
              href="/admin"
              className="cursor-pointer hover:bg-accent relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <User className="opacity-60" />
              Admin Panel
            </Link>
          ) : null}
          <Link
            href="/settings"
            className="cursor-pointer hover:bg-accent relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <Settings className="opacity-60" />
            Settings
          </Link>
          <Link
            href="/orders"
            className="cursor-pointer hover:bg-accent relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <Truck className="opacity-60" />
            Order history
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
