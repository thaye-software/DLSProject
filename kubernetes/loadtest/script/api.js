// One function per endpoint the site uses (microservices/docs/contracts/openapi.yaml).
// Each returns the JSON of a normal answer, or null (false for the ones without a body) when the request failed.
import encoding from 'k6/encoding';
import { AVATAR_PNG_BASE64 } from './data.js';
import { jsonOf, send } from './gateway.js';
import { uuid } from './random.js';

const AVATAR_PNG = encoding.b64decode(AVATAR_PNG_BASE64);

function jsonWhen(response, ...statuses) {
  return statuses.includes(response.status) ? jsonOf(response) : null;
}

// ---------- Search (public) ----------

export function search(query) {
  return jsonWhen(send(null, { service: 'search', method: 'GET', route: '/search', path: '/search', query }), 200);
}

// ---------- Catalog (public) ----------

export function getProduct(productId) {
  const response = send(null, { service: 'catalog', method: 'GET', route: '/products/:id', path: `/products/${productId}` });
  return jsonWhen(response, 200);
}

// ---------- Users ----------

export function isUsernameAvailable(username) {
  const response = send(null, {
    service: 'users',
    method: 'GET',
    route: '/users/username-available',
    path: '/users/username-available',
    query: { username },
  });
  return jsonWhen(response, 200);
}

// 201 the first time, 200 when the profile already exists (a second run of the test).
export function createProfile(user) {
  const response = send(user, {
    service: 'users',
    method: 'POST',
    route: '/users',
    path: '/users',
    body: { username: user.username },
    expected: [200, 201],
  });
  return jsonWhen(response, 200, 201);
}

export function getProfile(user) {
  return jsonWhen(send(user, { service: 'users', method: 'GET', route: '/users/me', path: '/users/me' }), 200);
}

export function updateProfile(user, changes) {
  const response = send(user, { service: 'users', method: 'PATCH', route: '/users/me', path: '/users/me', body: changes });
  return jsonWhen(response, 200);
}

export function setAddress(user, address) {
  const response = send(user, {
    service: 'users',
    method: 'PUT',
    route: '/users/me/address',
    path: '/users/me/address',
    body: address,
  });
  return jsonWhen(response, 200);
}

export function removeAddress(user) {
  const response = send(user, {
    service: 'users',
    method: 'DELETE',
    route: '/users/me/address',
    path: '/users/me/address',
    expected: [204],
  });
  return response.status === 204;
}

export function uploadAvatar(user) {
  const response = send(user, {
    service: 'users',
    method: 'PUT',
    route: '/users/me/avatar',
    path: '/users/me/avatar',
    body: AVATAR_PNG,
    headers: { 'Content-Type': 'image/png' },
  });
  return jsonWhen(response, 200);
}

export function deleteAccount(user) {
  const response = send(user, { service: 'users', method: 'DELETE', route: '/users/me', path: '/users/me', expected: [204] });
  return response.status === 204;
}

// ---------- Messaging ----------

// 201 for a new conversation, 200 when this customer already has one about the product.
export function openConversation(user, productId) {
  const response = send(user, {
    service: 'messaging',
    method: 'POST',
    route: '/conversations',
    path: '/conversations',
    body: { product_id: productId },
    expected: [200, 201],
  });
  return jsonWhen(response, 200, 201);
}

// A customer gets their own conversations, an admin gets all of them.
export function listConversations(user) {
  const response = send(user, { service: 'messaging', method: 'GET', route: '/conversations', path: '/conversations' });
  const page = jsonWhen(response, 200);
  return page ? page.items : [];
}

export function listMessages(user, conversationId) {
  const response = send(user, {
    service: 'messaging',
    method: 'GET',
    route: '/conversations/:id/messages',
    path: `/conversations/${conversationId}/messages`,
    query: { limit: 50 },
  });
  return jsonWhen(response, 200);
}

export function sendMessage(user, conversationId, content) {
  const response = send(user, {
    service: 'messaging',
    method: 'POST',
    route: '/conversations/:id/messages',
    path: `/conversations/${conversationId}/messages`,
    body: { content },
    headers: { 'Idempotency-Key': uuid() },
    expected: [201],
  });
  return jsonWhen(response, 201);
}

export function markRead(user, conversationId) {
  const response = send(user, {
    service: 'messaging',
    method: 'POST',
    route: '/conversations/:id/read',
    path: `/conversations/${conversationId}/read`,
    expected: [204],
  });
  return response.status === 204;
}

// ---------- Orders ----------

// 409 is a normal answer: another customer was faster and the watch is reserved or sold.
export function createOrder(user, productId, address) {
  const response = send(user, {
    service: 'orders',
    method: 'POST',
    route: '/orders',
    path: '/orders',
    body: {
      items: [{ product_id: productId, quantity: 1 }],
      offer_token: null,
      billing_address: address,
      delivery_address: address,
    },
    headers: { 'Idempotency-Key': uuid() },
    expected: [201, 409],
  });
  return jsonWhen(response, 201);
}

// A customer gets their own orders, an admin gets all of them.
export function listOrders(user, query) {
  const response = send(user, { service: 'orders', method: 'GET', route: '/orders', path: '/orders', query });
  const page = jsonWhen(response, 200);
  return page ? page.items : [];
}

export function getOrder(user, orderId) {
  const response = send(user, { service: 'orders', method: 'GET', route: '/orders/:id', path: `/orders/${orderId}` });
  return jsonWhen(response, 200);
}

// 409 is a normal answer: the order is no longer RESERVED.
export function cancelOrder(user, orderId) {
  const response = send(user, {
    service: 'orders',
    method: 'POST',
    route: '/orders/:id/cancel',
    path: `/orders/${orderId}/cancel`,
    expected: [200, 409],
  });
  return jsonWhen(response, 200);
}

// Admin only. 409 is a normal answer: another admin changed the order first.
export function changeOrderStatus(admin, orderId, status) {
  const response = send(admin, {
    service: 'orders',
    method: 'PATCH',
    route: '/orders/:id/status',
    path: `/orders/${orderId}/status`,
    body: { status },
    expected: [200, 409],
  });
  return jsonWhen(response, 200);
}

// ---------- Payment ----------

export function startPayment(user, orderId) {
  const response = send(user, {
    service: 'payment',
    method: 'POST',
    route: '/payments',
    path: '/payments',
    body: { order_id: orderId },
    expected: [201],
  });
  return jsonWhen(response, 201);
}

// ---------- Notif (public) ----------

export function sendContactMessage(name, email, message) {
  const response = send(null, {
    service: 'notif',
    method: 'POST',
    route: '/contact',
    path: '/contact',
    body: { name, email, message },
    expected: [202],
  });
  return response.status === 202;
}
