import { sleep } from 'k6';
import { config } from './config.js';

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// A whole number from min to max, both included.
export function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

// True in the given share of calls: chance(0.3) is true 3 times out of 10.
export function chance(share) {
  return Math.random() < share;
}

// Picks one entry. An entry with weight 40 is picked four times as often as one with weight 10.
export function pickWeighted(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}

// The pause of a person who reads a page, types or fills in a form: between min and max seconds.
export function think(minSeconds, maxSeconds) {
  sleep(randomBetween(minSeconds, maxSeconds) * config.thinkTimeScale);
}

// A random UUID v4, for Idempotency-Key headers and one-off accounts.
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}
