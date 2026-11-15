// k6 load test of the Limited Watches microservices.
// Customers and admins use the site at the same time, each with pauses between their actions.
//   customer.js  what a customer does      admin.js    what an admin does
//   api.js       one function per endpoint gateway.js  how a request reaches a service
//   config.js    the settings              data.js     what the users type
// How to run it: kubernetes/loadtestguide.txt.
import http from 'k6/http';
import { adminVisit } from './admin.js';
import { getProduct, search } from './api.js';
import { config } from './config.js';
import { customerVisit } from './customer.js';
import { persona } from './gateway.js';

export { adminVisit, customerVisit };

// Ramps up to the given number of users, holds it, and winds down.
function rampTo(users, exec) {
  return {
    executor: 'ramping-vus',
    exec,
    startVUs: 0,
    stages: [
      { duration: config.rampUp, target: users },
      { duration: config.duration, target: users },
      { duration: config.rampDown, target: 0 },
    ],
    // A user who is in the middle of a visit when the test winds down gets this long to finish it.
    gracefulRampDown: '30s',
    gracefulStop: '30s',
  };
}

const scenarios = {};
if (config.customerVus > 0) scenarios.customers = rampTo(config.customerVus, 'customerVisit');
if (config.adminVus > 0) scenarios.admins = rampTo(config.adminVus, 'adminVisit');
if (Object.keys(scenarios).length === 0) throw new Error('CUSTOMER_VUS and ADMIN_VUS are both 0, so there is nobody to run.');

export const options = {
  scenarios,
  // The test passes when all of these hold. k6 exits with code 99 when one does not.
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
  // The default tags without url: every product and order id would otherwise become its own series in Prometheus.
  // The name tag (GET /products/:id) says which endpoint a request went to.
  systemTags: ['proto', 'status', 'method', 'name', 'group', 'check', 'error', 'error_code', 'scenario', 'expected_response'],
};

// Runs once before the users start. Stops the test when the services are not ready for it.
export function setup() {
  for (const [service, url] of Object.entries(config.urls)) {
    if (service === 'auth' && !config.askAuth) continue;
    const health = http.get(`${url}/health`, { tags: { name: 'GET /health', service } });
    if (health.status !== 200) throw new Error(`${service} is not healthy at ${url}/health (status ${health.status}).`);
  }

  if (config.askAuth) {
    // A fake token is only accepted by Auth with TOKEN_VERIFIER=fake, which is how the local cluster runs.
    // A stack with real Supabase, Stripe and Resend accounts must not be load tested: it would send real emails.
    const probe = persona('customer', 0);
    const verify = http.get(`${config.urls.auth}/verify`, {
      headers: { Authorization: `Bearer ${probe.token}`, 'X-Forwarded-Method': 'POST', 'X-Forwarded-Uri': '/users' },
      tags: { name: 'GET /verify', service: 'auth' },
    });
    if (verify.status !== 200) {
      throw new Error(
        `Auth refused a fake token (status ${verify.status}). The load test only runs against services in fake mode ` +
          '(TOKEN_VERIFIER, IDENTITY_PROVIDER, PAYMENT_PROVIDER and MAILER set to fake), as in the local cluster.',
      );
    }
  }

  // The products the users look at: the configured ones that exist in Catalog, plus what Search lists.
  const productIds = new Set(config.productIds.filter((productId) => getProduct(productId) !== null));
  const listings = search({ availability: ['available', 'reserved', 'sold'], page_size: 100 });
  for (const listing of listings ? listings.items : []) productIds.add(listing.product_id);
  if (productIds.size === 0) throw new Error('Catalog has none of the PRODUCT_IDS and Search has no listings, so there is nothing to look at.');

  return { productIds: [...productIds] };
}
