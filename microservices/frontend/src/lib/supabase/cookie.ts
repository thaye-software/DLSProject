// Fixed so the server (which may reach Supabase via host.docker.internal) and the browser (127.0.0.1)
// share one session cookie; supabase-js otherwise names it after the URL's hostname.
export const SUPABASE_AUTH_COOKIE = "sb-limitedwatches-auth-token";
