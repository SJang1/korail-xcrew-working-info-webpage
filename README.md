# 코레일 승무원 근무 정보 대시보드

이 웹 애플리케이션은 코레일 승무원이 근무 일정을 쉽게 확인하고 관리할 수 있도록 설계되었습니다. 실시간 열차 운행 정보와 통합된 사용자 친화적인 인터페이스를 통해 일일 근무 구간("Dia") 및 월간 일정을 시각화합니다.

이 애플리케이션은 Vue.js 프런트엔드와 데이터 가져오기 및 인증을 안전하게 처리하는 서버리스 Cloudflare Worker 백엔드로 구축되었습니다.

## 주요 기능

- **일일 다이어그램 보기**: 운전, 준비, 입환, 승객 업무를 포함하여 현재 날짜의 근무 배정을 상세하고 시간순으로 분류하여 보여줍니다.
- **실시간 열차 추적**: 운전 구간의 경우, 애플리케이션은 실시간 열차 위치, 상태 및 지연 정보를 가져와 일정에 직접 오버레이합니다.
- **대화형 타임라인**: 출발역, 승차/하차역, 최종 목적지를 포함한 열차의 전체 여정을 예정된 시간과 실제 시간을 모두 표시하여 시각화합니다.
- **월간 달력 보기**: 색상으로 구분된 근무 위치를 통해 한 달 전체 일정을 한눈에 볼 수 있어 쉽게 식별할 수 있습니다.
- **지능형 캐싱**: 백엔드는 일정 데이터를 캐시하여 빠르고 응답성이 뛰어난 로드 시간을 제공하고 기본 코레일 시스템에 대한 요청 수를 줄입니다.
- **안전한 자격 증명 처리**: XROIS 비밀번호는 서버에 저장되지 않습니다. 사용자 브라우저의 로컬 저장소에 안전하게 저장되며, 업데이트를 가져올 때 필요에 따라 사용되어 자격 증명이 비공개로 유지됩니다.
- **반응형 디자인**: 인터페이스는 데스크톱 및 모바일 장치 모두에 최적화되어 언제 어디서든 일정을 확인할 수 있습니다.

## 작동 방식 (아키텍처)

이 프로젝트는 프런트엔드 단일 페이지 애플리케이션과 백엔드 서버리스 워커의 두 가지 주요 부분으로 구성됩니다.

### 1. 프런트엔드

- **Vue.js 3** 및 **Vite**로 구축되었습니다.
- 브라우저에서 사용자와 상호 작용하는 사용자 인터페이스입니다.
- 일일 다이어그램, 월간 달력 및 모든 사용자 설정을 표시하는 것을 처리합니다.
- 간단한 API를 통해 백엔드와 통신하여 일정 데이터를 가져오고 업데이트를 트리거합니다.
- 인증 토큰(JWT) 및 사용자 제공 자격 증명(Xcrew 이름/비밀번호)은 브라우저의 저장소에 로컬로 안전하게 저장됩니다.

### 2. 백엔드

- **Cloudflare** 네트워크(`server/index.ts`)에서 실행되는 **Edge Worker**입니다.
- 사용자 브라우저와 다양한 데이터 소스 간의 안전한 중개자 역할을 합니다.
- **사용자 인증**: 사용자 등록 및 로그인을 관리합니다. 자격 증명을 확인하고 세션 관리를 위한 보안 JWT를 발급 및 KV에 저장합니다.
- **Xcrew 프록시**: 사용자 대신 코레일 Xcrew 웹사이트에 안전하게 로그인하여 일정 및 다이어그램 정보를 가져옵니다. Xcrew 시스템의 복잡한 세션 및 쿠키 요구 사항을 관리합니다.
- **열차 API 프록시**: 타사 API에서 실시간 열차 데이터를 가져옵니다. 이 기능은 개별적으로 수정하셔야 합니다.
- **데이터베이스**: **Cloudflare D1**(서버리스 SQL 데이터베이스)을 사용하여 가져온 일정 및 다이어그램 정보를 저장합니다. 이는 사용자에게 데이터 로드 속도를 크게 향상시키고 외부 서비스에 대한 부하를 최소화합니다.

## 기술 스택

- **프런트엔드**: Vue.js 3, TypeScript, Vite
- **백엔드**: Cloudflare Workers, TypeScript
- **데이터베이스**: Cloudflare D1
- **배포**: Cloudflare Pages & Workers

## 프로젝트 설정

