import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "주식 시세 - 한국투자증권 Open API",
  description: "한국투자증권 Open API를 활용한 실시간 주식 시세 조회 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-background text-text-primary min-h-screen">
        <header className="border-b border-border bg-surface sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-accent">KIS</span>
              <span className="text-xl font-bold text-text-primary">주식시세</span>
            </Link>
            <span className="text-xs text-text-muted">한국투자증권 Open API</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-border mt-12 py-6">
          <div className="max-w-5xl mx-auto px-4 text-center text-text-muted text-xs">
            <p>본 서비스는 한국투자증권 Open API를 이용합니다. 투자 참고용이며 투자 권유가 아닙니다.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
