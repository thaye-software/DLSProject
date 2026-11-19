import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { Gateway } from "./gateway.js";
import { compose } from "./stack.js";

export type Customer = { id: string; email: string; username: string; api: Gateway };

export function anonymousVisitor(): Gateway {
  return new Gateway(null);
}

export function withFakeToken(userId: string, email: string): Gateway {
  return new Gateway(`fake:${userId}:${email}`);
}

export function newIdentity(): { id: string; email: string; username: string } {
  const id = randomUUID();
  return { id, email: `${id}@system-tests.example.com`, username: `st${id.replaceAll("-", "").slice(0, 16)}` };
}

export async function signUp(): Promise<Customer> {
  const identity = newIdentity();
  const api = withFakeToken(identity.id, identity.email);
  const created = await api.call("users", "POST", "/users", { body: { username: identity.username } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return { ...identity, api };
}

export async function signUpAdmin(): Promise<Customer> {
  const admin = await signUp();
  await compose(["exec", "-T", "users-db", "psql", "-U", "users", "-d", "users", "-c", `UPDATE users SET role = 'admin' WHERE id = '${admin.id}'`]);
  return admin;
}
