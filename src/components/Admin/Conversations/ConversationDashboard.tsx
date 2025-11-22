"use client";

import {useState, useMemo, useCallback} from "react";
import {
  Search,
  MessageSquare,
  Box,
} from "lucide-react";

import { cn } from "@/lib/tailwindUtils"; // Ensure this path is correct for your project
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- Imports from your types/schema ---
// You might need to adjust this import path to where you keep your types
import type { ConversationModel } from "@/database/types"; // or wherever you export ConversationModel
import Image from "next/image";
import Link from "next/link";
import { init } from "next/dist/compiled/webpack/webpack";
import { ChatMessageItem } from "@/components/Chat/ChatMessage";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { RealtimeChat } from "@/components/Chat/RealtimeChat";
import { ChatMessage } from "@/hooks/use-realtime-chat";

// --- UI Data Structure (Derived) ---
// This is the flat structure the UI needs for easy rendering
type UIConversation = {
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
  status: string; // "open" | "closed" | "pending"
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

export function ConversationDashboard({ initialConversations}: ConversationDashboardProps) {
  const [viewMode, setViewMode] = useState<"product" | "all">("product");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [visitedConversationIds, setVisitedConversationIds] = useState<Set<string>>(new Set());
  const [latestMessages, setLatestMessages] = useState<Record<string, ChatMessage>>({});
  

  const [searchQuery, setSearchQuery] = useState("");

  const { user, role } = useSupabaseAuth();

  // --- 1. Transform DB Data to UI Data ---
  const allConversations = useMemo<UIConversation[]>(() => {
    return initialConversations.map((conv) => {
      // 1. Find the latest message (assuming array is sorted DESC from query, or we sort here)
      // Your query had "orderBy: [desc(conversations.createdAt)]" which might be a typo in the query function
      // usually it should be messages.createdAt. We sort here just to be safe.
      const sortedMessages = [...conv.messages].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      // Check if we have a newer message from realtime
      const liveLatest = latestMessages[conv.id];
      const dbLatest = sortedMessages[0];
      
      // Use whichever is newer
      let lastMsg = dbLatest;
      if (liveLatest) {
        const liveTime = new Date(liveLatest.createdAt).getTime();
        const dbTime = dbLatest?.createdAt ? new Date(dbLatest.createdAt).getTime() : 0;
        if (liveTime > dbTime) {
          lastMsg = liveLatest as any;
        }
      }

      // 2. Determine Customer Name 
      // (Ideally conv.customer is loaded, otherwise we try to find it from a message sender)
      let customerName = "Unknown Customer";
      let customerInitials = "??";
      
      // Try to get data from the first message sent by a customer if conv.customer isn't loaded
      const customerMsg = sortedMessages.find(m => m.senderType === 'customer');
      
      // Note: If you update your query to include `with: { customer: true }`, 
      // you can access `conv.customer.firstName` directly here.
      //@ts-ignore
      if (customerMsg?.sender) {
        //@ts-ignore
         const { firstName, lastName, username } = customerMsg.sender;
         customerName = firstName && lastName ? `${firstName} ${lastName}` : (username || "Customer");
      }

      if (customerName) {
        customerInitials = customerName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
      }

      // Generate initials from the name found above
      if (customerName && customerName !== "Unknown Customer") {
        customerInitials = customerName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
      }

      // 3. Calculate Unread
      const unreadCount = conv.messages.filter(
        (m) => !m.isRead && m.senderType === "customer"
      ).length;

      // 4. Product Image
      // Your schema has `productImages`, assuming `url` property exists on that table
      const imgUrl = conv.product.productImages?.[0] 
        ? (conv.product.productImages[0] as any).url || (conv.product.productImages[0] as any).imageUrl 
        : null; 


        let productName = conv.product.watch.brand.name + " " + conv.product.watch.model
        if(productName.length > 35) {
            productName = productName.substring(0, 25) + "..."
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
        lastMessageContent: lastMsg?.content || "No messages yet",
        lastMessageAt: lastMsg?.createdAt ? new Date(lastMsg.createdAt) : new Date(conv.createdAt || Date.now()),
        status: conv.status || "open",
        unreadCount,
        sortedMessages
      };
    });
  }, [initialConversations, latestMessages]);

  // --- 2. Filtering & Sorting ---
  const filteredConversations = useMemo(() => {
    let data = [...allConversations];

    // Search Filter
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      data = data.filter(
        (c) =>
          c.productName.toLowerCase().includes(lowerQ) ||
          c.customerName.toLowerCase().includes(lowerQ)
      );
    }

    // Sorting
    data.sort((a, b) => {
      const dateA = a.lastMessageAt.getTime();
      const dateB = b.lastMessageAt.getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return data;
  }, [allConversations, searchQuery, sortOrder]);

  // --- 3. Grouping by Product ---
  const groupedByProduct = useMemo(() => {
    const groups: Record<string, UIConversation[]> = {};
    
    filteredConversations.forEach((conv) => {
      if (!groups[conv.productId]) {
        groups[conv.productId] = [];
      }
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

  // Find currently selected conversation details
  const selectedChat = allConversations.find(c => c.id === selectedConversationId);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setVisitedConversationIds((prev) => {
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }, []);

  const handleLatestMessage = useCallback((conversationId: string, message: ChatMessage) => {
  setLatestMessages((prev) => ({
    ...prev,
    [conversationId]: message,
  }));
}, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] h-[calc(100vh-6rem)] gap-4">
      {/* --- LEFT PANEL: LIST & FILTERS --- */}
      <Card className="flex flex-col h-full border-r-0 md:border-r shadow-none rounded-none md:rounded-lg overflow-hidden min-w-0">
        <CardHeader className="px-4 border-b space-y-3 shrink-0"> {/* Added shrink-0 to ensure header doesn't get squashed */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Inbox</h2>
            <div className="flex gap-2">
              <Select
                value={sortOrder}
                onValueChange={(order: any) => setSortOrder(order)}
              >
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

          {/* View Toggle */}
          <Tabs
            value={viewMode}
            onValueChange={(mode) => setViewMode(mode as "product" | "all")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product">By Product</TabsTrigger>
              <TabsTrigger value="all">All Chats</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product or customer..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
                {/* MODE: ALL CHATS (Flat List) */}
                {viewMode === "all" &&
                  filteredConversations.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      isSelected={selectedConversationId === chat.id}
                      onClick={() => handleSelectConversation(chat.id)}
                    />
                  ))}

                {/* MODE: GROUP BY PRODUCT (Accordion) */}
                {viewMode === "product" && (
                  <Accordion type="multiple" className="w-full space-y-2">
                    {groupedByProduct.map((group) => (
                      <AccordionItem
                        key={group.productId}
                        value={group.productId}
                        className="border rounded-lg px-2"
                      >
                        <AccordionTrigger className="hover:no-underline py-3 pr-2">
                          <div className="flex items-start gap-3 text-left w-full overflow-hidden">
                            {/* Image Wrapper */}
                            <Link href={`/watches/view/${group.productSlug}`}>
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
                                {group.productImage ? (
                                  <Image
                                    className="h-full w-full object-cover"
                                    src={group.productImage}
                                    alt={group.productName}
                                    fill
                                    unoptimized
                                  />
                                ) : (
                                  <Box className="h-5 w-5 opacity-50" />
                                )}
                              </div>
                            </Link>

                            {/* Text Wrapper */}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <h4
                                  className="font-medium truncate text-sm pr-2"
                                  title={group.productName}
                                >
                                  {group.productName}
                                </h4>

                                {group.totalUnread > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-2 h-5 px-1.5 text-[10px] shrink-0"
                                  >
                                    {group.totalUnread}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {group.conversations.length}{" "}
                                {group.conversations.length === 1
                                  ? "chat"
                                  : "chats"}
                              </p>
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

      {/* --- RIGHT PANEL: CHAT AREA --- */}
      <Card className="flex flex-col h-full min-h-0 overflow-hidden shadow-none border-0 md:border">
  {initialConversations.map((conv) => {
    const chat = allConversations.find((c) => c.id === conv.id);
    const isSelected = selectedConversationId === conv.id;

    if (!visitedConversationIds.has(conv.id)) return null;

    return (
      <div
        key={conv.id}
        className={cn(
          "flex flex-col h-full min-h-0",
          isSelected ? "flex" : "hidden"
        )}
      >
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
              <Badge variant={chat.status === "closed" ? "secondary" : "outline"} className="capitalize">
                {chat.status}
              </Badge>
            </CardHeader>

            <div className="flex-1 min-h-0 overflow-hidden">
              <RealtimeChat
                conversation={conv}
                messages={conv.messages}
                userId={user?.id as string}
                username={user?.user_metadata.display_name}
                onLatestMessage={handleLatestMessage}
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

function ChatListItem({
  chat,
  isSelected,
  onClick,
  compact = false,
}: {
  chat: UIConversation;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent w-full max-w-full",
        isSelected && "bg-accent border-primary/20 shadow-sm",
        compact && "border-0 p-2 bg-transparent hover:bg-muted"
      )}
    >
      <div className="flex w-full flex-col gap-1 overflow-hidden">
        {/* Product name row - only render if not compact AND has product name */}
        {!compact && chat.productName && (
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-xs text-muted-foreground truncate">
              Regarding: {chat.productName}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs whitespace-nowrap",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {formatTimeAgo(chat.lastMessageAt)}
            </span>
          </div>
        )}

        {/* Avatar row - includes timestamp when no product name row */}
        <div className="flex items-center gap-2 w-full">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px]">
              {chat.customerInitials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium truncate flex-1 min-w-0">
            {chat.customerName}
          </span>
          {chat.unreadCount > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-blue-600 shrink-0" />
          )}
          {/* Show timestamp here when product name row is absent */}
          {(compact || !chat.productName) && (
            <span
              className={cn(
                "shrink-0 text-xs whitespace-nowrap",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {formatTimeAgo(chat.lastMessageAt)}
            </span>
          )}
        </div>

        <div className="line-clamp-2 text-xs text-muted-foreground mt-1 w-full break-words">
          {chat.lastMessageContent.substring(0, 100)}
        </div>
      </div>
    </button>
  );
}

//------------------------------------ Helper function ------------------------------------
function formatTimeAgo(date: Date) {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";

  const interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";

  const months = seconds / 2592000;
  if (months > 1) return Math.floor(months) + "mo ago";

  const days = seconds / 86400;
  if (days > 1) return Math.floor(days) + "d ago";

  const hours = seconds / 3600;
  if (hours > 1) return Math.floor(hours) + "h ago";

  const minutes = seconds / 60;
  if (minutes > 1) return Math.floor(minutes) + "m ago";

  return "just now";
}