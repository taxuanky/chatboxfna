/**
 * Mã hoá / giải mã NDJSON — giao thức stream của `/api/chat` (design.md §14.2).
 *
 * Một "dòng" NDJSON có thể bị cắt giữa hai mảnh TCP, nên bên nhận BẮT BUỘC phải đệm phần
 * dở dang. Bỏ bước này thì stream vẫn chạy đúng trong hầu hết lượt chat và chỉ hỏng khi
 * mạng chia mảnh khác đi — đúng loại lỗi không tái lập được trên máy người phát triển.
 */

export function encodeNdjson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function encodeNdjsonLines(values: readonly unknown[]): string {
  return values.map(encodeNdjson).join('');
}

/** Giải mã nhiều dòng đã trọn vẹn. Dòng rỗng bị bỏ qua. */
export function decodeNdjson(text: string): unknown[] {
  const out: unknown[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0) out.push(JSON.parse(trimmed));
  }
  return out;
}

/**
 * Bộ giải mã có trạng thái cho stream: `push()` trả về các object ĐÃ TRỌN VẸN, giữ lại
 * phần đuôi chưa có `\n` để ghép với mảnh kế tiếp.
 */
export class NdjsonDecoder {
  private buffer = '';

  push(chunk: string): unknown[] {
    this.buffer += chunk;
    const out: unknown[] = [];
    let nl = this.buffer.indexOf('\n');
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line.length > 0) out.push(JSON.parse(line));
      nl = this.buffer.indexOf('\n');
    }
    return out;
  }

  /** Gọi khi stream đóng: xử lý dòng cuối không có `\n`. */
  flush(): unknown[] {
    const line = this.buffer.trim();
    this.buffer = '';
    return line.length > 0 ? [JSON.parse(line)] : [];
  }

  /** Còn byte chưa dùng không — stream đóng mà còn phần dở là dấu hiệu bị cắt giữa dòng. */
  get pending(): string {
    return this.buffer;
  }
}
