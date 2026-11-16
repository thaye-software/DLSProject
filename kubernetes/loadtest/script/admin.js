// What an admin does in the back office. One call of adminVisit is one round of work:
// one to three tasks, with pauses to read and type, and then a break.
//
// Catalog has no HTTP yet for creating, editing, hiding or deleting products and brands
// (microservices/catalog/contract.txt, "Not specified yet"), so an admin here cannot do that.
// Add those tasks to TASKS when the endpoints exist.
import { group } from 'k6';
import exec from 'k6/execution';
import * as api from './api.js';
import { ADMIN_REPLIES, SEARCH_TERMS } from './data.js';
import { persona } from './gateway.js';
import { chance, pick, pickWeighted, randomInt, think } from './random.js';

// How often an admin does each thing. The weights are shares of 100.
const TASKS = [
  { weight: 45, name: 'admin: answer customers', run: answerCustomers },
  { weight: 35, name: 'admin: handle orders', run: handleOrders },
  { weight: 20, name: 'admin: check the listings', run: checkListings },
];

// The only status an admin can move an order to from each of these. Orders in other statuses are only looked at.
const NEXT_STATUS = { PENDING: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED' };

// Each virtual user runs its own copy of this file, so these belong to one admin.
let admin = null;
let hasProfile = false;

export function adminVisit(data) {
  if (!admin) admin = persona('admin', exec.vu.idInTest);

  if (!hasProfile) {
    // Auth only lets users with a profile through.
    hasProfile = group('admin: sign in', () => api.createProfile(admin) !== null);
    if (!hasProfile) {
      think(5, 10);
      return;
    }
    think(2, 5);
  }

  const tasks = randomInt(1, 3);
  for (let i = 0; i < tasks; i++) {
    const task = pickWeighted(TASKS);
    group(task.name, () => task.run(admin, data));
    think(3, 8);
  }

  // Does something else until the next round.
  think(15, 40);
}

// ---------- Tasks ----------

function answerCustomers(user) {
  const conversations = api.listConversations(user);
  if (conversations.length === 0) return;
  think(3, 8);

  // Unread conversations first, at most three in one go.
  const unread = conversations.filter((conversation) => conversation.unread_count > 0);
  const queue = unread.length > 0 ? unread : [pick(conversations)];
  for (const conversation of queue.slice(0, 3)) {
    const id = conversation.conversation_id;
    api.listMessages(user, id);
    // Reads the question and looks the watch up.
    think(5, 15);
    api.getProduct(conversation.product_id);

    if (chance(0.8)) {
      // Types the answer.
      think(10, 30);
      api.sendMessage(user, id, pick(ADMIN_REPLIES));
    }
    api.markRead(user, id);
    think(2, 5);
  }
}

function handleOrders(user) {
  // The order overview: an admin sees the orders of every customer.
  const orders = api.listOrders(user, { page: 1, page_size: 50 });
  think(4, 10);

  // Paid orders that still have to be packed, shipped or delivered.
  const open = api.listOrders(user, { status: Object.keys(NEXT_STATUS), page: 1, page_size: 50 });
  think(3, 8);

  if (open.length > 0) {
    const order = api.getOrder(user, pick(open).order_id);
    if (!order) return;
    think(8, 20);
    const next = NEXT_STATUS[order.status];
    if (next) api.changeOrderStatus(user, order.order_id, next);
    return;
  }

  // Nothing to move forward. In the local cluster that is always the case: nobody can pay there,
  // so no order ever leaves RESERVED. The admin looks at an order instead.
  if (orders.length === 0) return;
  api.getOrder(user, pick(orders).order_id);
  think(5, 12);
}

function checkListings(user, data) {
  // What the shop shows, reserved and sold watches included.
  const everything = api.search({ availability: ['available', 'reserved', 'sold'], page_size: 50 });
  think(4, 10);

  let results = everything;
  if (chance(0.5)) {
    results = api.search({ q: pick(SEARCH_TERMS), availability: ['available', 'reserved', 'sold'] }) || everything;
    think(3, 8);
  }

  const productId = results && results.items.length > 0 ? pick(results.items).product_id : pick(data.productIds);
  api.getProduct(productId);
  think(5, 15);
}
