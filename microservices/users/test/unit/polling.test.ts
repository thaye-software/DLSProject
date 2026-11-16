import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPolling } from "../../src/adapters/polling.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startPolling", () => {
  it("runs at once and then every interval after the previous run ends", async () => {
    const task = vi.fn(async () => undefined);

    const poller = startPolling("test", task, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);

    await poller.stop();
  });

  it("never overlaps a slow run", async () => {
    let active = 0;
    let maxActive = 0;
    const task = vi.fn(async () => {
      maxActive = Math.max(maxActive, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      active -= 1;
    });

    const poller = startPolling("test", task, 100);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(maxActive).toBe(1);
    // stop() waits for the run in progress, whose fake timer must be advanced.
    const stopped = poller.stop();
    await vi.advanceTimersByTimeAsync(5000);
    await stopped;
  });

  it("logs a failed run and tries again next interval", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const task = vi.fn().mockRejectedValueOnce(new Error("database down")).mockResolvedValue(undefined);

    const poller = startPolling("Expiry sweeper", task, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Expiry sweeper failed"), expect.any(Error));
    expect(task).toHaveBeenCalledTimes(2);
    await poller.stop();
  });

  it("waits for the running task on stop and runs no more", async () => {
    let finished = false;
    const task = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      finished = true;
    });

    const poller = startPolling("test", task, 1000);
    const stopped = poller.stop();
    await vi.advanceTimersByTimeAsync(500);
    await stopped;

    expect(finished).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
