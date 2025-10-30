# ZZIK v2 배포 가이드

## 📦 배포 패키지 내용

이 배포 패키지에는 다음이 포함되어 있습니다:

### 빌드 아티팩트
- `apps/web/.next/` - Next.js 프로덕션 빌드 결과물
- `apps/web/public/` - 정적 파일 (favicon, robots.txt 등)

### 설정 파일
- `apps/web/package.json` - 웹 애플리케이션 의존성
- `apps/web/next.config.js` - Next.js 설정
- `apps/web/sentry*.config.ts` - Sentry 모니터링 설정
- `package.json` - 루트 패키지 설정
- `pnpm-lock.yaml` - 의존성 잠금 파일
- `pnpm-workspace.yaml` - Monorepo 워크스페이스 설정
- `turbo.json` - Turborepo 빌드 설정

### 데이터베이스
- `packages/database/prisma/` - Prisma 스키마 및 마이그레이션

### 문서
- `README.md` - 프로젝트 개요
- `VERIFICATION_REPORT.md` - 검증 보고서

---

## 🚀 배포 방법

### 1. 사전 요구사항

```bash
# Node.js 18+ 및 pnpm 설치 확인
node --version  # v18.0.0+
pnpm --version  # 9.15.0+
```

### 2. 패키지 압축 해제

```bash
unzip zzik-v2-deployment-YYYYMMDD-HHMMSS.zip -d zzik-v2-production
cd zzik-v2-production
```

### 3. 환경 변수 설정

프로덕션 환경에 맞게 `.env.production` 파일을 생성하세요:

```bash
# apps/web/.env.production
NODE_ENV=production

# 데이터베이스
DATABASE_URL="postgresql://user:password@host:5432/zzik_production"

# Redis (Rate Limiting)
REDIS_URL="redis://host:6379"

# Mapbox (지도 기능)
NEXT_PUBLIC_MAPBOX_TOKEN="your_mapbox_production_token"

# Stripe (결제)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# Sentry (모니터링)
SENTRY_DSN="your_sentry_dsn"
SENTRY_AUTH_TOKEN="your_sentry_auth_token"
SENTRY_ORG="your_org"
SENTRY_PROJECT="your_project"

# JWT
JWT_SECRET="your_secure_jwt_secret"

# 앱 URL
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### 4. 의존성 설치

```bash
pnpm install --prod --frozen-lockfile
```

### 5. 데이터베이스 마이그레이션

```bash
cd packages/database
pnpm prisma migrate deploy
pnpm prisma generate
cd ../..
```

### 6. 프로덕션 서버 실행

#### 옵션 A: Standalone 모드 (권장)

```bash
cd apps/web
node .next/standalone/server.js
```

#### 옵션 B: PM2로 프로세스 관리

```bash
# PM2 설치
npm install -g pm2

# PM2로 실행
cd apps/web
pm2 start .next/standalone/server.js --name "zzik-v2"

# 로그 확인
pm2 logs zzik-v2

# 자동 재시작 설정
pm2 startup
pm2 save
```

#### 옵션 C: Docker (Dockerfile 별도 필요)

```dockerfile
# Dockerfile 예시
FROM node:18-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

COPY apps/web/.next ./apps/web/.next
COPY apps/web/public ./apps/web/public
COPY apps/web/package.json ./apps/web/

EXPOSE 3000
CMD ["node", "apps/web/.next/standalone/server.js"]
```

---

## 🌐 프로덕션 환경 설정

### Nginx 리버스 프록시 예시

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 정적 파일 캐싱
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### SSL/TLS 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 설정
sudo certbot renew --dry-run
```

---

## 📊 모니터링 및 로그

### 1. Sentry 모니터링
- 에러 추적 자동 활성화
- 성능 모니터링 포함
- 소스맵 업로드로 디버깅 지원

### 2. 로그 확인

```bash
# PM2 로그
pm2 logs zzik-v2

# 표준 출력 로그
tail -f /var/log/zzik-v2.log
```

### 3. 헬스체크

```bash
# /api/metrics 엔드포인트
curl https://your-domain.com/api/metrics

# 응답 예시
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2025-10-30T01:44:14.000Z"
}
```

---

## ✅ 배포 전 체크리스트

- [ ] 모든 환경 변수가 설정되었는가?
- [ ] 데이터베이스 마이그레이션이 완료되었는가?
- [ ] Mapbox 토큰이 프로덕션 계정으로 설정되었는가?
- [ ] Stripe 키가 라이브 모드로 설정되었는가?
- [ ] Sentry DSN이 프로덕션 프로젝트로 설정되었는가?
- [ ] Redis 연결이 정상 작동하는가?
- [ ] SSL/TLS 인증서가 설치되었는가?
- [ ] 도메인 DNS 레코드가 정확한가?
- [ ] 방화벽 규칙이 올바르게 설정되었는가?
- [ ] 백업 및 복구 계획이 수립되었는가?

---

## 🔒 보안 고려사항

1. **환경 변수**: `.env.production` 파일을 버전 관리에 포함하지 마세요
2. **데이터베이스**: 강력한 비밀번호 사용 및 IP 화이트리스트 설정
3. **API 키**: 프로덕션 전용 키 사용 및 권한 최소화
4. **CORS**: `next.config.js`에서 허용된 도메인만 설정
5. **Rate Limiting**: Redis 기반 속도 제한 활성화
6. **CSP**: Content Security Policy 헤더 설정
7. **HTTPS**: 모든 트래픽을 HTTPS로 리다이렉트

---

## 🐛 문제 해결

### 빌드 파일을 찾을 수 없음

```bash
# .next 디렉토리 확인
ls -la apps/web/.next

# 필요시 재빌드
cd apps/web
pnpm run build
```

### 데이터베이스 연결 실패

```bash
# DATABASE_URL 확인
echo $DATABASE_URL

# 연결 테스트
psql $DATABASE_URL -c "SELECT 1"

# Prisma 클라이언트 재생성
cd packages/database
pnpm prisma generate
```

### 포트 충돌

```bash
# 다른 포트로 실행
PORT=3001 node .next/standalone/server.js

# 또는 next.config.js에서 변경
module.exports = {
  port: 3001,
  // ...
}
```

---

## 📞 지원

문제가 발생하면:
1. `VERIFICATION_REPORT.md` 검증 보고서 참조
2. GitHub Issues에 문제 등록
3. 개발 팀에 문의

---

## 📋 검증 결과

✅ **콘솔 오류**: 0개  
✅ **디자인 무결성**: 100%  
✅ **모든 페이지 로딩**: 정상  
✅ **Glassmorphism 효과**: 정상 렌더링  

상세 검증 결과는 `VERIFICATION_REPORT.md`를 참조하세요.

---

**배포 날짜**: 2025-10-30  
**Next.js 버전**: 15.5.6  
**React 버전**: 19  
**빌드 ID**: `tbu3ivcWIoDHFqYVdVjUw`
