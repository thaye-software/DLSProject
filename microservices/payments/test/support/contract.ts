import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { parse } from "yaml";

export const asyncApi = parse(readFileSync(new URL("../../../docs/contracts/asyncapi.yaml", import.meta.url), "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(asyncApi, "asyncapi");

export function contractSchema(name: string) {
  const validate = ajv.getSchema(`asyncapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`asyncapi.yaml has no schema ${name}`);
  return validate;
}
