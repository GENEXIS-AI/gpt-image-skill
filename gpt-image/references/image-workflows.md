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

## Parallel batch generation

Use `batch` for independent images that can be generated in any order. The CLI parses the manifest and resolves its paths once, checks ChatGPT authentication once for the entire live run, then starts separate ephemeral `codex exec` image jobs with bounded concurrency. It does not run Doctor, planning, output inspection, or automatic retries for each job.

Create a JSON file inside the active workspace:

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "wide-hero",
      "prompt": "A cobalt-blue glass robot on a warm off-white background.",
      "out": "generated-images/wide-hero.png",
      "size": "16:9",
      "quality": "high quality"
    },
    {
      "id": "square-reference",
      "prompt": "Draw this character riding a bicycle.",
      "out": "generated-images/square-reference.png",
      "references": ["references/robot.png"],
      "reference_roles": ["character reference"],
      "size": "1:1"
    }
  ]
}
```

Run it from the workspace:

```bash
node <skill-folder>/scripts/gpt_image.mjs batch \
  --manifest "image-jobs.json" \
  --concurrency 2
```

Concurrency defaults to 2 and is capped at 4 to avoid an unbounded subscription burst. Every job is a separate built-in image generation and consumes included Codex usage. Successful jobs return their own `PATH[id]` and `MARKDOWN[id]`; one failed job does not erase other independent results, and the CLI does not retry it automatically or switch to an API route.

Each job requires `prompt` and `out`. It may also use `mode`, `edit_target`, `references`, `reference_roles`, `region`, `preserve`, `avoid`, `exact_text`, `quality`, `size`, `background`, `timeout_seconds`, `overwrite`, or `verbose`. Field names use JSON underscores. Prompts remain verbatim.

Output paths must be unique. A batch output cannot be another batch job's input, even when that file already exists, because that would create a race. Run dependent edits sequentially:

```text
generate A → receive A path → generate --mode edit --edit-target A
```

To check only manifest structure, input files, output paths, and parallel scheduling without checking sign-in or generating images, use `--check-only`. In user-facing language, call this “checking the batch without creating images.” It is optional, not a required gate before a normal batch.

## Optional diagnostics

Normal generation does not require planning or a no-image setup check. Use them only to debug paths, attachment order, sign-in, or bridge behavior. When speaking to the user, describe `--dry-run` as “a setup check that does not create an image”:

```bash
node <skill-folder>/scripts/gpt_image.mjs plan --prompt "test" --reference "/path/ref.png" --out "generated-images/test.png" --json
node <skill-folder>/scripts/gpt_image.mjs generate --prompt "test" --out "generated-images/test.png" --dry-run --json
```

The normal successful non-JSON response is intentionally small: `PATH=...` and `MARKDOWN=...`.
