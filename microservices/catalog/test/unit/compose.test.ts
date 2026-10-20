import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compose = readFileSync(new URL("../../../docker-compose.yml", import.meta.url), "utf8");

describe("docker-compose stack", () => {
  it("publishes catalog-db on host port 5434 and catalog on 3002", () => {
    expect(compose).toMatch(/catalog-db:[\s\S]*?"5434:5432"/);
    expect(compose).toMatch(/\n  catalog:[\s\S]*?"3002:3002"/);
  });

  it("points Orders at Catalog on the compose network", () => {
    expect(compose).toMatch(/\n  orders:[\s\S]*?CATALOG_URL: http:\/\/catalog:3002/);
  });
});
