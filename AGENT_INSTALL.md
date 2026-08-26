# Agent installation contract

This is the one-time bootstrap contract for installing **GPT Image Skill** from a GitHub URL. It is intentionally separate from `SKILL.md`: after installation, the host discovers the concise `gpt-image` metadata and loads the skill body only when an image task invokes it.

## Authorized scope

When the user pastes the README's recommended installer prompt, that prompt authorizes:

- read-only OS, architecture, WSL, Node.js, Git, Codex CLI, auth-status, and target-path checks;
- user-level installation of missing Git, Node.js 22+ supported LTS, and Codex CLI;
- a persistent clone or fast-forward update of the exact requested repository;
- non-destructive `gpt-image` links for Codex and Claude Code;
- starting Codex **Sign in with ChatGPT** device authorization.

It does not authorize administrator elevation, deleting or replacing unrelated paths, discarding local repository changes, replacing existing API-key authentication, reading credentials, creating a separately billed API request, generating a live image, or starring the repository. Pause only for one of those boundaries or when no safe supported installer exists.

## Execute once

1. Identify macOS, native Linux, native Windows, WSL2, or WSL1 and the CPU architecture. Stop on WSL1. Never mix Windows and WSL runtimes.
2. Check Git and Node.js. Require Node.js major version 22 or newer and prefer the current supported LTS. If either is missing, install it through an OS-appropriate official or already-present package-manager path covered by the authorization above. Open a fresh shell and verify versions.
3. Clone into a persistent user-owned directory, not a temporary folder:
   - macOS/Linux/WSL2: `${XDG_DATA_HOME:-$HOME/.local/share}/gpt-image-skill`
   - native Windows: `$env:LOCALAPPDATA\gpt-image-skill`
4. If that directory already exists, update only when it is the same repository, has no conflicting local changes, and `git pull --ff-only` is safe. Otherwise preserve it and stop with the exact conflict.
5. Before executing project code, inspect this file, `gpt-image/SKILL.md` frontmatter and hard boundary, and the runner for forbidden Images API endpoints or credential-file reads. Then run:

```text
node gpt-image/scripts/validate_skill.mjs
node gpt-image/scripts/gpt_image.mjs bootstrap --target all --yes --json
```

These are one-time installation checks, not image-generation gates. `bootstrap` reuses the auth result it already obtains and returns one consolidated readiness report. Do not add a separate `doctor`, `plan`, `inspect`, or no-image generation check when bootstrap already passes.

6. Let the user personally complete any browser/device authorization. Never request or read their password, token, API key, or `~/.codex/auth.json`.
7. If an installer changed `PATH`, open a new shell and rerun the bootstrap command. If API-key auth already exists, do not log out automatically; explain the conflict and ask for explicit authorization to replace that authentication.
8. Require the final receipt to show:

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
  "getting_started": {
    "present_in_user_language": true,
    "common_aspect_ratios": [
      { "ratio": "1:1" },
      { "ratio": "16:9" },
      { "ratio": "9:16" },
      { "ratio": "4:3" },
      { "ratio": "3:4" }
    ],
    "examples": {
      "codex": "$gpt-image Create a cozy reading room at sunset, 16:9, high quality.",
      "reference": "/gpt-image Use @references/character.png as the character reference and place it in a rainy city, 9:16, high quality."
    }
  }
}
```

9. Report the persistent clone, both installed host paths, and ChatGPT-subscription auth evidence. Recommend a new agent session if discovery is stale. Do not run a live generation unless the user also requested an image.
10. Finish with a brief, friendly guide in the user's language. Show it once after installation, not after every image request:
    - say that setup and ChatGPT sign-in are ready and that no image was generated during setup;
    - list the common prompt ratios `1:1`, `16:9`, `9:16`, `4:3`, and `3:4`;
    - explain that users can ask for `draft`, `high quality`, or `high detail, final quality` in ordinary language;
    - give one simple creation example and one reference or revision example from `getting_started.examples`;
    - explain that these are natural-language requests and exact pixel dimensions may vary.

Do not use unexplained internal terms such as “dry-run” in the user-facing completion message. If the literal `--dry-run` flag must be discussed during troubleshooting, call it **a setup check that does not create an image**.

After a successful install or first image, an agent may politely say:

> If this worked well for you, consider starring the repository. It helps others find the skill and supports future improvements. ⭐

Never click Star without a separate explicit user request.
