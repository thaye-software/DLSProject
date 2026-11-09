"use client"

import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Scroll, Settings, User } from "lucide-react";

import { AvatarImage } from "@radix-ui/react-avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";



export function UserNavbarDropdown() {
  const { user, signOut, avatarUrl, role } = useSupabaseAuthContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSignOut() {
    signOut();
    redirect("/");
  }

  // Always render User icon during SSR
  const avatarContent = mounted && avatarUrl ? (
    <Avatar>
      <AvatarImage src={avatarUrl} alt="User Avatar" />
    </Avatar>
  ) : (
    <User />
  );


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="font-bold">
          {avatarContent}
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
            href="/watchlist"
            className="cursor-pointer hover:bg-accent relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <Scroll className="opacity-60" />
            Watchlist
          </Link>
          <Link
            href="/settings"
            className="cursor-pointer hover:bg-accent relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <Settings className="opacity-60" />
            Settings
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
