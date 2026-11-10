import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trợ lý trang trại — Chăn nuôi lợn & Cloud Farm',
  description:
    'Chatbot nội bộ trả lời câu hỏi chăn nuôi lợn và sử dụng phần mềm Cloud Farm, kèm trích dẫn nguồn.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
