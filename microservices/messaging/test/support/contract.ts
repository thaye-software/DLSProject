import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const load = (file: string) => parse(readFileSync(new URL(`../../../docs/contracts/${file}`, import.meta.url), "utf8"));

export const openApi = load("openapi.yaml");
export const asyncApi = load("asyncapi.yaml");

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(openApi, "openapi");
ajv.addSchema(asyncApi, "asyncapi");

// A schema from openapi.yaml (HTTP bodies).
export function contractSchema(name: string) {
  const validate = ajv.getSchema(`openapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`openapi.yaml has no schema ${name}`);
  return validate;
}

// A schema from asyncapi.yaml (RabbitMQ messages).
export function eventSchema(name: string) {
  const validate = ajv.getSchema(`asyncapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`asyncapi.yaml has no schema ${name}`);
  return validate;
}
