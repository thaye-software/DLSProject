import { describe, expect, it } from "vitest";
import { contractSchema, openApi } from "../support/contract.js";

type Operation = { tags?: string[]; requestBody?: Content; responses?: Record<string, Content> };
type Content = { content?: Record<string, { schema?: { $ref?: string }; example?: unknown }> };

// Every example on an Auth operation, with the schema it claims to follow.
function authExamples(): { name: string; schema: string; example: unknown }[] {
  const found: { name: string; schema: string; example: unknown }[] = [];
  for (const [path, item] of Object.entries(openApi.paths as Record<string, Record<string, Operation>>)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!operation?.tags?.includes("Auth")) continue;
      const bodies = { request: operation.requestBody, ...operation.responses };
      for (const [status, body] of Object.entries(bodies)) {
        for (const media of Object.values(body?.content ?? {})) {
          const ref = media.schema?.$ref;
          if (ref && media.example !== undefined) {
            found.push({ name: `${method.toUpperCase()} ${path} ${status}`, schema: ref.split("/").pop()!, example: media.example });
          }
        }
      }
    }
  }
  return found;
}

describe("openapi.yaml, Auth operations", () => {
  const examples = authExamples();

  it("has examples to check", () => {
    expect(examples.length).toBeGreaterThanOrEqual(2);
  });

  it.each(examples)("$name example matches $schema", ({ schema, example }) => {
    const validate = contractSchema(schema);

    expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
  });
});
