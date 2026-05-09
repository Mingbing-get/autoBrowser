# Xiaohongshu Homepage And Post Browsing

Use this reference when the task starts from the Xiaohongshu homepage or when browsing posts. Here, "browsing posts" includes:

- finding note cards
- opening a note detail modal
- reading note content
- scrolling comments
- commenting or canceling a comment
- adding emoji
- liking, collecting, or sharing
- closing the note detail modal

## Entry flow

1. Open the homepage.
2. Check whether a login popup blocks the page.
3. Confirm the search input `#search-input` is present.
4. Inspect the visible feed cards.
5. Choose a card by its title, author, or nearby text, then click it.

## Homepage checks

Start with:

```bash
autoBrowser open "https://www.xiaohongshu.com"
autoBrowser summary
autoBrowser query "input#search-input"
autoBrowser search "扫码登录"
autoBrowser search "二维码"
```

Interpret the page this way:

- If a QR login popup is visible, the page is not ready for autonomous browsing yet.
- If `#search-input` exists and no blocking login popup is visible, the homepage is ready.
- If the feed is visible but a login popup overlays it, wait for login first.

## Feed browsing

Homepage cards are individual notes with visible cover image, title, and author information.

Because the exact DOM can change, do not assume a fixed universal selector for every feed card. Inspect the current page first:

```bash
autoBrowser summary
autoBrowser query "<candidate-card-selector>"
autoBrowser text "<candidate-card-selector>"
```

Choose selectors that clearly identify one card at a time. Good strategies:

- use a stable card container discovered from `query`
- locate a card near a known title text
- locate a card near a known author name

## Opening a card

After finding the right card:

```bash
autoBrowser click "<note-card-selector>"
autoBrowser summary
```

Expected result:

- a note detail modal appears
- the left panel shows media
- the right panel shows note metadata and comments

If no modal appears, inspect the click result and try a more precise selector inside the same card.

## Note detail modal

After clicking a card, Xiaohongshu opens a detail modal.

Expected structure:

- left side: cover image or video carousel
- right side, top to bottom:
  - publisher
  - title
  - detailed content
  - mentioned topics
  - publish time
  - comment list

The right content area includes a scrollable container with class `.note-scroller`.

Use these checks after opening a note:

```bash
autoBrowser summary
autoBrowser query ".note-scroller"
autoBrowser search "评论"
```

## Reading note details

Use inspection commands against the visible modal content:

```bash
autoBrowser text "<publisher-selector>"
autoBrowser text "<title-selector>"
autoBrowser text "<content-selector>"
autoBrowser text "<topic-selector>"
autoBrowser text "<publish-time-selector>"
```

If exact selectors are unknown, discover them from the modal with `query`, `summary`, and `search` first instead of guessing.

## Scrolling comments

The comment list loads more content when the `.note-scroller` container scrolls.

Required sequence:

1. Hover `.note-scroller`
2. Scroll downward
3. Re-inspect newly loaded comments

Example:

```bash
autoBrowser hover ".note-scroller"
autoBrowser scroll --y 700
autoBrowser summary
```

If the page scrolls behind the modal instead of loading more comments, re-hover `.note-scroller` and try a smaller scroll delta.

## Comment actions

The comment input uses id `content-textarea`.

### Draft or send a plain comment

```bash
autoBrowser click "#content-textarea"
autoBrowser input "#content-textarea" --value "<comment text>"
autoBrowser click "<send-button-selector>"
```

Rules:

- Use the visible "发送" button to submit.
- If the user decides not to post, click the visible "取消" button.
- Re-run `summary` or `search "发送"` if the modal state is unclear.

### Add emoji before sending

The emoji trigger uses id `showEmojiEl`.

Example flow:

```bash
autoBrowser click "#content-textarea"
autoBrowser input "#content-textarea" --value "<comment prefix>"
autoBrowser click "#showEmojiEl"
autoBrowser click "<emoji-item-selector>"
autoBrowser input "#content-textarea" --value "<comment suffix>"
autoBrowser click "<send-button-selector>"
```

Behavior notes:

- Clicking `#showEmojiEl` opens the emoji picker.
- Clicking an emoji should select it, close the picker, and return focus to the textarea.
- After the picker closes, continue typing directly into `#content-textarea`.

## Like, collect, and share

The main interaction icons inside the note modal are:

- like: `svg.reds-icon.like-icon`
- collect: `svg.reds-icon.collect-icon`
- share: `svg.reds-icon.share-icon`

Examples:

```bash
autoBrowser click "svg.reds-icon.like-icon"
autoBrowser click "svg.reds-icon.collect-icon"
autoBrowser click "svg.reds-icon.share-icon"
```

After each action, inspect the post-click summary to confirm whether the UI state changed.

## Close the note detail modal

Close the modal through the close element with class `close close-mask-dark`.

```bash
autoBrowser click ".close.close-mask-dark"
```

Then verify that the card list view is active again:

```bash
autoBrowser summary
autoBrowser query "input#search-input"
```
