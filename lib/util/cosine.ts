/**
 * Điểm tương đồng và chuẩn hoá vector — design.md §6.3a.
 *
 * Phương án đã chốt là (i): L2-normalize ở TẦNG ADAPTER rồi dùng DOT PRODUCT. Vì vậy
 * `dot()` ở đây là toàn bộ phép tính cosine — không chia chuẩn, không căn bậc hai trong
 * vòng lặp nóng. Điều đó chỉ đúng khi bất biến #2 được giữ, nên `l2normalize()` sống cùng
 * file này và là hàm duy nhất mà các adapter embedding được gọi.
 */

type Vec = readonly number[] | Float32Array;

export function dot(a: Vec, b: Vec): number {
  if (a.length !== b.length) {
    throw new Error(`Không thể tính dot product: số chiều lệch nhau (${a.length} vs ${b.length}).`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

export function l2norm(v: Vec): number {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/**
 * Trả về một vector MỚI có chuẩn L2 = 1.
 *
 * Vector toàn 0 không chuẩn hoá được (chia cho 0); trả nguyên bản thay vì sinh NaN, vì NaN
 * lan ra toàn bộ điểm số và biến một chunk rỗng thành lỗi ở nơi khác.
 */
export function l2normalize(v: Vec): number[] {
  const norm = l2norm(v);
  const out = new Array<number>(v.length);
  if (norm === 0 || !Number.isFinite(norm)) {
    for (let i = 0; i < v.length; i += 1) out[i] = v[i];
    return out;
  }
  for (let i = 0; i < v.length; i += 1) out[i] = v[i] / norm;
  return out;
}
