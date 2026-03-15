import type { NextConfig } from "next";

const securityHeaders = [
  // Clickjacking 방지
  { key: "X-Frame-Options", value: "DENY" },
  // MIME 스니핑 방지
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer 정책
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // XSS 필터 (레거시 브라우저용)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // HTTPS 강제 (1년, 서브도메인 포함)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // 권한 정책 (불필요한 브라우저 기능 차단)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // CSP: 출처 제한 (KIS WebSocket 허용)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' wss://ops.koreainvestment.com:21000 https://openapi.koreainvestment.com:9443",
      "img-src 'self' data:",
      "font-src 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
