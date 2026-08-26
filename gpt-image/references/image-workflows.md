# Image and reference workflows

Read this reference when a request includes an existing image, multiple visual inputs, an edit, a variation, transparency, exact text, compositing, or repeated refinement.

## Capability map

| User intent | Native host | Subscription bridge |
| --- | --- | --- |
| New image, no reference | Call the host image generator | `--mode generate` |
| New image guided by one or more images | Attach every image and state its role by number | Repeat `--reference`; repeat matching `--reference-role` values |
| Edit an existing image | Mark one image as the edit target and list invariants | `--mode edit --edit-target PATH` |
| Localized edit | Describe the spatial area and everything outside it to preserve | Add `--region` and one or more `--preserve` values |
| Style transfer or compositing | Identify content, style, insert, layout, foreground, and background inputs by number | Put the edit target first, then ordered references with explicit roles |
| Variation | Use the current image as the source and name the invariants | `--mode variation --edit-target PATH` |
| Iterative revision | Make one targeted change per call and reuse the last selected output | Use the last output as the next `--edit-target` |
| Transparent asset | Request actual alpha transparency and verify the saved PNG | Add `--background transparent` |
| Exact text | Quote short text, specify placement and typography, and inspect every word | Repeat `--exact-text` and include placement in `--prompt` |
| Several assets or variants | Make one image-generation call per final asset | Make one bridge invocation per final output path |

The bridge supports PNG, JPEG, and WebP inputs. It validates each input's raster signature, byte size, and SHA-256 before it starts Codex. Final output is one workspace-contained PNG per invocation.

## Assign image roles before generation

Use exactly one primary edit target when changing an existing asset. Treat every other image as supporting guidance. A useful small set is:

- Image 1: primary edit target or main content/subject reference
- Image 2: style, palette, lighting, or material reference
- Image 3: layout, pose, insert, or compositing reference

State how the images relate. Use spatial language such as foreground, background, left, right, and upper-right. Do not attach images without explaining what each one contributes.

When the bridge has an edit target, it always attaches that file as Image 1. Supporting references follow in command-line order. The JSON receipt records `attachment_index`, role, format, bytes, and SHA-256 for every input.

## Native host workflow

1. Inspect or load every local target/reference so the host can pass it to its native image-generation tool.
2. Label each image as edit target, subject/content reference, style reference, layout reference, or supporting insert.
3. For an edit, repeat what may change and what must stay unchanged. Preserve every unspecified detail.
4. Generate one final image per call. For several variants, make separate calls so each prompt and output can be inspected.
5. Inspect the result for subject, composition, exact text, invariants, avoid items, and transparency.
6. Copy or move the selected output into `<workspace>/generated-images/`, run `inspect --input <path> --json` when the runner is available, and show its absolute path inline. Add `--require-transparency` when alpha is mandatory.

Interactive Canvas area selection and conversation multi-select remain host UI gestures. In a CLI-only session, express the same intent with a precise spatial region, numbered local inputs, and explicit preservation rules.

## Bridge planning

Run `plan` before a live request when input roles or edit semantics matter. Planning does not check authentication or consume image-generation usage.

```bash
node <skill-folder>/scripts/gpt_image.mjs plan \
  --mode edit \
  --prompt "Replace only the mug with a small potted plant." \
  --edit-target "/absolute/path/product-photo.png" \
  --region "the mug on the left side of the desk" \
  --preserve "person, desk layout, lighting, colors, crop, and every other detail" \
  --avoid "text, logos, and watermarks" \
  --out "generated-images/plant-edit.png" \
  --json
```

After the plan passes, use `generate` with the same options and add `--dry-run` for the authenticated route check. Remove `--dry-run` only for the requested live image.

## Reference-guided generation

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "Create a landing-page hero. Keep the product from Image 1 and use only the line work, muted palette, and soft shadows from Image 2. Leave the upper-right clear for later copy." \
  --reference "/absolute/path/product.png" \
  --reference-role "product identity and camera-angle reference" \
  --reference "/absolute/path/style.png" \
  --reference-role "line work, palette, and shadow reference" \
  --preserve "product identity" \
  --avoid "logos, text, and watermark" \
  --out "generated-images/product-hero.png" \
  --json
```

## Edit with supporting references

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "Keep the product and layout from Image 1, but apply the clean editorial treatment from Image 2." \
  --edit-target "/absolute/path/current-asset.png" \
  --reference "/absolute/path/editorial-style.png" \
  --reference-role "style, palette, and lighting only" \
  --preserve "product, camera angle, object positions, crop, and empty copy area" \
  --out "generated-images/editorial-edit.png" \
  --json
```

## Variation and iterative refinement

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode variation \
  --prompt "Create a warmer evening variation with softer shadows." \
  --edit-target "generated-images/product-hero.png" \
  --preserve "product identity, camera angle, layout, and crop" \
  --out "generated-images/product-hero-evening.png" \
  --json
```

For the next revision, use `product-hero-evening.png` as the new edit target and ask for one change. Repeating all invariants reduces drift.

## Transparency, exact text, and dense layouts

For a transparent cutout, request `--background transparent`, keep the subject's edges unchanged, and inspect the saved PNG for real alpha rather than a checkerboard. For text, repeat `--exact-text` for every required string, keep strings short, and specify font style, size, color, and placement in the prompt. For infographics, describe hierarchy and layout, keep labels concise, request sharp text, and review every word before production use.

## Inspect the contract

```bash
node <skill-folder>/scripts/gpt_image.mjs capabilities --json
```

The capability report distinguishes built-in workflows from host-only UI gestures and confirms that the Images API, API-key login, and separately billed fallback are disabled by design.
