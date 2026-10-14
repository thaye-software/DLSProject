import { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

import { AdminSidebar } from "@/components/Admin/Sidebar/AdminSidebar";

import { UnreadMessagesProvider } from "@/context/UnreadMessagesContext";

import { getAuthUser } from "@/lib/utils/server/utils";
import { ModeToggle } from "@/components/Navbar/ModeToggle";
import { UserNavbarDropdown } from "@/components/Navbar/UserNavbarDropdown";

export const dynamic = "force-dynamic";



export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Server-side auth + role check
  const { user, role } = await getAuthUser();

  if (!user || role !== "admin") {
    // Not an admin - redirect to home
    redirect("/");
  }

  return (
    <UnreadMessagesProvider>

      <SidebarProvider
        style={
          {
            "--sidebar-width": "19rem",
          } as React.CSSProperties
        }
        >
        <AdminSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <div className="flex justify-between w-full items-center">
              <div className="flex items-center justify-center">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                  />
              </div>

              <div className="flex items-center justify-center gap-2">
                <ModeToggle />
                <UserNavbarDropdown />
              </div>
            </div>
          </header>
          <main className="p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>

    </UnreadMessagesProvider>
  );
}
