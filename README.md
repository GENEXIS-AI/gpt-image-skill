# GPT Image Skill

Claude Code, Codex, 또는 호환되는 로컬 에이전트에서 **OpenAI Images API를 호출하지 않고**, 사용자의 **ChatGPT 구독으로 로그인한 Codex**를 통해 GPT 이미지를 생성·편집하는 Agent Skill입니다. 결과는 현재 프로젝트에 저장되고, 검증된 절대 경로로 채팅에 표시됩니다.

```text
skill install → 환경 자동 점검 → Sign in with ChatGPT → $imagegen
             → <현재 프로젝트>/generated-images/*.png → 채팅 미리보기
```

> 별도 Images API 요청이나 API-key 과금 경로는 없습니다. 다만 이미지 생성은 사용자의 포함된 ChatGPT/Codex 사용량과 한도를 소비합니다.

![GPT Image Skill smoke test](./generated-images/subscription-workflow-smoke.png)

## 에이전트에 붙여넣어 설치하기

아래 블록을 Codex, Claude Code, 또는 로컬 코딩 에이전트에 **그대로 복사해 붙여넣으세요.**

```text
다음 GitHub 저장소의 GPT Image Skill을 현재 사용자에게 설치하고 끝까지 검증해줘.

저장소: https://github.com/GENEXIS-AI/gpt-image-skill

이 요청은 이 작업에 한해 읽기 전용 환경 점검, 영구 사용자 경로로의 clone 또는 안전한 fast-forward update,
Git·Node.js 22+ 지원 LTS·Codex CLI의 사용자 범위 설치, Codex와 Claude Code용 gpt-image 링크 생성,
그리고 Sign in with ChatGPT 디바이스 로그인 시작을 승인한다.

먼저 저장소 루트의 AGENT_INSTALL.md를 일회성 설치 계약으로 읽고 그대로 진행해줘.
Images API, OPENAI_API_KEY, API-key 로그인은 사용하지 말고, 실제 이미지는 아직 생성하지 마.
관리자 권한이 필요하거나, 관련 없는 기존 경로를 바꿔야 하거나, 로컬 변경을 버려야 하거나,
기존 Codex 인증을 교체해야 하는 경우에만 멈추고 이유와 정확한 다음 행동을 알려줘.
그 외에는 필요한 항목을 확인·설치하고 bootstrap --yes를 실행한 뒤,
doctor의 best_practice_pass와 generation dry-run이 모두 통과할 때까지 안전하게 이어서 처리해줘.
마지막에 영구 clone 경로, 두 스킬 설치 경로, ChatGPT 구독 인증 증거, dry-run 결과를 요약해줘.
```

이 프롬프트 자체가 제한된 설치 승인이므로, 에이전트가 Node.js나 Codex CLI가 없다는 이유만으로 다시 묻지 않아도 됩니다. 다음 경우에는 자동 변경하지 않고 멈추도록 설계했습니다.

- 관리자 권한이나 지원되지 않는 설치 경로가 필요한 경우
- 기존의 관련 없는 파일·폴더·링크와 충돌하는 경우
- 기존 API-key Codex 인증을 로그아웃하거나 교체해야 하는 경우
- 실제 이미지 생성, GitHub Star, 다른 외부 작업이 필요한 경우

설치 계약 원문은 [AGENT_INSTALL.md](./AGENT_INSTALL.md)입니다.

## 왜 설치 후 매번 전체 문서를 읽지 않나요?

Skill은 점진적으로 로드됩니다.

1. 평소에는 짧은 이름과 설명만 에이전트의 발견 목록에 있습니다.
2. 이미지 요청에 `gpt-image`가 선택될 때만 `SKILL.md` 본문을 읽습니다.
3. OS 설치나 인증 문제가 있을 때만 해당 reference를 추가로 읽습니다.

