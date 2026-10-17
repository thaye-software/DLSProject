import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { parse } from "yaml";

export const openApi = parse(readFileSync(new URL("../../../docs/contracts/openapi.yaml", import.meta.url), "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(openApi, "openapi");

export function contractSchema(name: string) {
  const validate = ajv.getSchema(`openapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`openapi.yaml has no schema ${name}`);
  return validate;
}
