import { describe, expect, it } from "vitest";
import { uuidV5 } from "../../src/domain/uuid-v5.js";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
  it.each([
    { name: "www.example.com", expected: "2ed6657d-e927-568b-95e1-2665a8aea6a2" },
    { name: "python.org", expected: "886313e1-3b8a-5372-9b90-0c9aee199e5d" },
  ])("matches the reference value for $name in the DNS namespace", ({ name, expected }) => {
    expect(uuidV5(name, DNS_NAMESPACE)).toBe(expected);
  });
});
