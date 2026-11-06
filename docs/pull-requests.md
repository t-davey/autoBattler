# Pull requests

Every change reaches `main` through a PR that carries one concern. PRs land as a single squashed commit, so the title becomes the permanent history. Branch commit messages disappear in the squash and follow no format.

## Steps

1. **Branch** from the latest `main` as `<type>/<kebab-summary>`, such as `feat/lamp-relighting`. A branch name your tool already assigned stays as it is.
2. **Reach Done**, as defined in [AGENTS.md](../AGENTS.md).
3. **Check scope** by reading `git diff main...HEAD`. Every changed file serves the PR's one concern, and anything else moves to its own branch.
4. **Review** the branch against `main` with `mattpocock-skills:code-review`, docs-only PRs included. Fix every confirmed finding, then repeat Done on the new final commit. Findings you leave unfixed go on the template's Review line, with the reason.
5. **Write the title** in the format below.
6. **Write the body** from [the template](../.github/pull_request_template.md), replacing every comment with real content. `gh pr create` skips the template when given a body, so read the file, fill it in, and pass the result with `--body-file`.
7. **Open the PR and hand over** its link. CI doesn't run on PRs, so the `npm run check` you ran for Done is the only check before merge. CI runs it on Windows when a release is published, which is too late to stop that release.

## Title

`<type>(<scope>)!: <summary>`

- **Type:** `feat` for new behaviour, or `fix`, `refactor`, `test`, `docs`, `chore`.
- **Scope:** `sim`, `ui`, or `electron`. Leave it out, with its parentheses, when the change spans several or sits outside them.
- **`!`:** include it only when existing saves stop loading, so the human knows what to warn friends about when releasing.
- **Summary:** lowercase imperative, under 72 characters for the whole title, naming the outcome in [CONTEXT.md](../CONTEXT.md) terms, which keep their capitals.

Examples:

- `feat(sim): relight a Lamp when its Guardian falls`
- `fix(electron): open the window without top-level await`
- `feat(sim)!: store Stance on the Party`
- `docs: add pull request guide`

## What the human decides

The human alone merges PRs, bypasses the `main` ruleset, and publishes releases. Merging doesn't release anything.

## Issues

Work needs an issue when it won't finish this session or will take more than one PR. Ask the human before filing one, and write it for public reading, because this repo is public.
