# 작업지시 — GA4 구매 전환(purchase) 이벤트 (개발세션 담당)

> **발행**: 2026-06-22 · **발행자**: 마케팅/SEO 세션 · **대상**: 개발세션
> **배경**: GA4(`G-3PRY6YKV05`) 도입 완료. 다운로드 전환(file_download)은 랜딩에 계측 완료. **구매 전환(purchase)** 은 결제 성공 페이지(checkout Worker 영역)라 개발세션이 담당.

## 목표
`/buy` 결제 성공(라이선스 키 발급) 시 GA4 `purchase` 이벤트 1회 발화 → GA4에서 전환·매출 측정.

## 구현 위치
- `workers/bluepad-checkout/worker.js` 의 **결제 성공 페이지 HTML** (라이선스 키를 보여주는 응답).
- 해당 페이지 `<head>`에 GA4 gtag가 없으면 먼저 삽입(측정 ID `G-3PRY6YKV05`), 그 후 purchase 이벤트.

## 삽입 스니펫 (성공 페이지 한정, 키 표시 직후)
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3PRY6YKV05"></script>
<script>
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}
  gtag('js',new Date());
  gtag('config','G-3PRY6YKV05');
  gtag('event','purchase',{
    transaction_id: '__ORDER_ID__',   // PayPal order/capture ID (중복 제거 키 — 필수)
    value: 10.99,                      // PRODUCT_PRICE 변수와 동기화
    currency: 'USD',
    items: [{ item_id: 'bluepad_pro', item_name: 'BluePad Pro License', price: 10.99, quantity: 1 }]
  });
</script>
```
- `__ORDER_ID__` 는 Worker가 가진 PayPal 주문/캡처 ID로 치환 (새로고침 시 중복 집계 방지에 필수).
- 가격을 하드코딩하지 말고 Worker의 `PRODUCT_PRICE` 변수로 주입 권장.

## 주의
- **성공 페이지에서 1회만** 발화 (실패/취소/재방문 시 발화 금지).
- 결제는 PayPal 리다이렉트 흐름 → 성공 페이지가 자체 로드되므로 cross-domain 측정 이슈 없음(키 표시 페이지에서 직접 발화).
- 배포: checkout Worker는 **wrangler deploy** (랜딩과 달리 Pages 아님). CLAUDE.md §2 참조.

## 완료 후
- GA4 > 관리 > 데이터 표시 > 이벤트 > `purchase` 를 **주요 이벤트(전환)** 로 표시 (기본 등록돼 있으나 데이터 수신 확인).
- 마케팅 세션에 측정 확인 요청 → 실시간/DebugView로 purchase 수신 검증.
