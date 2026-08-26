# Image and reference workflows

Read this reference for existing images, Claude Code attachments, multiple references, edits, variations, or follow-up revisions.

## Core rule

Keep the user's prompt unchanged. Reference labels exist only to route image files; they are not permission to add visual direction. Do not add style, composition, lighting, color, objects, text, negative prompts, or “helpful” preservation rules.

## Pick the operation

| User intent | Bridge operation |
| --- | --- |
| Create without an image | `--mode generate` |
| Create a new image guided by an existing image | `--mode generate --reference PATH` |
| Change an existing image | `--mode edit --edit-target PATH` |
| Make a variation of an existing image | `--mode variation --edit-target PATH` |
| Change the image just generated | Use the last output as the next `--edit-target` |

The edit target is attached as Image 1. Supporting references follow in command-line order. PNG, JPEG, and WebP references are accepted.

## Claude Code attachment contract

The nested Codex bridge receives only filesystem paths passed with `-i`. An image visible in Claude's conversation is not automatically attached to the new `codex exec` process.

Resolve inputs in this order:

1. Use an explicit `@path` or local path supplied by the user.
2. If the current Claude attachment context exposes an exact readable temporary path, copy that exact file non-destructively into `<workspace>/generated-images/inputs/` and use the copied path.
3. If only a pasted or dragged image is visible and no path is exposed, ask the user to save it inside the project and provide that path.

Do not continue with text-only generation when a requested reference path is unresolved. Do not search for or guess the newest file in `~/.claude/image-cache`; it is session data and may select the wrong or private image. Copy only an exact path that the current attachment context identifies.

## Reference-guided generation

Use `--reference` for every image that must guide a new result. The runner passes every listed file into the actual image-generation call.

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "<user prompt verbatim>" \
  --reference "/absolute/path/reference.png" \
  --out "generated-images/result.png"
```

For multiple images, preserve their order. Add matching `--reference-role` values only when the user explicitly defines distinct roles or the prompt refers to them by purpose:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "Use Image 1 for the product and Image 2 for the color treatment." \
  --reference "/absolute/path/product.png" \
  --reference-role "product" \
  --reference "/absolute/path/color.png" \
  --reference-role "color treatment" \
  --out "generated-images/product-result.png"
```

Never convert an image into a prose description and pass only the prose. A visual reference is successful only when its file is attached to the native image tool or the bridge call.

## Edit and follow-up revision

For the first edit, use the exact image the user wants changed:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "<user edit request verbatim>" \
  --edit-target "/absolute/path/current-image.png" \
  --out "generated-images/edited.png"
```

For the next request, such as “make the edited result slightly warmer,” use `edited.png`, not `current-image.png`:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "make the edited result slightly warmer" \
  --edit-target "generated-images/edited.png" \
  --out "generated-images/edited-warmer.png"
```

Every bridge invocation uses an ephemeral Codex turn. Reattach the current edit target and any references still required for identity, style, layout, or compositing. Do not rely on the previous nested turn remembering an image.

Return and retain the absolute output path after every call. That path is the revision handle for the next turn.

## Explicit controls only

Use these flags only when the user actually supplied the corresponding requirement:

- `--region`
- repeated `--preserve`
- repeated `--avoid`
- repeated `--exact-text`
- `--size`, `--quality`, or `--background`

Do not manufacture values for these flags. A phrase such as “change only the icon” may be passed verbatim without expanding it into a long inferred preservation list.

For transparent output, `--background transparent` enables a minimal alpha check after generation. Exact text and dense layouts may still need user review, but they do not require an automatic quality gate.

## Optional diagnostics

Normal generation does not require planning or a no-image setup check. Use them only to debug paths, attachment order, sign-in, or bridge behavior. When speaking to the user, describe `--dry-run` as “a setup check that does not create an image”:

```bash
node <skill-folder>/scripts/gpt_image.mjs plan --prompt "test" --reference "/path/ref.png" --out "generated-images/test.png" --json
node <skill-folder>/scripts/gpt_image.mjs generate --prompt "test" --out "generated-images/test.png" --dry-run --json
```

The normal successful non-JSON response is intentionally small: `PATH=...` and `MARKDOWN=...`.
