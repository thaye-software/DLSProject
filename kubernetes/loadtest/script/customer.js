// What a customer does on the site. One call of customerVisit is one visit:
// the customer does one to three things, with pauses to read and type, and then leaves for a while.
import { group } from 'k6';
import exec from 'k6/execution';
import * as api from './api.js';
import {
  ADDRESSES,
  BRAND_SLUGS,
  CONTACT_MESSAGES,
  CUSTOMER_MESSAGES,
  FIRST_NAMES,
  LAST_NAMES,
  PRICE_RANGES_DKK,
  SEARCH_TERMS,
} from './data.js';
import { persona, personaWithId } from './gateway.js';
import { chance, pick, pickWeighted, randomInt, think, uuid } from './random.js';

// How often a customer does each thing. The weights are shares of 100.
const JOURNEYS = [
  { weight: 40, name: 'customer: browse and search', run: browse },
  { weight: 15, name: 'customer: ask about a watch', run: askAboutWatch },
  { weight: 10, name: 'customer: read the inbox', run: readInbox },
  { weight: 12, name: 'customer: check out', run: checkOut },
  { weight: 8, name: 'customer: look at own orders', run: lookAtOrders },
  { weight: 10, name: 'customer: edit the profile', run: editProfile },
  { weight: 3, name: 'customer: contact form', run: writeToTheShop },
  { weight: 2, name: 'customer: sign up and delete the account', run: signUpAndLeave },
];

// Each virtual user runs its own copy of this file, so these belong to one customer.
let customer = null;
let signedUp = false;

export function customerVisit(data) {
  if (!customer) customer = persona('customer', exec.vu.idInTest);

  if (!signedUp) {
    signedUp = group('customer: sign up', () => signUp(customer));
    if (!signedUp) {
      // Users or Auth did not answer. Try again on the next visit.
      think(5, 10);
      return;
    }
    think(2, 5);
  }

  const things = randomInt(1, 3);
  for (let i = 0; i < things; i++) {
    const journey = pickWeighted(JOURNEYS);
    group(journey.name, () => journey.run(customer, data));
    think(2, 6);
  }

  // Away from the site until the next visit.
  think(10, 30);
}

// ---------- Journeys ----------

function signUp(user) {
  api.isUsernameAvailable(user.username);
  // Fills in the rest of the form.
  think(3, 8);
  return api.createProfile(user) !== null;
}

function browse(user, data) {
  // The front page lists the newest available watches.
  let results = api.search({});
  think(3, 8);

  const refinements = randomInt(0, 2);
  for (let i = 0; i < refinements; i++) {
    results = api.search(randomSearch()) || results;
    think(3, 8);
  }

  if (results && results.total > results.page * results.page_size && chance(0.3)) {
    results = api.search({ page: results.page + 1 }) || results;
    think(3, 8);
  }

  const watches = randomInt(1, 2);
  for (let i = 0; i < watches; i++) {
    api.getProduct(productFrom(results, data));
    // Reads the description and looks at the photos.
    think(6, 18);
  }
}

function askAboutWatch(user, data) {
  const productId = productFrom(null, data);
  if (!api.getProduct(productId)) return;
  think(5, 12);

  const conversation = api.openConversation(user, productId);
  if (!conversation) return;
  const id = conversation.conversation_id;
  api.listMessages(user, id);

  const questions = randomInt(1, 2);
  for (let i = 0; i < questions; i++) {
    // Types the question.
    think(8, 25);
    api.sendMessage(user, id, pick(CUSTOMER_MESSAGES));
  }

  // Waits for an answer. The site gets new messages over Supabase Realtime; loading the thread again stands in for that.
  think(8, 20);
  api.listMessages(user, id);
  api.markRead(user, id);
}

