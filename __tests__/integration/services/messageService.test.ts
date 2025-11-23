// import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../setup/testDb';
// import { persistMessage, markAsRead } from '@/services/messageService';
// import { messages } from '@/database/schema';
// import { eq } from 'drizzle-orm';

// describe('Message Service - Integration Tests', () => {
//   let db: any;

//   beforeAll(async () => {
//     const setup = await setupTestDatabase();
//     db = setup.db;
//   });

//   afterAll(async () => {
//     await teardownTestDatabase();
//   });

//   beforeEach(async () => {
//     await cleanDatabase();
//   });

//   it('should persist message to database', async () => {
//     const message = {
//       conversationId: 'test-conv',
//       senderId: 'user-123',
//       senderType: 'customer' as const,
//       content: 'Test message',
//     };

//     await persistMessage(message);

//     const [saved] = await db
//       .select()
//       .from(messages)
//       .where(eq(messages.conversationId, 'test-conv'));

//     expect(saved).toBeDefined();
//     expect(saved.content).toBe('Test message');
//   });

//   it('should mark messages as read', async () => {
//     // Insert test data
//     await db.insert(messages).values([
//       {
//         id: crypto.randomUUID(),
//         conversationId: 'test-conv',
//         senderId: 'user-other',
//         senderType: 'customer',
//         content: 'Message 1',
//         isRead: false,
//         createdAt: new Date(),
//       },
//       {
//         id: crypto.randomUUID(),
//         conversationId: 'test-conv',
//         senderId: 'user-current',
//         senderType: 'customer',
//         content: 'Message 2',
//         isRead: false,
//         createdAt: new Date(),
//       },
//     ]);

//     await markAsRead('test-conv', 'user-current');

//     const result = await db
//       .select()
//       .from(messages)
//       .where(eq(messages.conversationId, 'test-conv'));

//     const otherUserMsg = result.find((m: any) => m.senderId === 'user-other');
//     const currentUserMsg = result.find((m: any) => m.senderId === 'user-current');

//     expect(otherUserMsg?.isRead).toBe(true);
//     expect(currentUserMsg?.isRead).toBe(false);
//   });
// });