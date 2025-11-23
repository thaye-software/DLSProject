"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Search, MessageSquare, Box } from "lucide-react";
import { cn } from "@/lib/tailwindUtils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ConversationModel } from "@/database/types";
import Image from "next/image";
import Link from "next/link";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { RealtimeChat } from "@/components/Chat/RealtimeChat";
import { ChatMessage } from "@/hooks/use-realtime-chat";
import { markAsRead } from "@/services/messageService";
import { createClient } from "@/database/supabase/client";
import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";
import ChatListItem from "./ChatListItem";

// --- TYPES ---
export type UIConversation = {
  id: string;
  productId: string;
  productSlug: string;
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
  sortedMessages: {
    id: string;
    createdAt: Date | null;
    conversationId: string;
    senderId: string;
    senderType: string;
    content: string;
    isRead: boolean | null;
  }[];
};

interface ConversationDashboardProps {
  initialConversations: ConversationModel[];
}

export function ConversationDashboard({ initialConversations }: ConversationDashboardProps) {
  const [viewMode, setViewMode] = useState<"product" | "all">("product");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [visitedConversationIds, setVisitedConversationIds] = useState<Set<string>>(new Set());
  
  // Store an ARRAY of messages per conversation, not just the single latest one
  const [realtimeMessagesMap, setRealtimeMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  
  const { unreadCounts, setUnreadCounts } = useUnreadMessagesContext();
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useSupabaseAuth();
  const supabase = createClient();

  // Ref to track selected ID for the socket listener to avoid closure staleness
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // --- 1. GLOBAL SUBSCRIPTION ---
  useEffect(() => {
    // Guard clauses
    if (!initialConversations || initialConversations.length === 0 || !user) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    initialConversations.forEach((conv) => {
      // CRITICAL FIX: This MUST match the channel name used in useRealtimeChat
      // Previous incorrect code: const channelName = `dashboard:${conv.id}`;
      const channelName = `chat:${conv.id}`; 
      
      const channel = supabase.channel(channelName);

      channel
        .on("broadcast", { event: "message" }, (payload) => {
          const incomingMessage = payload.payload as ChatMessage;

          // Safety check to ensure message belongs to this conversation
          if (incomingMessage.conversationId === conv.id) {
            
            // 1. Update the messages list (Sidebar snippet & Stale data fix)
            setRealtimeMessagesMap((prev) => {
              const currentList = prev[conv.id] || [];
              // Deduplicate logic: Don't add if ID already exists
              if (currentList.some(m => m.id === incomingMessage.id)) return prev;
              
              return {
                ...prev,
                [conv.id]: [...currentList, incomingMessage]
              };
            });

            // 2. Handle Notifications
            // Logic: Message is from Customer AND (Chat is NOT selected OR Window is not focused)
            const isFromCustomer = incomingMessage.senderType === 'customer';
            const isNotFromMe = incomingMessage.senderId !== user.id;
            
            // Check the Ref (Current State) to see if we are viewing this chat
            const isChatOpen = selectedIdRef.current === conv.id;

            if (isFromCustomer && isNotFromMe && !isChatOpen) {
              setUnreadCounts((prev) => ({
                ...prev,
                [conv.id]: (prev[conv.id] ?? 0) + 1,
              }));
            }
          }
        })
        .subscribe((status) => {
          console.log(`Subscribed to ${channelName}: ${status}`);
        });

      channels.push(channel);
    });

    // Cleanup: Unsubscribe when the component unmounts
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    
    // DEPENDENCIES: Only re-run if the user changes or the list of conversations changes.
    // We purposefully exclude 'setUnreadCounts' to avoid re-subscribing on every count update.
  }, [initialConversations, supabase, user]);

  // --- 2. INITIAL UNREAD COUNT SETUP  ---
  useEffect(() => {
    if (!user || !initialConversations) return;
    
    const initialUnreads: Record<string, number> = {};
    initialConversations.forEach((conv) => {
      // Calculate from DB data
      const dbCount = conv.messages.filter(
        (message) => !message.isRead && message.senderType === "customer" && message.senderId !== user.id
      ).length;
      
      initialUnreads[conv.id] = dbCount;
    });
    
    setUnreadCounts(initialUnreads);
  }, [initialConversations, user]); 
  
  // --- 3. DATA PREPARATION ---
  const allConversations = useMemo<UIConversation[]>(() => {
    return initialConversations.map((conv) => {
      // 1. Sort Database Messages
      const sortedDbMessages = [...conv.messages].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      // 2. Get Realtime Messages for this chat
      const newMessages = realtimeMessagesMap[conv.id] || [];
      const sortedNewMessages = [...newMessages].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // 3. Determine "True" Latest Message
      const latestDb = sortedDbMessages[0];
      const latestRealtime = sortedNewMessages[0];
      
      let lastMsgObj: any = latestDb;
      
      if (latestRealtime) {
        if (!latestDb) {
            lastMsgObj = latestRealtime;
        } else {
            const liveTime = new Date(latestRealtime.createdAt).getTime();
            const dbTime = latestDb.createdAt ? new Date(latestDb.createdAt).getTime() : 0;
            if (liveTime >= dbTime) {
                lastMsgObj = latestRealtime;
            }
        }
      }

      // 4. Customer Info Logic
      let customerName = "Unknown Customer";
      let customerInitials = "??";

      // Try to find customer details from DB messages first, then Realtime
      const customerMsg = sortedDbMessages.find((m) => m.senderType === "customer") 
                       || newMessages.find(m => m.senderType === "customer");

      //@ts-ignore
      if (customerMsg?.sender) {
        //@ts-ignore
        const { firstName, lastName, username } = customerMsg.sender;
        customerName = firstName && lastName ? `${firstName} ${lastName}` : username || "Customer";
      }

      if (customerName !== "Unknown Customer") {
        customerInitials = customerName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
      }

      const imgUrl = conv.product.productImages?.[0]
        ? (conv.product.productImages[0] as any).url || (conv.product.productImages[0] as any).imageUrl
        : null;

      let productName = conv.product.watch.brand.name + " " + conv.product.watch.model;
      if (productName.length > 35) {
        productName = productName.substring(0, 25) + "...";
      }

      return {
        id: conv.id,
        productId: conv.productId,
        productSlug: conv.product.watch.slug,
        productName,
        productImage: imgUrl,
        customerId: conv.customerId,
        customerName,
        customerInitials,
        lastMessageContent: lastMsgObj?.content || "No messages yet",
        lastMessageAt: lastMsgObj?.createdAt
          ? new Date(lastMsgObj.createdAt)
          : new Date(conv.createdAt || Date.now()),
        lastMessageSenderId: lastMsgObj?.senderId || lastMsgObj?.sender?.id || null,
        status: conv.status || "open",
        unreadCount: unreadCounts[conv.id] ?? 0,
        sortedMessages: sortedDbMessages, // Only pass DB messages here, realtime passed separately to Chat
      };
    });
  }, [initialConversations, realtimeMessagesMap, unreadCounts]);

  // --- FILTERING & SORTING ---
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

  // --- GROUPING ---
  const groupedByProduct = useMemo(() => {
    const groups: Record<string, UIConversation[]> = {};
    filteredConversations.forEach((conv) => {
      if (!groups[conv.productId]) groups[conv.productId] = [];
      groups[conv.productId].push(conv);
    });

    return Object.entries(groups).map(([productId, items]) => ({
      productId,
      productSlug: items[0].productSlug,
      productName: items[0].productName,
      productImage: items[0].productImage,
      conversations: items,
      totalUnread: items.reduce((acc, curr) => acc + curr.unreadCount, 0),
    }));
  }, [filteredConversations]);

  // --- HANDLERS ---
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

  // This handles messages sent by YOU (the admin) via the RealtimeChat component
  const handleOutgoingMessage = useCallback((message: ChatMessage) => {
      setRealtimeMessagesMap((prev) => ({
          ...prev,
          [message.conversationId!]: [...(prev[message.conversationId!] || []), message]
      }));
  }, []);

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
                               <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
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

          // fixed STALE MESSAGES...: 
          // Merge initial DB messages with the accumulated realtime messages for this session
          const realtimeMsgs = realtimeMessagesMap[conv.id] || [];
          const combinedMessages = [...conv.messages, ...realtimeMsgs];

          return (
            <div key={conv.id} className={cn("flex flex-col h-full min-h-0", isSelected ? "flex" : "hidden")}>
              {chat && (
                <>
                  <CardHeader className="py-4 border-b flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{chat.customerInitials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{chat.customerName}</CardTitle>
                        <CardDescription className="text-xs">
                          Regarding: <span className="font-medium text-foreground">{chat.productName}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={chat.status === "closed" ? "secondary" : "outline"} className="capitalize">{chat.status}</Badge>
                  </CardHeader>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <RealtimeChat
                      conversation={conv}
                      //@ts-ignore
                      messages={combinedMessages}
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
