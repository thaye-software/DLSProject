import { describe, expect, it, vi } from "vitest";
import { withRetries } from "../../src/adapters/rabbitmq/retry.js";

function operationFailing(times: number) {
  let calls = 0;
  return vi.fn(async () => {
    calls += 1;
    if (calls <= times) throw new Error(`failure ${calls}`);
    return "done";
  });
}

function recordingSleep() {
  const waits: number[] = [];
  return { waits, sleep: async (milliseconds: number) => void waits.push(milliseconds) };
}

describe("withRetries", () => {
  it("waits 1, 2, 4, 8 and 8 seconds between attempts by default", async () => {
    const { waits, sleep } = recordingSleep();

    await expect(withRetries(operationFailing(Infinity), undefined, sleep)).rejects.toThrow();

    expect(waits).toEqual([1000, 2000, 4000, 8000, 8000]);
  });

  it.each([
    { name: "succeeds first time: 1 call, no waits (EP)", failures: 0, calls: 1, waits: [] },
    { name: "fails twice then succeeds: 3 calls (EP)", failures: 2, calls: 3, waits: [1, 2] },
    { name: "succeeds on the last retry, boundary 5 failures (BV)", failures: 5, calls: 6, waits: [1, 2, 4, 8, 8] },
  ])("$name", async ({ failures, calls, waits: expectedWaits }) => {
    const operation = operationFailing(failures);
    const { waits, sleep } = recordingSleep();

    await expect(withRetries(operation, [1, 2, 4, 8, 8], sleep)).resolves.toBe("done");

    expect(operation).toHaveBeenCalledTimes(calls);
    expect(waits).toEqual(expectedWaits);
  });

  it("gives up after 6 attempts, boundary 6 failures (BV), and rethrows the last error", async () => {
    const operation = operationFailing(6);
    const { waits, sleep } = recordingSleep();

    await expect(withRetries(operation, [1, 2, 4, 8, 8], sleep)).rejects.toThrow("failure 6");

    expect(operation).toHaveBeenCalledTimes(6);
    expect(waits).toEqual([1, 2, 4, 8, 8]);
  });

  it("actually waits between attempts when no sleep is injected", async () => {
    const operation = operationFailing(1);
    const startedAt = performance.now();

    await withRetries(operation, [50]);

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(45);
  });
});
