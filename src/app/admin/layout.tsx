import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { userService } from "@/services/userService";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Separator } from "@/components/ui/separator";

import { getSignedInUser } from "@/lib/utils/serverutils/utils";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
  }) {
  
  // Server-side auth + role check
  try {
    const {
      data: { user },
      error,
    } = await getSignedInUser();

    if (error || !user || !user.email) {
      // Not signed in - send to login
      redirect("/login");
    }

    const result = await userService.getUserByEmail(user.email);
    if (!result.success || !result.data) {
      // No matching application user
      redirect("/");
    }

    if (result.data.role !== "admin") {
      // Not an admin
      redirect("/");
    }
  } catch (err) {
    // On unexpected errors, redirect to home
    console.error("Admin auth check failed:", err);
    redirect("/");
  }

  return (
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
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          
        </header>
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
