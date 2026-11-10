import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cần cho Dockerfile / tự host (design.md §4, §17.2).
  output: 'standalone',

  // §9.4 — Ở Next 15 tuỳ chọn này nằm ở TOP-LEVEL, không còn trong `experimental`.
  // Trên Vercel mỗi function có bundle RIÊNG, nên phải khai CẢ HAI route:
  // thiếu dòng '/api/health' thì health báo index.present=false trên đúng bản deploy
  // mà /api/chat chạy bình thường, và người deploy sẽ kết luận sai là "index chưa lên"
  // rồi đi ingest lại vô ích. '/api/health' không cần glossary.json vì nó không đọc glossary.
  outputFileTracingIncludes: {
    '/api/chat': ['./data/kb-index.json', './data/kb-vectors.bin', './data/glossary.json'],
    '/api/health': ['./data/kb-index.json', './data/kb-vectors.bin'],
  },
};

export default nextConfig;
