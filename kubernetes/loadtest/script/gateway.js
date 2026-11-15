// Sends requests the way the API gateway will once it exists.
// For a request that needs a login it first asks Auth (GET /verify, forward-auth) and then calls the service
// with the X-User-* headers. Public requests go straight to the service.
import { check } from 'k6';
import http from 'k6/http';
import { config } from './config.js';

// A user of the site. The id is fixed per number, so a second run reuses the profiles of the first.
export function persona(role, number) {
  const id = `${role === 'admin' ? 'a' : 'c'}0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  return personaWithId(role, id, `loadtest_${role}_${number}`);
}

export function personaWithId(role, id, username) {
  // .invalid is a reserved domain that can never receive mail.
  const email = `${username}@loadtest.invalid`;
  // The token Auth accepts in fake mode: fake:<user id>:<email>.
  return { id, role, email, username, token: `fake:${id}:${email}` };
}

function queryString(query) {
  const parts = [];
  for (const [key, value] of Object.entries(query || {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// The gateway's forward-auth step. Returns null when Auth lets the request through, otherwise Auth's answer.
function askAuth(user, method, uri) {
  if (!config.askAuth) return null;
  const response = http.get(`${config.urls.auth}/verify`, {
    headers: { Authorization: `Bearer ${user.token}`, 'X-Forwarded-Method': method, 'X-Forwarded-Uri': uri },
    tags: { name: 'GET /verify', service: 'auth' },
    timeout: '15s',
  });
  const allowed = check(response, { 'auth: GET /verify': (answer) => answer.status === 200 });
  return allowed ? null : response;
}

// One request to a service.
//   user      who is signed in, or null for a public request
//   service   a key of config.urls
//   route     the path with placeholders, such as /products/:id. It names the request in the results,
//             so all products count as one endpoint.
//   path      the real path
//   expected  the statuses that are a normal answer (default 200). Any other status counts as an error.
export function send(user, { service, method, route, path, query, body, headers, expected }) {
  const expectedStatuses = expected || [200];
  const uri = path + queryString(query);
  const requestHeaders = Object.assign({}, headers);

  if (user) {
    const refusal = askAuth(user, method, uri);
    if (refusal) return refusal;
    requestHeaders['X-User-Id'] = user.id;
    requestHeaders['X-User-Email'] = user.email;
    // Auth answers with the role stored in Users, where an admin is still set by hand in the database.
    // The test decides who is an admin, so it sends the role itself.
    requestHeaders['X-User-Role'] = user.role;
  }

  let payload = null;
  if (body instanceof ArrayBuffer) {
    payload = body;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    requestHeaders['Content-Type'] = 'application/json';
  }

  const name = `${method} ${route}`;
  const response = http.request(method, config.urls[service] + uri, payload, {
    headers: requestHeaders,
    tags: { name, service },
    responseCallback: http.expectedStatuses(...expectedStatuses),
    timeout: '15s',
  });
  check(response, { [`${service}: ${name}`]: (answer) => expectedStatuses.includes(answer.status) });
  return response;
}

// The JSON body of an answer, or null when the request failed or the body is not JSON.
export function jsonOf(response) {
  try {
    return response.json();
  } catch (error) {
    return null;
  }
}