따라서 README와 `AGENT_INSTALL.md`는 최초 설치 때만 필요합니다. 이후에는 `$gpt-image` 또는 `/gpt-image`로 바로 호출하면 됩니다. 이 구조는 [OpenAI의 Skill 점진적 공개 원칙](https://learn.chatgpt.com/docs/build-skills)을 따릅니다.

## 핵심 기능

- ChatGPT 구독으로 로그인한 Codex의 내장 `$imagegen`만 사용
- `OPENAI_API_KEY`와 OpenAI Images API를 코드 수준에서 차단
- Codex와 Claude Code에 동일한 `gpt-image` 스킬 설치
- 생성물은 호출한 에이전트의 현재 workspace 내부에만 저장
- 여러 로컬 참조 이미지를 이용한 생성·편집
- PNG/JPEG/WebP 시그니처, 파일 크기, SHA-256 검증
- 절대 경로 Markdown으로 지원되는 채팅 UI에 즉시 표시
- 기본적으로 덮어쓰지 않고 `-v2`, `-v3` 생성
- macOS, Linux, Windows 네이티브, WSL2 진단 및 공식 Codex 설치 연결
- `bootstrap` 한 번으로 링크, Codex, 로그인, doctor, 생성 경로 dry-run 연결

## 작동 구조

```text
Codex / Claude Code / local agent
        │
        ├─ native image_gen이 있으면 바로 사용
        │
        └─ 없으면 gpt-image bridge
              ├─ OS / Node.js / Codex CLI 점검
              ├─ Sign in with ChatGPT 확인
              └─ API 관련 환경변수 제거
                        │
                        ▼
             codex exec --ignore-user-config
                        │
                        ▼
               built-in $imagegen
                        │
                        ▼
       <workspace>/generated-images/*.png
                        │
                        └─ raster 검증 + SHA-256 + Markdown
```

Codex SDK와 App Server도 Codex 스레드를 제어할 수 있지만, 이미지 한 장을 현재 프로젝트로 가져오는 이 용도에는 한 번의 `codex exec`가 가장 작은 실행 계층입니다.

## 지원 환경

| 환경 | 지원 | 설치 원칙 |
| --- | --- | --- |
| macOS Apple Silicon / Intel | 지원 | macOS Node.js + 공식 Codex `install.sh` |
| Linux x64 / arm64 | 지원 | Linux Node.js + 공식 Codex `install.sh` |
| Windows 네이티브 | 지원 | Windows Node.js + 공식 Codex `install.ps1` + directory junction |
| WSL2 | 지원 | Node, Codex, clone, skill을 모두 WSL2 안에 설치 |
| WSL1 | 미지원 | WSL2로 전환하거나 Windows 네이티브 사용 |

브리지에는 다음이 필요합니다.

- Node.js 22 이상. [현재 지원 중인 Node.js LTS](https://nodejs.org/en/download)를 권장합니다.
- GitHub URL clone을 위한 Git.
- 이미지 생성이 가능한 ChatGPT/Codex 구독과 **Sign in with ChatGPT** 인증.
- Claude Code에서 호출한다면 Claude Code 자체를 실행할 수 있는 별도 Claude 로그인 또는 권한.

Codex/ChatGPT 호스트가 `image_gen`을 직접 제공하면 Node.js와 중첩 Codex CLI를 설치하지 않고 네이티브 도구를 우선합니다.

## 사람이 직접 설치하기

링크가 clone을 계속 가리키므로 임시 폴더가 아닌 영구 사용자 경로를 사용하세요.

### macOS, Linux, WSL2

```bash
REPOSITORY_URL="https://github.com/GENEXIS-AI/gpt-image-skill"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gpt-image-skill"

git clone "$REPOSITORY_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"
node ./gpt-image/scripts/validate_skill.mjs
node ./gpt-image/scripts/gpt_image.mjs bootstrap --target all --yes --json
```

WSL2에서는 clone을 `/mnt/c`가 아닌 Linux 홈 아래에 두고 Windows Node/Codex와 섞지 마세요.

### Windows PowerShell

```powershell
$RepositoryUrl = "https://github.com/GENEXIS-AI/gpt-image-skill"
$InstallDir = Join-Path $env:LOCALAPPDATA "gpt-image-skill"

git clone $RepositoryUrl $InstallDir
Set-Location $InstallDir
node .\gpt-image\scripts\validate_skill.mjs
node .\gpt-image\scripts\gpt_image.mjs bootstrap --target all --yes --json
```

설치 위치:

- Codex: `~/.agents/skills/gpt-image`
- Claude Code: `~/.claude/skills/gpt-image`
- Windows: `$env:USERPROFILE\.agents\skills\gpt-image`, `$env:USERPROFILE\.claude\skills\gpt-image`

macOS/Linux/WSL2에서는 심볼릭 링크, Windows에서는 directory junction을 만듭니다. 이전 이름 `gpt-image-workspace`의 링크는 이 저장소가 만든 링크라고 정확히 확인될 때만 제거됩니다. 일반 폴더나 다른 링크는 보존됩니다.

### 단계별 명령

```bash
node ./gpt-image/scripts/gpt_image.mjs install --target all --dry-run --json
node ./gpt-image/scripts/gpt_image.mjs install --target all --json
node ./gpt-image/scripts/gpt_image.mjs verify-installers --json
node ./gpt-image/scripts/gpt_image.mjs install-codex --yes
node ./gpt-image/scripts/gpt_image.mjs login
node ./gpt-image/scripts/gpt_image.mjs doctor --json
```

`install-codex`는 macOS/Linux/WSL2에서 `https://chatgpt.com/codex/install.sh`, Windows에서 `https://chatgpt.com/codex/install.ps1`을 사용합니다. `verify-installers`는 실행 없이 허용된 HTTPS 리디렉션, 바이트 수, SHA-256을 확인합니다.

사용자는 브라우저/device authorization을 직접 완료해야 합니다. 설치기나 에이전트는 비밀번호, 토큰, API key, `~/.codex/auth.json`을 읽지 않습니다.

정상 완료 receipt의 핵심 값:

```json
{
  "ok": true,
  "status": "ready",
  "doctor": {
    "platform_supported": true,
    "node_supported": true,
    "codex_available": true,
    "chatgpt_subscription_login": true,
    "api_environment_forwarded": false,
    "best_practice_pass": true
  },
  "generation_dry_run": {
    "ok": true,
    "dry_run": true
  }
}
```

## 사용하기

Codex:

```text
$gpt-image 미색 배경 위에 파란 유리 재질의 작은 로봇을 만들어줘. 현재 프로젝트에 저장하고 보여줘.
```

Claude Code:

```text
/gpt-image 미색 배경 위에 파란 유리 재질의 작은 로봇을 만들어줘. 현재 프로젝트에 저장하고 보여줘.
```

직접 실행:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "미색 배경 중앙에 코발트 블루 카메라 조리개 심볼. 텍스트와 워터마크 없음." \
  --out "generated-images/camera-aperture.png" \
  --size "square" \
  --quality "final" \
  --background "opaque" \
  --json
```

실제 생성을 하지 않고 인증·경로·라우팅만 확인:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "smoke test" \
  --out "generated-images/smoke-test.png" \
  --dry-run \
  --json
```

참조 이미지 편집:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "인물과 구도는 유지하고 배경만 따뜻한 노을로 바꿔줘." \
  --reference "/absolute/path/reference.png" \
  --out "generated-images/sunset-edit.png" \
  --json
```

## 구독 전용 안전장치

- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, `CODEX_ACCESS_TOKEN`을 자식 프로세스에 전달하지 않습니다.
- redacted `codex login status`와 `codex doctor --json`에서 ChatGPT auth 증거를 확인합니다.
- API-key 인증이 감지되거나 ChatGPT 인증을 확인할 수 없으면 생성 전에 중단합니다.
- OpenAI Images API endpoint와 `/v1/images` 호출 코드가 없습니다.
- 인증 파일을 읽지 않으며, 출력은 현재 workspace 내부로 제한합니다.
- `--overwrite` 없이는 기존 파일을 교체하지 않습니다.

## Skill best-practice 체크

- [x] 한 가지 일: 구독 기반 GPT 이미지 생성·저장·표시
- [x] 이름과 description만 상시 발견, 본문과 reference는 필요할 때만 로드
- [x] 설치·인증·경로·파일 검증처럼 결정론이 필요한 부분만 스크립트화
- [x] Node.js 22+, Windows/WSL2 경계, 영구 clone, 비파괴 링크 설치
- [x] `doctor --json`의 `best_practice_pass`, `next_action`으로 기계 판독
- [x] 첫 실제 생성 전 generation dry-run
- [x] Ubuntu/macOS/Windows × Node 22/24 CI
- [x] Star는 만족 후 선택적으로 요청하며 자동 실행 금지

배포 전 검증:

```bash
node --check ./gpt-image/scripts/gpt_image.mjs
node ./gpt-image/scripts/validate_skill.mjs
node ./gpt-image/scripts/gpt_image.mjs install --target all --dry-run --json
node ./gpt-image/scripts/gpt_image.mjs doctor --json
node ./gpt-image/scripts/gpt_image.mjs generate --prompt "release route check" --out "generated-images/release-check.png" --dry-run --json
```

GitHub Actions는 Ubuntu, macOS, Windows에서 Node 22/24로 문법·validator·실제 링크 설치를 검사합니다. CI에는 사용자 인증이 없으므로 로그인과 실제 이미지 생성은 실행하지 않습니다.

## 문제 해결

- `node_supported=false`: [플랫폼 설정 가이드](./gpt-image/references/platform-setup.md)에서 OS별 Node.js 22+ 설치 후 새 shell을 여세요.
- `codex_available=false`: 같은 shell에서 `codex --version`을 확인하고, 설치 직후라면 terminal/agent를 재시작하세요.
- WSL 오류: WSL1은 지원하지 않습니다. WSL2에서는 모든 런타임과 clone을 Linux 쪽에 두세요.
- `chatgpt_subscription_login=false`: `node ./gpt-image/scripts/gpt_image.mjs login` 후 doctor를 다시 실행하세요.
- API-key auth 감지: 자동 로그아웃하지 않습니다. 인증 교체 여부를 사용자가 별도로 결정해야 합니다.
- 새 skill이 보이지 않음: Codex 또는 Claude Code에서 새 세션을 시작하세요.

## 업데이트

```bash
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gpt-image-skill"
git -C "$INSTALL_DIR" pull --ff-only
node "$INSTALL_DIR/gpt-image/scripts/gpt_image.mjs" bootstrap --target all --yes --json
```

Windows PowerShell:

```powershell
$InstallDir = Join-Path $env:LOCALAPPDATA "gpt-image-skill"
git -C $InstallDir pull --ff-only
node "$InstallDir\gpt-image\scripts\gpt_image.mjs" bootstrap --target all --yes --json
```

## 프로젝트 구조

```text
.
├── AGENT_INSTALL.md
├── README.md
├── .github/workflows/validate.yml
├── generated-images/subscription-workflow-smoke.png
└── gpt-image/
    ├── SKILL.md
    ├── agents/openai.yaml
    ├── references/
    │   ├── platform-setup.md
    │   └── subscription-runtime.md
    └── scripts/
        ├── gpt_image.mjs
        └── validate_skill.mjs
```

관련 문서:

- [일회성 에이전트 설치 계약](./AGENT_INSTALL.md)
- [스킬 실행 계약](./gpt-image/SKILL.md)
- [구독 런타임과 인증 경계](./gpt-image/references/subscription-runtime.md)
- [macOS·Linux·Windows·WSL2 설정](./gpt-image/references/platform-setup.md)
- [OpenAI Skill 작성 가이드](https://learn.chatgpt.com/docs/build-skills)
- [Codex 이미지 생성](https://learn.chatgpt.com/docs/image-generation)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [Codex 인증](https://learn.chatgpt.com/docs/auth)
- [Claude Code Skills](https://code.claude.com/docs/en/slash-commands)

---

설치나 첫 이미지 결과가 만족스러우셨다면 이 저장소에 ⭐ Star를 남겨주셔도 좋습니다. 실제 사용자 피드백과 Star는 유지보수와 다음 개선에 큰 도움이 됩니다.