이 프로젝트를 실행하려면 Cloudflare 계정과 Wrangler CLI가 설치되어 있어야 합니다. 또한 외부 API 등에 대한 접근 권한을 미리 획득하여 주십시오.

### 1. 저장소 복제

```bash
git clone <repository-url>
cd korail-xcrew-working-info-webpage
```

### 2. 의존성 설치

```bash
npm install
```

### 3. Cloudflare 백엔드 구성

백엔드는 Cloudflare 서비스에 의존합니다. 먼저 이를 구성해야 합니다.

#### a. Wrangler 로그인

Cloudflare 계정으로 Wrangler CLI를 인증합니다:
```bash
npx wrangler login
```

#### b. D1 데이터베이스 생성

사용자 데이터 및 캐시된 일정을 저장하기 위한 D1 데이터베이스를 생성합니다.
```bash
# 이 명령은 데이터베이스 이름과 ID를 출력합니다.
npx wrangler d1 create korail-xcrew-db
```

#### c. `wrangler.jsonc` 구성

`wrangler.jsonc` 파일을 D1 데이터베이스 바인딩으로 업데이트합니다. 이전 명령에서 받은 값으로 플레이스홀더 값을 바꿉니다.

```jsonc
{
  // ... 기타 구성
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "korail-xcrew-db",
      "database_id": "YOUR_DATABASE_ID_HERE"
    }
  ]
}
```

#### d. 로컬 시크릿 생성

로컬 개발을 위해 프로젝트 루트에 `.dev.vars` 파일을 생성합니다. 이 파일은 `wrangler`가 시크릿을 로드하는 데 사용되며 git에 체크인되지 않습니다.

```ini
# .dev.vars

# JWT 서명을 위한 길고 무작위 문자열
JWT_SECRET="your-super-secret-jwt-key"

# 타사 열차 추적 서비스를 위한 API 토큰
NXLOGIS_SECRET="your-nxlogis-api-token"
```

### 4. 데이터베이스 초기화

필요한 테이블을 생성하기 위해 데이터베이스 마이그레이션을 실행합니다. 이 명령은 `migrations/` 디렉토리에 있는 SQL 파일을 D1 데이터베이스에 적용합니다.

```bash
# 원격 D1 데이터베이스에 적용
npx wrangler d1 execute korail-xcrew-db --file=./migrations/0001_init.sql
npx wrangler d1 execute korail-xcrew-db --file=./migrations/0002_data_storage.sql
# ... 모든 마이그레이션 파일에 대해 동일하게 진행

# 또는 로컬 개발을 위해 모두 적용하려면:
npx wrangler d1 execute korail-xcrew-db --file=./migrations/0001_init.sql --local
# ... 등등.
```

## 로컬 개발 환경 실행

이 프로젝트는 Vite 프런트엔드 개발 서버와 Wrangler 백엔드 개발 서버를 동시에 실행하도록 구성되어 있습니다.

```bash
# 프런트엔드와 백엔드를 모두 시작합니다.
# 프런트엔드는 http://localhost:5173 (또는 5173이 사용 중인 경우 다른 포트)에서 사용할 수 있습니다.
# 백엔드 워커는 http://localhost:8787에서 사용할 수 있습니다.
npm run dev
```

이제 브라우저에서 프런트엔드 URL을 열고 애플리케이션을 사용할 수 있습니다.

## 배포

이 애플리케이션은 Cloudflare 인프라에 배포되도록 설계되었습니다.

1.  **워커 배포**: 백엔드 워커와 해당 구성(시크릿 포함)을 배포합니다.
    ```bash
    # 먼저 프로덕션 환경을 위한 시크릿을 설정합니다.
    npx wrangler secret put JWT_SECRET
    npx wrangler secret put NXLOGIS_SECRET

    # 그런 다음 워커를 배포합니다.
    npx wrangler deploy
    ```

2.  **프런트엔드 빌드**: Vue.js 애플리케이션의 프로덕션용 빌드를 생성합니다.
    ```bash
    npm run build
    ```

3.  **Cloudflare Pages에 배포**: 저장소를 Cloudflare Pages에 연결하고 `dist` 디렉토리의 내용을 배포하도록 구성합니다. 빌드 명령은 `npm run build`로 설정해야 합니다.

---
이 README는 프로젝트의 기능부터 설정 및 배포에 이르기까지 프로젝트에 대한 완전한 개요를 제공합니다.