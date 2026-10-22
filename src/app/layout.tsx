import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'زين | نظام إدارة مخزون وطلبات جملة ملابس الأطفال',
  description: 'منظومة إدارة المخزون والموديلات وطلبات الجملة المشكل لملابس الأطفال - جمهورية مصر العربية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}
