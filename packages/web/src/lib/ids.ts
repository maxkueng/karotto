const UUID_GROUP_LENGTHS = [
  8,
  4,
  4,
  4,
  12,
];

export function newId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidV4FromRandomValues();
}

function uuidV4FromRandomValues(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map(toHexByte).join('');
  const groups: string[] = [];
  let offset = 0;
  for (const length of UUID_GROUP_LENGTHS) {
    groups.push(hex.substring(
      offset,
      offset + length,
    ));
    offset += length;
  }
  return groups.join('-');
}

function toHexByte(byte: number): string {
  return byte.toString(16).padStart(
    2,
    '0',
  );
}
