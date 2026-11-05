import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// microservices/docker-compose.yml includes one compose file per service.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const stack = read("../../../docker-compose.yml");
const catalogCompose = read("../../docker-compose.yml");
const ordersCompose = read("../../../orders/docker-compose.yml");

describe("docker-compose stack", () => {
  it("includes the Catalog and Orders compose files", () => {
    expect(stack).toMatch(/include:[\s\S]*?- catalog\/docker-compose\.yml/);
    expect(stack).toMatch(/include:[\s\S]*?- orders\/docker-compose\.yml/);
  });

  it("publishes catalog-db on host port 5434 and catalog on 3002", () => {
    expect(catalogCompose).toMatch(/catalog-db:[\s\S]*?"5434:5432"/);
    expect(catalogCompose).toMatch(/\n  catalog:[\s\S]*?"3002:3002"/);
  });

  it("points Orders at Catalog on the compose network", () => {
    expect(ordersCompose).toMatch(/\n  orders:[\s\S]*?CATALOG_URL: http:\/\/catalog:3002/);
  });
});
