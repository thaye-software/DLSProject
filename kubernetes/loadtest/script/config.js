// Settings of the load test. They come from environment variables:
// settings.env for the Kubernetes Job, or -e NAME=value for a k6 run on your own machine.
// The default addresses are the NodePorts of the local cluster.

function text(name, fallback) {
  const value = __ENV[name];
  return value === undefined || value === '' ? fallback : value;
}

function number(name, fallback) {
  const value = Number(text(name, fallback));
  if (Number.isNaN(value) || value < 0) throw new Error(`${name} must be a number of 0 or more, got "${__ENV[name]}"`);
  return value;
}

function wholeNumber(name, fallback) {
  const value = number(name, fallback);
  if (!Number.isInteger(value)) throw new Error(`${name} must be a whole number, got "${__ENV[name]}"`);
  return value;
}

export const config = {
  // Virtual users of each kind at full load.
  customerVus: wholeNumber('CUSTOMER_VUS', 20),
  adminVus: wholeNumber('ADMIN_VUS', 2),

  // Time to reach full load, time at full load, time to wind down.
  rampUp: text('RAMP_UP', '1m'),
  duration: text('DURATION', '3m'),
  rampDown: text('RAMP_DOWN', '30s'),

  // Every pause is multiplied by this. 1 is a realistic user, 0.2 makes the pauses five times shorter.
  thinkTimeScale: number('THINK_TIME_SCALE', 1),

  // Ask Auth before every request that needs a login, as the API gateway will.
  askAuth: text('ASK_AUTH', 'true') !== 'false',

  // Products the users look at when Search has no listings. The default is the watch Catalog seeds itself with.
  productIds: text('PRODUCT_IDS', '8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== ''),

  urls: {
    orders: text('ORDERS_URL', 'http://localhost:30000'),
    auth: text('AUTH_URL', 'http://localhost:30001'),
    catalog: text('CATALOG_URL', 'http://localhost:30002'),
    search: text('SEARCH_URL', 'http://localhost:30003'),
    messaging: text('MESSAGING_URL', 'http://localhost:30004'),
    users: text('USERS_URL', 'http://localhost:30005'),
    payment: text('PAYMENT_URL', 'http://localhost:30006'),
    notif: text('NOTIF_URL', 'http://localhost:30007'),
  },
};
