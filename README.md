# 브레인덤프 위클리

할 일을 쏟아내고(브레인 덤프), 걸리는 시간별로 나눈 뒤, 주간 캘린더의 빈 시간에 넣는 플래너예요.
아이폰·아이패드 홈 화면에 추가하면 앱처럼 열리고, **인터넷이 없어도** 쓸 수 있어요.

- 앱 주소: https://swimmingchoi.github.io/braindump-weekly/
- 할 일과 설정은 먼저 **기기 안에** 저장돼요. 이 GitHub 저장소에는 올라가지 않아요.
- 아래의 Cloudflare 중계 서버를 연결하면 **아이폰 · 아이패드끼리 자동으로 동기화**돼요. 오프라인에서 고친 내용은 온라인이 되면 올라가고, 두 기기에서 따로 고친 내용은 항목별로 합쳐져요.
- Apple 캘린더는 **온라인일 때만** 동기화돼요. 오프라인이거나 동기화가 실패하면 마지막으로 받은 일정을 보여 주고, 할 일 정리와 배치는 그대로 할 수 있어요.

## 홈 화면에 추가하기 (아이폰 · 아이패드)

1. Safari로 앱 주소를 열어요.
2. 공유 버튼 → **홈 화면에 추가**를 눌러요.
3. 홈 화면의 **브레인덤프** 아이콘으로 열면 주소창 없이 앱처럼 떠요. 한 번 열고 나면 오프라인에서도 열려요.

> 홈 화면 앱과 Safari 탭은 저장 공간이 따로예요. 동기화를 켜지 않았다면 한쪽에서만 쓰세요.

## Apple 캘린더 연결 + 기기 간 동기화

브라우저는 iCloud 캘린더 파일을 직접 받을 수 없어서, 무료 Cloudflare Worker 하나를 중계 서버로 써요. 같은 Worker가 기기 간 동기화용 저장소(KV)도 맡아요. 처음 한 번만 설정하면 돼요.

**요금:** Cloudflare 무료 플랜 안에서 써요. 무료 한도는 Worker 요청 하루 10만 번, KV 읽기 하루 10만 번 · 쓰기 하루 1,000번 · 저장 1GB예요. 앱은 바뀐 게 있을 때만 몇 초씩 모아서 쓰고, 바뀐 게 없으면 쓰기를 건너뛰어서 개인이 쓰기엔 한도에 닿지 않아요. 한도를 넘어도 요금이 나가지 않고 그날만 동기화가 멈춰요. 카드 등록도 필요 없어요.

### 1. 캘린더 공개 링크 만들기 (아이폰)

캘린더마다 반복해요. (개인, 직장, 🐻❤️ …)

1. **캘린더** 앱 → 아래 **캘린더** → 캘린더 이름 옆 **ⓘ**
2. **공개 캘린더**를 켜고 **링크 공유… → 복사**
3. `webcal://p…-caldav.icloud.com/published/2/…` 같은 주소가 복사돼요.

> 공개 캘린더 링크는 주소를 아는 사람이면 누구나 일정을 볼 수 있어요. 링크를 다른 곳에 올리지 마세요. 필요 없어지면 공개 캘린더를 끄면 링크가 사라져요.

### 2. 중계 서버 만들기 (Cloudflare, 무료)

1. https://dash.cloudflare.com 에 가입하고 로그인해요.
2. **Compute (Workers) → Workers & Pages → Create → Create Worker** (Hello World 템플릿), 이름은 `braindump-cal`로 하고 **Deploy**.
3. **Edit code**를 눌러 기존 코드를 지우고 [`worker/worker.js`](worker/worker.js) 내용을 붙여 넣은 뒤 **Deploy**.
4. Worker의 **Settings → Variables and Secrets**에서 두 개를 추가하고 저장해요.
   - `TOKEN` (Secret): 아무 비밀번호
   - `ALLOW_ORIGIN` (Text): `https://swimmingchoi.github.io`
5. 동기화용 저장소를 만들어요.
   - 왼쪽 메뉴 **Storage & databases → Workers KV → Create instance**, 이름은 `braindump-data`로 하고 만들어요.
   - 다시 Worker(`braindump-cal`) → **Settings → Bindings → Add → KV namespace**
   - **Variable name**은 `PLANNER`, **KV namespace**는 `braindump-data`를 고르고 **Deploy**(저장)해요.
6. Worker 주소(예: `https://braindump-cal.○○.workers.dev`)를 복사해 둬요.

### 3. 앱에 입력하기

앱 → 캘린더 탭 → **캘린더 설정**

- 캘린더마다 이름과 1번에서 복사한 링크를 넣고, 회사 캘린더는 **근무 캘린더**에 체크해요.
- **중계 서버 주소**와 **비밀번호**(`TOKEN`)를 넣고 **저장하고 동기화**를 눌러요.
- 캘린더 색은 범례의 동그라미를 눌러 아이폰과 같은 색으로 골라요.

앱은 열 때, 다시 온라인이 될 때, 그리고 15분마다 일정을 새로 받아요.

**다른 기기 추가:** 아이패드에서 설정을 마쳤다면, 아이폰에서는 **중계 서버 주소와 비밀번호만** 넣고 저장하면 돼요. 할 일, 직접 넣은 일정, 캘린더 링크와 색이 자동으로 따라와요. 화면 오른쪽 위에 `동기화됨 ○○:○○`이 보이면 연결된 거예요.

## 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 앱 전체 (화면, 저장, .ics 읽기와 반복 일정 계산) |
| `sw.js` | 오프라인에서도 열리게 하는 서비스 워커 |
| `manifest.webmanifest`, `*.png` | 홈 화면 앱 이름과 아이콘 |
| `worker/worker.js` | Cloudflare Worker: iCloud 캘린더 중계 + 기기 간 동기화 저장소 |
