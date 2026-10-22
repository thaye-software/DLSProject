export function enumMember<T extends string>(allowed: readonly T[], value: string, label: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (!match) throw new Error(`Unknown ${label} ${value}`);
  return match;
}
