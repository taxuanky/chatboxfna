/** Sinh định danh — design.md §9.3 (`chunk_id`) và §14.2 (`request_id`). */

/**
 * Chỉ dùng Web Crypto: `middleware.ts` chạy Edge và `node:crypto` không có ở đó. Giữ một
 * nền tảng crypto duy nhất thì không còn biên đó để mà sai (§3, bất biến #12).
 */
export function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Môi trường không có Web Crypto: không sinh được request_id.');
}

/** `chunk_id = <document_id>#<index 3 chữ số>`, ví dụ `PIG-NUT-001#002` (§9.3). */
export function formatChunkId(documentId: string, index: number): string {
  return `${documentId}#${String(index).padStart(3, '0')}`;
}
