"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ModeToggle } from "@/components/ModeToggle";
import React from "react";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide header/nav/footer on the login page (and any nested auth pages)
  const hideRootShell =
    pathname === "/login" || pathname?.startsWith("/login/");

  return (
    <>
      {!hideRootShell && (
        <header>
          <div className="flex items-center justify-between w-full px-4">
            <div></div>

            <div className="flex items-center gap-4">
              <Image
                src="/logo.svg"
                alt="Limited Watches Logo"
                width={80}
                height={80}
              />
              <h1 className="text-3xl font-seasons font-semibold text-champagne">
                Limited Watches
              </h1>
            </div>

            <div className="w-20 flex justify-end">
              <ModeToggle />
            </div>
          </div>
        </header>
      )}

      {!hideRootShell && (
        <nav className="container mx-auto">
          <Navbar />
        </nav>
      )}

      {/* main content area */}
      {hideRootShell ? (
        // For auth pages (login/register) we want the page to take full height
        // and avoid the extra top/bottom padding that the root layout adds,
        // which caused a small vertical scroll.
        <div className="min-h-screen w-full">{children}</div>
      ) : (
        <main className="container mx-auto flex-1 pt-5 pb-5">{children}</main>
      )}

      {!hideRootShell && <Footer />}
    </>
  );
}
