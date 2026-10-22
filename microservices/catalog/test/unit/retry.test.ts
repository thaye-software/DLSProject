import { describe, expect, it, vi } from "vitest";
import { RETRY_DELAYS_MS, withRetries } from "../../src/adapters/rabbitmq/retry.js";

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

    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000, 8000, 8000]);
    expect(waits).toEqual([1000, 2000, 4000, 8000, 8000]);
  });

  it("honors an injected delay list", async () => {
    const operation = operationFailing(2);
    const { waits, sleep } = recordingSleep();

    await expect(withRetries(operation, [1, 2, 4], sleep)).resolves.toBe("done");

    expect(operation).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1, 2]);
  });
});
