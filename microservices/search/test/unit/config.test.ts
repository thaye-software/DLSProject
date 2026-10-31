import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const validEnv = {
  PORT: "3003",
  MONGODB_URL: "mongodb://localhost:27018/search",
  REDIS_URL: "redis://localhost:6379",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

describe("loadConfig", () => {
  it("returns typed config when every variable is valid", () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 3003,
      mongodbUrl: "mongodb://localhost:27018/search",
      redisUrl: "redis://localhost:6379",
      rabbitmqUrl: "amqp://guest:guest@localhost:5672",
    });
  });

  it("defaults PORT to 3003", () => {
    expect(loadConfig(envWith({ PORT: undefined })).port).toBe(3003);
  });

  it.each([undefined, ""])("runs without a cache when REDIS_URL is %j", (value) => {
    expect(loadConfig(envWith({ REDIS_URL: value })).redisUrl).toBeNull();
  });

  it.each([
    { name: "PORT 0", variable: "PORT", value: "0" },
    { name: "PORT 65536", variable: "PORT", value: "65536" },
    { name: "MONGODB_URL missing", variable: "MONGODB_URL", value: undefined },
    { name: "MONGODB_URL not mongodb", variable: "MONGODB_URL", value: "postgresql://localhost/search" },
    { name: "REDIS_URL not redis", variable: "REDIS_URL", value: "http://localhost:6379" },
    { name: "RABBITMQ_URL http scheme", variable: "RABBITMQ_URL", value: "http://rabbitmq:15672" },
  ])("rejects $name and names the variable", ({ variable, value }) => {
    expect(() => loadConfig(envWith({ [variable]: value }))).toThrow(new RegExp(variable));
  });

  it("accepts mongodb+srv:// and rediss://", () => {
    const config = loadConfig(envWith({ MONGODB_URL: "mongodb+srv://cluster.example.net/search", REDIS_URL: "rediss://cache.example.net:6380" }));

    expect(config).toMatchObject({ mongodbUrl: "mongodb+srv://cluster.example.net/search", redisUrl: "rediss://cache.example.net:6380" });
  });
});
