import Link from "next/link";

import { User as UserIcon } from "lucide-react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

import SearchBar from "./SearchBar";
import BrandNavItem from "./BrandNavItem";
import { UserNavbarDropdown } from "./UserNavbarDropdown";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";



export function Navbar() {
  const { user, isLoggedIn, loading, role } = useSupabaseAuthContext();

  return (
    <div className="flex justify-between items-center ">
      {/* Left side navigation */}
      <NavigationMenu>
        <NavigationMenuList className="flex-wrap">
          <NavigationMenuItem className="hidden md:block">
            <NavigationMenuTrigger className="font-bold transition-colors duration-300">
              Watches
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[200px] gap-4">
                <li>
                  <NavigationMenuLink asChild>
                    <Link href="/watches">All Watches</Link>
                  </NavigationMenuLink>

                  <NavigationMenuLink asChild>
                    <Link href="/watches/limited">Limited editions</Link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <BrandNavItem />

          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={`${navigationMenuTriggerStyle()} font-bold`}
            >
              <Link href="/about">About</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={`${navigationMenuTriggerStyle()} font-bold`}
            >
              <Link href="/contact">Contact</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      {/* Right side login */}
      <div className="ml-auto flex items-center gap-2">
        <div className="w-60 mr-10">
          <SearchBar />
        </div>
        {loading ? (
          <div>
          <Spinner />
          </div>
        ) : isLoggedIn && user ? (
          <UserNavbarDropdown />
        ) : (
          <Link href="/login">
            <Button variant="ghost">
              <UserIcon className="h-4 w-4" />
              <span className="font-bold">Log in</span>
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
