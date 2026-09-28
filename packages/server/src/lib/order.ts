export function mergeOrder(
  requested: readonly string[],
  current: readonly string[],
): string[] {
  const known = new Set(current);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of requested) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of current) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}

export function moveWithin(
  ids: readonly string[],
  id: string,
  position: number,
): string[] {
  const rest = ids.filter((item) => item !== id);
  const target = position === -1 || position > rest.length ? rest.length : position;
  rest.splice(
    target,
    0,
    id,
  );
  return rest;
}
