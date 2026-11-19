"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, MessageSquare, Box } from "lucide-react";
import { useState, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";
import type { Conversation } from "@/services/conversationService";

import ChatListItem from "./ChatListItem";
import { RealtimeChat } from "@/components/Chat/RealtimeChat";

const lastActivity = (c: Conversation) => new Date(c.last_message?.created_at ?? c.created_at).getTime();

// Conversations come from the polling UnreadMessagesProvider in the admin layout.
export function ConversationDashboard() {
  const [viewMode, setViewMode] = useState<"product" | "all">("product");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { user } = useSupabaseAuthContext();
  const { conversations, refresh } = useUnreadMessagesContext();

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const data = conversations.filter(
      (c) => !q || c.product_name.toLowerCase().includes(q) || c.customer_display_name.toLowerCase().includes(q),
    );
    return data.sort((a, b) => (sortOrder === "newest" ? lastActivity(b) - lastActivity(a) : lastActivity(a) - lastActivity(b)));
  }, [conversations, searchQuery, sortOrder]);

  const groupedByProduct = useMemo(() => {
    const groups: Record<string, Conversation[]> = {};
    filteredConversations.forEach((c) => (groups[c.product_id] ||= []).push(c));
    return Object.entries(groups).map(([productId, items]) => ({
      productId,
      productName: items[0].product_name,
      productImage: items[0].thumbnail_url,
      conversations: items,
      totalUnread: items.reduce((acc, c) => acc + c.unread_count, 0),
    }));
  }, [filteredConversations]);

  const selected = conversations.find((c) => c.conversation_id === selectedId) ?? null;

  const item = (chat: Conversation, compact = false) => (
    <ChatListItem
      key={chat.conversation_id}
      chat={chat}
      isSelected={selectedId === chat.conversation_id}
      onClick={() => setSelectedId(chat.conversation_id)}
      compact={compact}
      userId={user?.id as string}
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] h-[calc(100vh-6rem)] gap-4">
      {/* LEFT PANEL */}
      <Card className="flex flex-col h-full border-r-0 md:border-r shadow-none rounded-none md:rounded-lg overflow-hidden min-w-0">
        <CardHeader className="px-4 border-b space-y-3 shrink-0">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Inbox</h2>
            <div className="flex gap-2">
              <Select value={sortOrder} onValueChange={(order) => setSortOrder(order as "newest" | "oldest")}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={viewMode} onValueChange={(mode) => setViewMode(mode as "product" | "all")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product">By Product</TabsTrigger>
              <TabsTrigger value="all">All Chats</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product or customer..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>

        <div className="flex-1 min-h-0 w-full">
          <ScrollArea className="h-full">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-10 w-10 mb-2 opacity-20" />
                <p>No conversations found.</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {viewMode === "all" && filteredConversations.map((chat) => item(chat))}

                {viewMode === "product" && (
                  <Accordion type="multiple" className="w-full space-y-2">
                    {groupedByProduct.map((group) => (
                      <AccordionItem key={group.productId} value={group.productId} className="border rounded-lg px-2">
                        <AccordionTrigger className="hover:no-underline py-3 pr-2">
                          <div className="flex items-start gap-3 text-left w-full overflow-hidden">
                            {/* the watch page redirects an unknown slug to the right one */}
                            <Link href={`/watches/view/${group.productId}/_`}>
                              <div className="h-14 w-14 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
                                {group.productImage ? (
                                  <Image className="h-full w-full object-cover" src={group.productImage} alt={group.productName} fill unoptimized />
                                ) : <Box className="h-5 w-5 opacity-50" />}
                              </div>
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium truncate text-sm pr-2" title={group.productName}>{group.productName}</h4>
                                {group.totalUnread > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px] shrink-0">{group.totalUnread}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{group.conversations.length} {group.conversations.length === 1 ? "chat" : "chats"}</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-2 pl-0 ml-5 border-l-2 border-muted space-y-1 pr-2">
                          {group.conversations.map((chat) => item(chat, true))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </Card>

      {/* RIGHT PANEL */}
      <Card className="flex flex-col h-full min-h-0 overflow-hidden shadow-none border-0 md:border">
        {selected ? (
          <>
            <CardHeader className="border-b font-semibold">
              {selected.customer_display_name} · {selected.product_name}
            </CardHeader>
            <div className="flex-1 min-h-0 w-full">
              <RealtimeChat
                key={selected.conversation_id}
                conversation={selected}
                userId={user?.id as string}
                onRead={refresh}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">No chat selected</p>
            <p className="text-sm">Select a conversation to view details</p>
          </div>
        )}
      </Card>
    </div>
  );
}
