import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/domain/html.js";

describe("escapeHtml", () => {
  it.each([
    { name: "plain text is unchanged (EP)", input: "Is the Submariner still available?", output: "Is the Submariner still available?" },
    { name: "empty string (EP)", input: "", output: "" },
    { name: "ampersand (EP)", input: "Tom & Jerry", output: "Tom &amp; Jerry" },
    { name: "less-than (EP)", input: "a < b", output: "a &lt; b" },
    { name: "greater-than (EP)", input: "a > b", output: "a &gt; b" },
    { name: "double quote (EP)", input: 'say "hi"', output: "say &quot;hi&quot;" },
    { name: "single quote (EP)", input: "o'brien", output: "o&#39;brien" },
    { name: "script tag (EP)", input: "<script>alert(1)</script>", output: "&lt;script&gt;alert(1)&lt;/script&gt;" },
    { name: "already escaped text is escaped again (EP)", input: "&amp;", output: "&amp;amp;" },
  ])("$name", ({ input, output }) => {
    expect(escapeHtml(input)).toBe(output);
  });
});