function readInbox(user) {
  const conversations = api.listConversations(user);
  if (conversations.length === 0) return;
  think(2, 5);

  const unread = conversations.filter((conversation) => conversation.unread_count > 0);
  const id = pick(unread.length > 0 ? unread : conversations).conversation_id;
  api.listMessages(user, id);
  // Reads the thread.
  think(5, 15);
  api.markRead(user, id);

  if (chance(0.5)) {
    think(8, 25);
    api.sendMessage(user, id, pick(CUSTOMER_MESSAGES));
  }
}

function checkOut(user, data) {
  const productId = productFrom(null, data);
  const product = api.getProduct(productId);
  // A reserved or sold watch has no buy button.
  if (!product || product.availability !== 'available') return;
  think(5, 12);

  // Fills in the billing and delivery address.
  think(20, 45);
  const order = api.createOrder(user, productId, orderAddress());
  // null: another customer reserved the watch in the meantime.
  if (!order) return;

  think(1, 3);
  if (!api.startPayment(user, order.order_id)) return;

  // At the card form.
  think(10, 25);
  api.getOrder(user, order.order_id);

  // Nobody can pay in the local cluster: Payment runs with a fake provider and has no Stripe webhook.
  // So the customer always changes their mind and cancels, which also frees the watch for the next customer.
  think(2, 6);
  api.cancelOrder(user, order.order_id);
}

function lookAtOrders(user) {
  const orders = api.listOrders(user, { page: 1, page_size: 20 });
  if (orders.length === 0) return;
  think(3, 8);
  api.getOrder(user, pick(orders).order_id);
  think(4, 10);
}

function editProfile(user) {
  if (!api.getProfile(user)) return;
  think(8, 20);
  api.updateProfile(user, {
    first_name: pick(FIRST_NAMES),
    last_name: pick(LAST_NAMES),
    phone: `+45${randomInt(20000000, 99999999)}`,
    country_code: 'DK',
  });

  if (chance(0.6)) {
    think(8, 20);
    const address = pick(ADDRESSES);
    api.setAddress(user, { address_line_1: address.line, city: address.city, zip_code: address.zip });
  }
  if (chance(0.2)) {
    think(5, 12);
    api.uploadAvatar(user);
  }
  if (chance(0.1)) {
    think(3, 8);
    api.removeAddress(user);
  }
}

function writeToTheShop(user) {
  // Writes the message.
  think(20, 45);
  api.sendContactMessage(`${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, user.email, pick(CONTACT_MESSAGES));
}

// Someone new signs up, looks around and deletes the account again.
// It is a separate one-off account, so the customer of this virtual user keeps theirs.
function signUpAndLeave() {
  const id = uuid();
  const visitor = personaWithId('customer', id, `loadtest_tmp_${id.slice(0, 8)}`);
  if (!signUp(visitor)) return;
  think(3, 8);
  api.getProfile(visitor);
  api.search({});
  think(5, 15);
  api.deleteAccount(visitor);
}

// ---------- Helpers ----------

function randomSearch() {
  const query = {};
  const kind = randomInt(1, 4);
  if (kind === 1) query.q = pick(SEARCH_TERMS);
  if (kind === 2) query.brand = pick(BRAND_SLUGS);
  if (kind === 3) {
    // The filter is in minor units, 100 per DKK.
    const [from, to] = pick(PRICE_RANGES_DKK);
    if (from !== null) query.min_price = from * 100;
    if (to !== null) query.max_price = to * 100;
  }
  if (kind === 4) {
    query.q = pick(SEARCH_TERMS);
    query.availability = ['available', 'reserved'];
  }
  return query;
}

// A product from the search results, or one of the known products when the results are empty.
function productFrom(results, data) {
  if (results && results.items.length > 0) return pick(results.items).product_id;
  return pick(data.productIds);
}

function orderAddress() {
  const address = pick(ADDRESSES);
  return {
    first_name: pick(FIRST_NAMES),
    middle_name: null,
    last_name: pick(LAST_NAMES),
    address_line_1: address.line,
    address_line_2: null,
    city: address.city,
    zip_code: address.zip,
    state_province: null,
    country_code: 'DK',
  };
}
