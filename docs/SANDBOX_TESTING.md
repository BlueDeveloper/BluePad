# BluePad Sandbox 테스트 가이드

> 실 결제 손실 없이 결제/환불/라이선스 흐름을 끝까지 검증하는 절차.
> Live 환경과 완전 격리: 별도 Paddle 계정, 별도 BluePad 인스톨, 별도 DB 환경 마킹.

## 환경 분리 구조

| 항목 | Live | Sandbox |
|------|------|---------|
| Paddle 계정 | vendors.paddle.com | sandbox-vendors.paddle.com |
| 결제 페이지 | https://bluepad.work/buy | https://bluepad.work/sandbox/buy |
| Webhook URL | bluepad.work/buy/paddle-webhook | bluepad.work/sandbox/buy/paddle-webhook |
| 키 접두사 | `BP-` | `BPSB-` |
| Tauri identifier | brp.bluepad.desktop | brp.bluepad.sandbox.desktop |
| AppData 폴더 | `%APPDATA%\brp.bluepad.desktop\` | `%APPDATA%\brp.bluepad.sandbox.desktop\` |
| DB environment | 'live' | 'sandbox' |

→ 같은 D1 + 같은 worker가 환경별로 라우팅. admin에서 Live/Sandbox 토글로 분리 조회.

## 1. Sandbox BluePad 빌드 + 설치

```bash
# 프로젝트 루트에서
npm run tauri:build:sandbox
```

산출물: `src-tauri/target/release/bundle/msi/BluePad Sandbox_1.8.0_x64_en-US.msi`

설치하면 시작 메뉴에 **"BluePad Sandbox"** 추가 (Live와 별개).

특징:
- 윈도우 타이틀: `BluePad — SANDBOX`
- 좌상단 보라색 `SANDBOX` 리본
- 1px 보라 outline 테두리
- AppData 폴더 별개 → localStorage/device_id/license_key 완전 격리

빌드 옵션:
- `npm run tauri:dev:sandbox` — hot reload dev 모드 (인스톨러 없이 즉시 실행)
- `npm run tauri:build:sandbox` — 인스톨러 빌드

## 2. Sandbox 결제 e2e 테스트

### 2.1 결제 흐름

1. **BluePad Sandbox 실행** → 트라이얼 자동 시작 (BPSB 환경에 14일 trial 등록)
2. **Pro 업그레이드 버튼 클릭** (메뉴/ProGate)
   - 자동으로 `https://bluepad.work/sandbox/buy` 열림
3. 결제 페이지에서 **보라 SANDBOX 배너** 확인
4. **결제하기** 클릭 → Paddle 오버레이
5. 가짜 카드 입력:
   - 카드 번호: `4242 4242 4242 4242`
   - 만료: 미래 어느 날 (예: 12/30)
   - CVC: `100`
   - 이름/주소: 임의
6. 결제 완료 → 성공 페이지에 **`BPSB-XXXX-XXXX-XXXX-XXXX`** 키 자동 발급
7. 키 복사 → BluePad Sandbox → **도구 → 라이선스** → 키 입력
8. **Pro 모드 진입** 확인 (탭 무제한, 테마 4종, 집중 모드, HTML/PDF 내보내기)

### 2.2 결제 직후 검증 항목

| 검증 | 위치 |
|------|------|
| 트라이얼 생성 (environment='sandbox') | admin → Sandbox 탭 → 체험 |
| 결제 기록 (environment='sandbox', BPSB- 키) | admin → Sandbox 탭 → 결제 |
| 라이선스 (active=1, environment='sandbox') | admin → Sandbox 탭 → 라이선스 |
| Webhook events (transaction.completed 등) | admin → Sandbox 탭 → Webhook |
| 14일 환불 정책 (가능 D-14) | admin 결제 표의 "환불 정책" 컬럼 |
| Invoice number 자동 저장 | admin 결제 표의 "Invoice" 컬럼 |

## 3. 환불 e2e 테스트

### 3.1 환불 요청 (Paddle Sandbox 대시보드에서)

1. **sandbox-vendors.paddle.com** 로그인
2. Transactions → 해당 결제 클릭
3. **Refund → Full refund** 클릭
4. 즉시 webhook 발송:
   - `adjustment.created` action=refund, status=pending_approval
   - 우리 worker: 라이선스 즉시 비활성화 + `refund_pending` 상태로 마킹
5. Sandbox는 **10분 간격으로 자동 승인** (Paddle 정책)
6. 10분 내 `adjustment.updated` status=approved → 우리 worker: `refunded` 최종 처리

### 3.2 환불 검증 항목

| 단계 | admin 표시 |
|------|----------|
| 환불 요청 직후 | 상태 `환불요청중` (주황) / 환불 버튼 → `검토중` |
| Paddle 자동 승인 후 | 상태 `환불됨` (회색) / 환불 버튼 → `환불완료` |
| 라이선스 | active=0, 활성화 디바이스 0개 |
| BluePad Sandbox 앱 재시작 | Free 모드로 강등됨 |

### 3.3 환불 거부 시나리오 (수동 테스트)

자동 승인을 막으려면 Sandbox 대시보드에서 수동 reject:
- adjustment.updated status=rejected → 우리 worker: 라이선스 복구 (active=1)
- 앱은 다시 Pro 모드로 활성화 가능 (재활성화 필요)

## 4. 14일 환불 정책 테스트

### 4.1 14일 이내 환불 (정상)

1. 결제 직후 admin → 환불 정책 컬럼 → `가능 D-14`
2. `[환불]` 버튼 활성 → 클릭 시 정상 처리

### 4.2 14일 초과 환불 (정책 위반)

DB에서 수동으로 created_at 조작해서 테스트:
```sql
UPDATE payments SET created_at = datetime('now', '-15 days')
WHERE paddle_txn_id = 'txn_sandbox_xxx';
```

1. admin 새로고침 → 환불 정책 컬럼 → `기간 초과 (+1일)` (빨강)
2. 버튼이 `[예외환불]`로 변경 (반투명)
3. 클릭 시 force=1 전송 → 경고 후 진행
4. 백엔드 worker.js의 `handleAdjustment`가 critical audit 로그 기록

## 5. 멀티 환경 격리 검증

확인할 것:
- [ ] Live BluePad의 키(`BP-...`)는 Sandbox 앱에서 활성화 안 됨 (또는 그 반대)
- [ ] Live admin Live 토글에서 Sandbox 결제 안 보이고, 반대도 동일
- [ ] Sandbox 환불이 Live 라이선스에 영향 X
- [ ] Sandbox 앱 데이터(localStorage, device_id)가 Live 앱 데이터와 완전 분리

## 6. 정리 작업

테스트 끝나면:
- Sandbox MSI 파일 삭제는 선택 (재빌드 가능)
- DB 정리는 불필요 (sandbox 데이터는 environment='sandbox' 마킹되어 자동 분리)
- 필요 시 DB 정리:
  ```sql
  DELETE FROM payments WHERE environment = 'sandbox';
  DELETE FROM licenses WHERE environment = 'sandbox';
  DELETE FROM trials WHERE environment = 'sandbox';
  DELETE FROM webhook_events WHERE environment = 'sandbox';
  DELETE FROM activations WHERE environment = 'sandbox';
  ```

## 7. 알려진 한계

- Sandbox Paddle은 ICN colo 없음 → 일부 응답 시간 느림
- Sandbox 자동 환불 승인은 10분 간격 (즉시 X)
- BluePad Sandbox 자동 업데이트 비활성 (`createUpdaterArtifacts: false`) → 새 빌드는 수동 재설치
