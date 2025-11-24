"use client";
import {ComponentProps, useEffect, useState} from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { GalleryVerticalEnd, Minus, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import Image from "next/image";
import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";
import { getAllConversations } from "@/services/conversationService";
import { useRealtimeConversations } from "@/hooks/useRealtimeConversations";
import { ConversationModel } from "@/database/types";



const data = {
  navMain: [
    {
      title: "Master data",
      url: "#",
      items: [
        {
          title: "Brands",
          url: "/admin/masterdata/brands",
        },
        {
          title: "Product Safety Info",
          url: "/admin/masterdata/product-safety-info",
        },
        {
          title: "Users",
          url: "/admin/masterdata/users",
        }
      ],
    },
  ],
}

export function AdminSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() || "";
  const { unreadCounts, setUnreadCounts } = useUnreadMessagesContext();

  const [initialConversations, setInitialConversations] = useState<ConversationModel[]>([]);

  // TODO 
  // - fix notifications in admin site 
  // - fix odd white space in some messages
  // - refactor and make ConversationDashboard more modular

  useEffect(() => {
    async function syncUnreadMessages() {

      const allConversations = await getAllConversations();
      setInitialConversations(allConversations);

      const unreadMessages: Record<string, number> = {};
      allConversations.forEach( conv => {
        unreadMessages[conv.id] = conv.messages.filter( message => message.isRead === false && message.senderType === "customer").length;
      });

      setUnreadCounts(unreadMessages)
    }
    syncUnreadMessages();

  }, [setUnreadCounts])

  useRealtimeConversations(initialConversations);

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  //                         ^^since unreadCounts is a record we we can extract the values by call .values on Objects.



  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                  <Image src="/logo.svg" alt="Logo" width={60} height={60} />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Limited Watches | Admin</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/customers")}> 
                <Link href="/admin/customers">Customers</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/exchange-rate")}> 
                <Link href="/admin/exchange-rate">Exchange Rate</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/orders")}> 
                <Link href="/admin/orders">Orders</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/watches")}> 
                <Link href="/admin/watches">Watches</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/conversations")}> 
                <Link href="/admin/conversations">
                  Conversations
                  {totalUnread > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-2 h-5 px-1.5 text-[10px] shrink-0"
                    >
                      {String(totalUnread)}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* Master Data */}
            {data.navMain.map((item, index) => (
              <Collapsible
                key={item.title}
                defaultOpen={index === 1}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      {item.title}{" "}
                      <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {item.items?.length ? (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname.startsWith(item.url)}
                            >
                              <Link href={item.url}>{item.title}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
