import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeChat, ChatMessage } from '@/hooks/use-realtime-chat';
import { createClient } from '@/lib/supabase/client';
import { getUserById } from '@/services/userService';
import { persistMessage } from '@/services/messageService';
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

// Mock all external dependencies
jest.mock('@/database/supabase/client');
jest.mock('@/services/userService');
jest.mock('@/services/messageService');
jest.mock('@/context/SupabaseAuthContext');
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('useRealtimeChat', () => {
  let mockChannel: any;
  let mockSupabase: any;
  let mockUser: any;
  let mockConversation: any;
  let subscribeCallback: (status: string) => void;
  let broadcastCallback: (payload: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      id: 'user-123',
      user_metadata: {
        display_name: 'Test User',
      },
    };

    mockConversation = {
      id: 'conv-456',
    };

    mockChannel = {
      on: jest.fn().mockImplementation((type, config, callback) => {
        if (type === 'broadcast') {
          broadcastCallback = callback;
        }
        return mockChannel;
      }),
      subscribe: jest.fn().mockImplementation((callback) => {
        subscribeCallback = callback;
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      }),
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockSupabase = {
      channel: jest.fn().mockReturnValue(mockChannel),
      removeChannel: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (useSupabaseAuthContext as jest.Mock).mockReturnValue({ user: mockUser });
    (getUserById as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      role: 'customer',
      country: { name: 'Denmark' },
    });
    (persistMessage as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create a channel with correct name', () => {
      renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      expect(mockSupabase.channel).toHaveBeenCalledWith('chat:conv-456');
    });

    it('should subscribe to broadcast events', () => {
      renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'message' },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should set isConnected to true when subscribed', async () => {
      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should not create channel if conversation is missing', () => {
      renderHook(() =>
        useRealtimeChat({
          conversation: null,
          username: 'Test User',
        })
      );

      expect(mockSupabase.channel).not.toHaveBeenCalled();
    });
  });

  describe('Receiving Messages', () => {
    it('should add incoming message to messages array', async () => {
      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      const incomingMessage: ChatMessage = {
        id: 'msg-1',
        conversationId: 'conv-456',
        senderId: 'other-user',
        sender: {
          id: 'other-user',
          username: 'Other User',
          email: 'other@example.com',
          country: 'USA',
          role: 'customer',
        },
        content: 'Hello!',
        createdAt: new Date().toISOString(),
      };

      act(() => {
        broadcastCallback({ payload: incomingMessage });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(incomingMessage);
    });

    it('should ignore messages from other conversations', async () => {
      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      const wrongConversationMessage: ChatMessage = {
        id: 'msg-1',
        conversationId: 'different-conv',
        senderId: 'other-user',
        sender: {
          id: 'other-user',
          username: 'Other User',
          email: 'other@example.com',
          country: 'USA',
          role: 'customer',
        },
        content: 'Hello!',
        createdAt: new Date().toISOString(),
      };

      act(() => {
        broadcastCallback({ payload: wrongConversationMessage });
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('should call onMessageReceived callback when message arrives', async () => {
      const onMessageReceived = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
          onMessageReceived,
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      const incomingMessage: ChatMessage = {
        id: 'msg-1',
        conversationId: 'conv-456',
        senderId: 'other-user',
        sender: {
          id: 'other-user',
          username: 'Other User',
          email: 'other@example.com',
          country: 'USA',
          role: 'customer',
        },
        content: 'Hello!',
        createdAt: new Date().toISOString(),
      };

      act(() => {
        broadcastCallback({ payload: incomingMessage });
      });

      expect(onMessageReceived).toHaveBeenCalledWith(incomingMessage);
    });
  });

  describe('Sending Messages', () => {
    it('should send message successfully', async () => {
      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Test message');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'message',
        payload: expect.objectContaining({
          content: 'Test message',
          conversationId: 'conv-456',
        }),
      });

      expect(persistMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test message',
          conversationId: 'conv-456',
          senderId: 'user-123',
          senderType: 'customer',
        })
      );
    });

    it('should handle admin role correctly', async () => {
      (getUserById as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
        country: { name: 'Denmark' },
      });

      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Admin User',
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      await act(async () => {
        await result.current.sendMessage('Admin message');
      });

      expect(persistMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderType: 'seller',
        })
      );
    });

    it('should not send message if conversation is missing', async () => {
      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: null,
          username: 'Test User',
        })
      );

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      expect(mockChannel.send).not.toHaveBeenCalled();
      expect(persistMessage).not.toHaveBeenCalled();
    });

    it('should not send message if user is not found', async () => {
      (getUserById as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      expect(mockChannel.send).not.toHaveBeenCalled();
      expect(persistMessage).not.toHaveBeenCalled();
    });

    it('should call onMessageReceived for own messages', async () => {
      const onMessageReceived = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
          onMessageReceived,
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      await act(async () => {
        await result.current.sendMessage('My message');
      });

      expect(onMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'My message',
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      unmount();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should clear messages on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useRealtimeChat({
          conversation: mockConversation,
          username: 'Test User',
        })
      );

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      act(() => {
        broadcastCallback({
          payload: {
            id: 'msg-1',
            conversationId: 'conv-456',
            content: 'Test',
            sender: { 
              id: 'user', 
              username: 'User', 
              email: '', 
              country: '', 
              role: 'customer' as const 
            },
            createdAt: new Date().toISOString(),
          },
        });
      });

      expect(result.current.messages).toHaveLength(1);

      unmount();
    });

    it('should handle conversation change by cleaning up old channel', async () => {
      const { rerender } = renderHook(
        ({ conversation }) =>
          useRealtimeChat({
            conversation,
            username: 'Test User',
          }),
        {
          initialProps: { conversation: mockConversation },
        }
      );

      await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalledTimes(1));

      const newConversation = { id: 'conv-789' };
      rerender({ conversation: newConversation });

      await waitFor(() => {
        expect(mockSupabase.removeChannel).toHaveBeenCalled();
        expect(mockSupabase.channel).toHaveBeenCalledWith('chat:conv-789');
      });
    });
  });
});