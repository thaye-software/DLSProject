"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, MessageSquare, Box } from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/tailwindUtils";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import type { ConversationModel } from "@/database/types";

import { ChatMessage } from "@/hooks/use-realtime-chat";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import useSyncUnreadCounts from "@/hooks/conversation-dashboard/useSyncUnreadCounts";
import useUIConversations from "@/hooks/conversation-dashboard/useUIConversations";
import useSetActiveChatReadZero from "@/hooks/conversation-dashboard/useSetActiveChatReadZero";

import { markAsRead } from "@/services/messageService";

import ChatListItem from "./ChatListItem";
import { RealtimeChat } from "@/components/Chat/RealtimeChat";

import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";



export type UIConversation = {
  id: string;
  productId: string;
  productSlug: string;
  productRef: string;
  productName: string;
  productImage: string | null;
  customerId: string;
  customerName: string;
  customerInitials: string;
  lastMessageContent: string;
  lastMessageAt: Date;
  lastMessageSenderId: string | null;
  status: string;
  unreadCount: number;
  sortedMessages: ChatMessage[]
};



export function ConversationDashboard({ initialConversations }:{initialConversations: ConversationModel[]}) {
  const [viewMode, setViewMode] = useState<"product" | "all">("product");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [visitedConversationIds, setVisitedConversationIds] = useState<Set<string>>(new Set());

  
  const { setUnreadCounts, addRealtimeMessage } = useUnreadMessagesContext();
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useSupabaseAuthContext();

  
  // Ref to track selected ID for the socket listener to avoid closure staleness
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedConversationId;
  }, [selectedConversationId]);


  //------------------------------ 1. HANDLE ACTIVE CHAT UNREADS ------------------------------
  // Since the global hook increments counters blindly, we must reset the counter
  // if the incoming message belongs to the currently selected conversation.
  useSetActiveChatReadZero(selectedConversationId, user);

  //------------------------------ 2. INITIAL UNREAD COUNT SETUP ------------------------------
  useSyncUnreadCounts(user, initialConversations, setUnreadCounts);
  
  //------------------------------ 3. DATA PREPARATION ------------------------------
  const allConversations = useUIConversations(initialConversations);



  //------------------------------ FILTERING & SORTING ------------------------------
  const filteredConversations = useMemo(() => {
    let data = [...allConversations];

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      data = data.filter(
        (c) =>
          c.productName.toLowerCase().includes(lowerQ) || c.customerName.toLowerCase().includes(lowerQ)
      );
    }

    data.sort((a, b) => {
      const dateA = a.lastMessageAt.getTime();
      const dateB = b.lastMessageAt.getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return data;
  }, [allConversations, searchQuery, sortOrder]);



  //------------------------------ GROUPING ------------------------------
  const groupedByProduct = useMemo(() => {
    const groups: Record<string, UIConversation[]> = {};
    filteredConversations.forEach((conv) => {
      if (!groups[conv.productId]) groups[conv.productId] = [];
      groups[conv.productId].push(conv);
    });

    return Object.entries(groups).map(([productId, items]) => ({
      productId,
      productSlug: items[0].productSlug,
      productRef: items[0].productRef,
      productName: items[0].productName,
      productImage: items[0].productImage,
      conversations: items,
      totalUnread: items.reduce((acc, curr) => acc + curr.unreadCount, 0),
    }));
  }, [filteredConversations]);



  //------------------------------ HANDLERS ------------------------------
  const handleSelectConversation = useCallback(async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setVisitedConversationIds((prev) => {
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });

    setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));

    try {
      if (user?.id) await markAsRead(conversationId, user.id);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }, [user?.id, setUnreadCounts]);


  const handleOutgoingMessage = useCallback((message: ChatMessage) => {
      // Update Global Context (this keeps Sidebar updated with "You sent a message")
      addRealtimeMessage(message.conversationId!, message);
  }, [addRealtimeMessage]);



  return (
    <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] h-[calc(100vh-6rem)] gap-4">
      {/* LEFT PANEL */}
      <Card className="flex flex-col h-full border-r-0 md:border-r shadow-none rounded-none md:rounded-lg overflow-hidden min-w-0">
        <CardHeader className="px-4 border-b space-y-3 shrink-0">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Inbox</h2>
            <div className="flex gap-2">
              <Select value={sortOrder} onValueChange={(order: any) => setSortOrder(order)}>
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
                {viewMode === "all" && filteredConversations.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={selectedConversationId === chat.id}
                    onClick={() => handleSelectConversation(chat.id)}
                    userId={user?.id as string}
                  />
                ))}

                {viewMode === "product" && (
                   <Accordion type="multiple" className="w-full space-y-2">
                    {groupedByProduct.map((group) => (
                      <AccordionItem key={group.productId} value={group.productId} className="border rounded-lg px-2">
                        <AccordionTrigger className="hover:no-underline py-3 pr-2">
                           <div className="flex items-start gap-3 text-left w-full overflow-hidden">
                             <Link href={`/watches/view/${group.productSlug}`}>
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
                               <p className="text-xs text-muted-foreground mb-2">ref: {group.productRef}</p>
                               <p className="text-xs text-muted-foreground">{group.conversations.length} {group.conversations.length === 1 ? "chat" : "chats"}</p>
                             </div>
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-2 pl-0 ml-5 border-l-2 border-muted space-y-1 pr-2">
                          {group.conversations.map((chat) => (
                            <ChatListItem
                              key={chat.id}
                              chat={chat}
                              isSelected={selectedConversationId === chat.id}
                              onClick={() => handleSelectConversation(chat.id)}
                              compact
                              userId={user?.id as string}
                            />
                          ))}
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
        {initialConversations.map((conv) => {
          const chat = allConversations.find((c) => c.id === conv.id);
          const isSelected = selectedConversationId === conv.id;
          
          if (!visitedConversationIds.has(conv.id)) return null;

          return (
            <div key={conv.id} className={cn("flex flex-col h-full min-h-0", isSelected ? "flex" : "hidden")}>
              {/* ... Chat UI ... */}
              {chat && (
                <>
                  <CardHeader>...</CardHeader>
                  <div className="flex-1 min-h-0 w-full">
                    <RealtimeChat
                      conversation={conv}
                      //@ts-ignore
                      messages={chat.sortedMessages}
                      userId={user?.id as string}
                      username={user?.user_metadata.display_name}
                      onMessageReceived={handleOutgoingMessage} 
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {!selectedConversationId && (
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
