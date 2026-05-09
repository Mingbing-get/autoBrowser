---
name: auto-browser-xiaohongshu
description: Use when browsing or publishing on Xiaohongshu through autoBrowser, especially when a task requires opening xiaohongshu.com, checking whether login is required, searching by keyword, browsing posts, or creating a new post from the publish workflow.
---

# auto-browser-xiaohongshu

Use this skill for Xiaohongshu workflows driven by `autoBrowser`.

Prerequisite: the base skill `auto-browser-use` must already be installed and should be followed first for general `autoBrowser` command usage.

Read [references/home-feed.md](references/home-feed.md) before doing homepage entry or any post-browsing work. In this skill, "browsing posts" includes card browsing, opening the detail modal, reading note content, scrolling comments, commenting, reacting, and closing the detail modal.

Read [references/publish-post.md](references/publish-post.md) when the task is to create or publish a Xiaohongshu post.

## Scope

Use this skill when the task involves one or more of these Xiaohongshu actions:

- open the Xiaohongshu homepage
- determine whether the session is already logged in
- search notes by keyword through `#search-input`
- browse posts from the homepage or search result list
- create a Xiaohongshu post from the publish flow

## Working rules

1. Always use the full `autoBrowser` command name.
2. Open Xiaohongshu first, then check login state before attempting search or note interaction.
3. Treat note detail as a modal layer. Do not assume the page navigates away.
4. Re-check the page with `summary`, `query`, `search`, or `text` after every meaningful interaction because Xiaohongshu content updates dynamically.
5. When publishing, ensure the session is already logged in before clicking "发布" on the homepage.

## Default workflow

### 1. Open Xiaohongshu

```bash
autoBrowser open "https://www.xiaohongshu.com"
autoBrowser summary
```

### 2. Check whether login is required

After the homepage appears, inspect whether a login modal is blocking the page.

Recommended checks:

```bash
autoBrowser search "扫码登录"
autoBrowser search "登录"
autoBrowser search "二维码"
autoBrowser query "input#search-input"
```

Interpretation:

- If login-related text or a QR-code login modal is present, pause the workflow and let the user scan the code.
- If the modal disappears and `input#search-input` is usable, continue.
- If both are present, treat the page as not ready until the blocking login modal is gone.

### 3. Search by keyword

The Xiaohongshu search box uses id `search-input`.

```bash
autoBrowser input "input#search-input" --value "<keyword>"
```

Then submit the search.

Preferred behavior:

- Press `Enter` while focus is still in `#search-input`.

Important note:

- The current `autoBrowser` CLI exposes `input` but does not document a dedicated public `press-key` command in this repository.
- If the calling environment has a native keypress helper layered on top of `autoBrowser`, use it immediately after `input`.
- If not, inspect the page for the visible search trigger and click it as the fallback submission path.

After submission, confirm the result page loaded:

```bash
autoBrowser summary
autoBrowser search "<keyword>"
```

### 4. Browse posts

All post-browsing behavior lives in [references/home-feed.md](references/home-feed.md), including:

- identifying and opening note cards
- reading the note detail modal
- scrolling comments inside `.note-scroller`
- drafting, sending, or canceling comments
- adding emoji from `#showEmojiEl`
- clicking like, collect, and share
- closing the note detail modal

### 5. Publish posts

All publishing behavior lives in [references/publish-post.md](references/publish-post.md), including:

- opening the publish entry from the logged-in homepage
- switching to the creator tab at `https://creator.xiaohongshu.com/publish/publish?source=official`
- publishing through "上传图文"
- publishing through "文字配图"
- publishing through "写长文"
- filling the shared detail page
- temporarily saving and leaving
- publishing directly

## Practical guidance

- Xiaohongshu is dynamic. Prefer short inspect-act-inspect loops over long blind command chains.
- Exact card, author, title, content, topic, and send-button selectors may vary. Discover them from the current DOM before interacting.
- If a login modal appears again in the middle of the task, stop interaction and return to the login-check step.
- If a search result opens in a different state than expected, use `summary` immediately and adapt to the actual modal structure instead of assuming the old selector still applies.
