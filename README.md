# autoBrowser

`pnpm` monorepo for a TypeScript CLI and a Chrome extension that communicate through Native Messaging.

## Packages

- `packages/cli`: `autoBrowser` command line entry
- `packages/service`: local HTTP service and bridge server
- `packages/native-host`: Chrome Native Messaging host bridge
- `packages/extension`: Chrome Manifest V3 extension
- `packages/shared`: shared protocol types

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

Start the local service:

```bash
node packages/cli/dist/bin.js serve
```

After you manually load the extension in Chrome, install the Native Messaging host manifest with the extension ID:

```bash
node packages/cli/dist/bin.js install-host <chrome-extension-id>
```

Then use the CLI from another shell:

```bash
node packages/cli/dist/bin.js open "https://www.baidu.com"
node packages/cli/dist/bin.js tabs
node packages/cli/dist/bin.js query "#id"
node packages/cli/dist/bin.js search "搜索"
node packages/cli/dist/bin.js search-from-point 120 84
node packages/cli/dist/bin.js summary
node packages/cli/dist/bin.js text "#content"
node packages/cli/dist/bin.js rect "#content"
node packages/cli/dist/bin.js click "#content"
node packages/cli/dist/bin.js click-observe "#content"
node packages/cli/dist/bin.js scroll --y 400
node packages/cli/dist/bin.js input "#search" --value "hello world"
node packages/cli/dist/bin.js close
node packages/cli/dist/bin.js status
```

`input` clicks the target element first, then types into it through native keyboard automation. On macOS, non-ASCII text such as Chinese is entered through a temporary clipboard paste fallback, and the command result includes the detected input source when available.

Chrome setup details are in `docs/setup-native-messaging.md`.

When loading the extension in Chrome, choose `packages/extension/dist` as the unpacked extension directory.

## CLI Commands

All commands are available through `node packages/cli/dist/bin.js <command> ...`.

### `open`

Open a URL in Chrome.

```bash
node packages/cli/dist/bin.js open "https://www.baidu.com"
```

### `close`

Close the active tab, or a specific tab with `--tabId`.

```bash
node packages/cli/dist/bin.js close
node packages/cli/dist/bin.js close --tabId 123
```

### `tabs`

List the current browser tabs.

```bash
node packages/cli/dist/bin.js tabs
```

### `query`

Inspect a DOM node and return the matched node plus surrounding context.

```bash
node packages/cli/dist/bin.js query "#id"
node packages/cli/dist/bin.js query "#id" --tabId 123
```

### `search`

Search visible page content by text.

```bash
node packages/cli/dist/bin.js search "搜索"
node packages/cli/dist/bin.js search "搜索" --tabId 123
```

### `search-from-point`

Search DOM layers from a browser coordinate.

```bash
node packages/cli/dist/bin.js search-from-point 120 84
node packages/cli/dist/bin.js search-from-point 120 84 --tabId 123
```

### `summary`

Return a page summary for the active tab or a specific tab.

```bash
node packages/cli/dist/bin.js summary
node packages/cli/dist/bin.js summary --tabId 123
```

### `text`

Extract text from the matched element.

```bash
node packages/cli/dist/bin.js text "#content"
node packages/cli/dist/bin.js text "#content" --tabId 123
```

### `rect`

Return layout and viewport metrics for the matched element.

```bash
node packages/cli/dist/bin.js rect "#content"
node packages/cli/dist/bin.js rect "#content" --tabId 123
```

### `click`

Click the matched element. The service will calibrate browser-to-screen coordinates when needed.

```bash
node packages/cli/dist/bin.js click "#content"
node packages/cli/dist/bin.js click "#content" --tabId 123
```

### `click-observe`

Click the matched element and return a post-click observation summary.

```bash
node packages/cli/dist/bin.js click-observe "#content"
node packages/cli/dist/bin.js click-observe "#content" --tabId 123
node packages/cli/dist/bin.js click-observe "#content" --maxObserveMs 1500 --stableWindowMs 300
```

Optional flags:

- `--tabId <number>`
- `--minObserveMs <number>`
- `--maxObserveMs <number>`
- `--stableWindowMs <number>`
- `--maxRegions <number>`
- `--maxItemsPerRegion <number>`
- `--maxTextLength <number>`

### `scroll`

Scroll the active tab or a specific tab. At least one of `--x` or `--y` is required.

```bash
node packages/cli/dist/bin.js scroll --y 400
node packages/cli/dist/bin.js scroll --x 120 --y -240 --tabId 123
```

### `input`

Click the target element, then type text into it.

```bash
node packages/cli/dist/bin.js input "#search" --value "hello world"
node packages/cli/dist/bin.js input "#search" --value "hello world" --tabId 123
```

### `flow`

Execute multiple commands in sequence from a single JSON array argument.

```bash
node packages/cli/dist/bin.js flow '[{"action":"open","url":"https://www.baidu.com"},{"action":"input","selector":"#kw","value":"自动化测试"},{"action":"click","selector":"#su"}]'
```

`flow` currently supports aggregating these actions:

- `input`
- `scroll`
- `click-observe`
- `click`
- `rect`
- `text`
- `summary`
- `search-from-point`
- `search`
- `query`
- `tabs`
- `open`
- `close`

Example with multiple action types:

```bash
node packages/cli/dist/bin.js flow '[
  {"action":"open","url":"https://www.baidu.com"},
  {"action":"tabs"},
  {"action":"query","selector":"#kw"},
  {"action":"search","text":"百度"},
  {"action":"search-from-point","x":120,"y":84},
  {"action":"summary"},
  {"action":"text","selector":"body"},
  {"action":"rect","selector":"#kw"},
  {"action":"click","selector":"#kw"},
  {"action":"click-observe","selector":"#su","observe":{"maxObserveMs":1500}},
  {"action":"scroll","deltaX":0,"deltaY":400},
  {"action":"input","selector":"#kw","value":"自动化测试"},
  {"action":"close"}
]'
```

### `serve`

Start the local HTTP service and Native Messaging bridge.

```bash
node packages/cli/dist/bin.js serve
```

### `install-host`

Install the Native Messaging host manifest for a Chrome extension ID.

```bash
node packages/cli/dist/bin.js install-host <chrome-extension-id>
```

### `status`

Return the local service status as JSON.

```bash
node packages/cli/dist/bin.js status
```
