"use client";

import Link from "next/link";
import { User } from "lucide-react";
import Image from "next/image";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export function Navbar() {
  return (
    <div className="flex justify-between items-center ">
      {/* Left side navigation */}
      <NavigationMenu>
        <NavigationMenuList className="flex-wrap">
          <NavigationMenuItem className="hidden md:block">
            <NavigationMenuTrigger className="font-bold">Watches</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[200px] gap-4">
                <li>
                  <NavigationMenuLink asChild>
                    <Link href="#">All Watches</Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link href="#">New Arrivals</Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link href="#">Limited editions</Link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem className="hidden md:block">
            <NavigationMenuTrigger className="font-bold">Brands</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[200px] gap-4">
                <li>
                  <NavigationMenuLink asChild>
                    <Link href="#" className="flex-row items-center gap-2">
                      <Image
                        src="/brands/cartier.svg"
                        alt="Cartier Logo"
                        width={16}
                        height={16}
                      />
                      Cartier
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link href="#" className="flex-row items-center gap-2">
                      <Image
                        src="/brands/omega.svg"
                        alt="Omega Logo"
                        width={16}
                        height={16}
                      />
                      Omega
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link href="#" className="flex-row items-center gap-2">
                      <Image
                        src="/brands/jaeger.svg"
                        alt="Jaeger LeCoultre Logo"
                        width={16}
                        height={16}
                      />
                      Jaeger LeCoultre
                    </Link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={`${navigationMenuTriggerStyle()} font-bold`}
            >
              <Link href="/auctions">Auctions</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={`${navigationMenuTriggerStyle()} font-bold`}
            >
              <Link href="/blog">Blog</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
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
      <div className="ml-auto">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
        >
          <User className="h-4 w-4" />
          <span className="font-bold">Login</span>
        </Link>
      </div>
    </div>
  );
}