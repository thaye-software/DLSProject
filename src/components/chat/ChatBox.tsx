import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { ArrowLeft, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { useEffect, useState } from "react";

export default function ChatBox({
  setChatOpen,
  initialRoom
}: {
    setChatOpen: (open: boolean) => void;
    initialRoom?: any;
  }) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(initialRoom);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch conversations for the authenticated user from our API
    let mounted = true;
    async function loadConversations() {
      setLoading(true);
      try {
        const res = await fetch("/api/chat/conversations");
        if (!mounted) return;
        if (res.status === 401) {
          // Not authenticated: leave rooms empty (or you could redirect to login)
          setRooms([]);
          return;
        }
        const payload = await res.json();
        const conversations = payload.conversations ?? [];
        setRooms(conversations);
      } catch (err) {
        // on error, fallback to empty list
        setRooms([]);
      }
    }
    console.log("Initial room in ChatBox:", initialRoom);
    console.log("selectedRoom in ChatBox:", selectedRoom);
    void loadConversations();
    return () => {
      mounted = false;
    };

    
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-24 right-6 z-50 w-[340px] max-w-full h-[480px] rounded-lg bg-card shadow-xl overflow-hidden flex flex-col"
    >
      <div className="sticky top-0 z-30 bg-card flex items-center justify-between p-2 border-b border-border">
        {selectedRoom ? (
          <div className="flex items-center justify-between w-full">
            <div>
              <Button
                onClick={() => setSelectedRoom(null)}
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="h-5 w-5 transition-transform transform group-hover:-translate-x-1" />
              </Button>
            </div>
            <div className="font-bold justify-start">
              <h1>{selectedRoom.product.name}</h1>
            </div>
            <div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setChatOpen(false)}
                className="text-sm text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="font-semibold ml-2">Chat</div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setChatOpen(false)}
              className="text-sm text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <ChatPanel
          rooms={rooms}
          selectedRoom={selectedRoom}
          setSelectedRoom={setSelectedRoom}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </motion.div>
  );
}
