/**
 * Utility functions for browser-side cryptographic hashing.
 * Computes SHA-256 of file buffer or text using Web Crypto API.
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === "string") {
    const encoded = new TextEncoder().encode(data);
    const copy = new Uint8Array(encoded.byteLength);
    copy.set(encoded);
    buffer = copy.buffer as ArrayBuffer;
  } else if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    buffer = copy.buffer as ArrayBuffer;
  } else {
    buffer = data as ArrayBuffer;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hashHex}`;
}

export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

export function formatDate(timestamp: number | bigint | string): string {
  if (!timestamp) return "N/A";
  const num = typeof timestamp === "bigint" ? Number(timestamp) : Number(timestamp);
  if (isNaN(num) || num === 0) return "N/A";
  // If in seconds (EVM timestamp)
  const millis = num < 10000000000 ? num * 1000 : num;
  return new Date(millis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
