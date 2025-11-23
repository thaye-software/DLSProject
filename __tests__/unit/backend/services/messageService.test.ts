import { persistMessage, markAsRead, PersistableMessage } from "@/services/messageService";
import { db } from "@/database/drizzle";
import { messages } from "@/database/schema";

let mockReturning: jest.Mock;
let mockWhere: jest.Mock;
let mockSet: jest.Mock;
let mockValues: jest.Mock;
let mockInsert: jest.Mock;
let mockUpdate: jest.Mock;

jest.mock("@/database/drizzle", () => {
  // Create mocks inside the factory
  const returning = jest.fn().mockResolvedValue([{ id: 'test-id' }]);
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  
  // ✅ FIX: values should resolve directly (no .returning() call in service)
  const values = jest.fn().mockResolvedValue({ id: 'test-id', rowCount: 1 });
  
  const insert = jest.fn().mockReturnValue({ values });
  const update = jest.fn().mockReturnValue({ set });
  
  return {
    db: {
      insert,
      update,
    },
    __mocks: {
      returning,
      where,
      set,
      values,
      insert,
      update,
    },
  };
});

const mockedDb = jest.requireMock<any>("@/database/drizzle");
mockReturning = mockedDb.__mocks.returning;
mockWhere = mockedDb.__mocks.where;
mockSet = mockedDb.__mocks.set;
mockValues = mockedDb.__mocks.values;
mockInsert = mockedDb.__mocks.insert;
mockUpdate = mockedDb.__mocks.update;

describe("Message Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default behavior
    mockValues.mockResolvedValue({ id: 'test-id', rowCount: 1 });
    mockWhere.mockResolvedValue(undefined);
  });

  describe("persistMessage", () => {
    const mockMessage: PersistableMessage = {
      conversationId: "conv-123",
      senderId: "user-123",
      senderType: "customer",
      content: "Hello world",
      isRead: false,
      createdAt: "2023-01-01T12:00:00Z",
    };

    it("should call db.insert with the messages schema", async () => {
      await persistMessage(mockMessage);
      expect(db.insert).toHaveBeenCalledWith(messages);
    });

    it("should insert the correct values with date conversion", async () => {
      await persistMessage(mockMessage);

      expect(mockValues).toHaveBeenCalledWith({
        conversationId: "conv-123",
        senderId: "user-123",
        senderType: "customer",
        content: "Hello world",
        isRead: false,
        createdAt: new Date("2023-01-01T12:00:00Z"),
      });
    });

    it("should handle missing optional fields (defaults)", async () => {
      const partialMessage: PersistableMessage = {
        conversationId: "conv-456",
        senderId: "user-456",
        senderType: "seller",
        content: "Test content",
      };

      await persistMessage(partialMessage);

      const calledArg = mockValues.mock.calls[0][0];

      expect(calledArg.isRead).toBe(false);
      expect(calledArg.createdAt).toBeInstanceOf(Date);
    });

    it("should return the result of the insert operation", async () => {
      const mockResult = { id: 'new-message-id', rowCount: 1 };
      mockValues.mockResolvedValueOnce(mockResult);

      const result = await persistMessage(mockMessage);
      expect(result).toEqual(mockResult);
    });

    it("should handle database errors", async () => {
      const mockError = new Error("Database insert failed");
      mockValues.mockRejectedValueOnce(mockError);

      await expect(persistMessage(mockMessage)).rejects.toThrow("Database insert failed");
    });
  });

  describe("markAsRead", () => {
    const conversationId = "conv-123";
    const userId = "user-current";

    it("should update the messages table", async () => {
      await markAsRead(conversationId, userId);
      expect(db.update).toHaveBeenCalledWith(messages);
    });

    it("should set isRead to true", async () => {
      await markAsRead(conversationId, userId);
      expect(mockSet).toHaveBeenCalledWith({ isRead: true });
    });

    it("should call where with correct conditions", async () => {
      await markAsRead(conversationId, userId);
      expect(mockWhere).toHaveBeenCalledTimes(1);
      
      const whereArg = mockWhere.mock.calls[0][0];
      expect(whereArg).toBeDefined();
    });

    it("should catch, log, and rethrow errors if DB fails", async () => {
      const mockError = new Error("DB Connection Failed");
      mockWhere.mockRejectedValueOnce(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(markAsRead(conversationId, userId)).rejects.toThrow("DB Connection Failed");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error marking messages as read:",
        mockError
      );

      consoleErrorSpy.mockRestore();
    });

    it("should complete successfully and return void", async () => {
      const result = await markAsRead(conversationId, userId);
      expect(result).toBeUndefined();
      expect(mockWhere).toHaveBeenCalled();
    });
  });
});