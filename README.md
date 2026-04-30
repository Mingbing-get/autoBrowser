# autoBrowser

`pnpm` monorepo for a TypeScript CLI and a Chrome extension that communicate through Native Messaging.

## Packages

- `packages/cli`: `ab` / `autoBrowser` command line entry
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

Build a publishable npm tarball:

```bash
pnpm package:npm
```

Publish the packaged CLI to npm:

```bash
pnpm publish:npm
```

After globally installing the published package, export the bundled Chrome extension:

```bash
ab extension --path ./autobrowser-extension
```

Then load `./autobrowser-extension` in Chrome through "Load unpacked".

Start the local service:

```bash
ab serve
```

After you manually load the extension in Chrome, install the Native Messaging host manifest with the extension ID:

```bash
ab install-host <chrome-extension-id>
```

Then use the CLI from another shell:

```bash
ab open "https://www.baidu.com"
ab tabs
ab query "#id"
ab search "搜索"
ab search-from-point 120 84
ab summary
ab text "#content"
ab rect "#content"
ab click "#content"
ab click-observe "#content"
ab scroll --y 400
ab input "#search" --value "hello world"
ab close
ab status
```

`input` clicks the target element first, then types into it through native keyboard automation. On macOS, non-ASCII text such as Chinese is entered through a temporary clipboard paste fallback, and the command result includes the detected input source when available.

Chrome setup details are in `docs/setup-native-messaging.md`.

When loading the extension in Chrome, choose `packages/extension/dist` as the unpacked extension directory.

## CLI Commands

All commands are available through `ab <command> ...`.

### `help` and `version`

```bash
ab -h
ab --help
ab -v
ab --version
```

### `open`

Open a URL in Chrome.

```bash
ab open "https://www.baidu.com"
```

### `close`

Close the active tab, or a specific tab with `--tabId`.

```bash
ab close
ab close --tabId 123
```

### `tabs`

List the current browser tabs.

```bash
ab tabs
```

### `query`

Inspect a DOM node and return the matched node plus surrounding context.

```bash
ab query "#id"
ab query "#id" --tabId 123
```

### `search`

Search visible page content by text.

```bash
ab search "搜索"
ab search "搜索" --tabId 123
```

### `search-from-point`

Search DOM layers from a browser coordinate.

```bash
ab search-from-point 120 84
ab search-from-point 120 84 --tabId 123
```

### `summary`

Return a page summary for the active tab or a specific tab.

```bash
ab summary
ab summary --tabId 123
```

### `text`

Extract text from the matched element.

```bash
ab text "#content"
ab text "#content" --tabId 123
```

### `rect`

Return layout and viewport metrics for the matched element.

```bash
ab rect "#content"
ab rect "#content" --tabId 123
```

### `click`

Click the matched element. The service will calibrate browser-to-screen coordinates when needed.

```bash
ab click "#content"
ab click "#content" --tabId 123
```

### `click-observe`

Click the matched element and return a post-click observation summary.

```bash
ab click-observe "#content"
ab click-observe "#content" --tabId 123
ab click-observe "#content" --maxObserveMs 1500 --stableWindowMs 300
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
ab scroll --y 400
ab scroll --x 120 --y -240 --tabId 123
```

### `input`

Click the target element, then type text into it.

```bash
ab input "#search" --value "hello world"
ab input "#search" --value "hello world" --tabId 123
```

### `flow`

Execute multiple commands in sequence from a single JSON array argument.

```bash
ab flow '[{"action":"open","url":"https://www.baidu.com"},{"action":"input","selector":"#kw","value":"自动化测试"},{"action":"click","selector":"#su"}]'
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
ab flow '[
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
ab serve
```

### `extension`

Copy the bundled Chrome extension files to a local directory that Chrome can load as an unpacked extension.

```bash
ab extension --path ./autobrowser-extension
ab extension --path=/tmp/autobrowser-extension
```

After copying:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the exported directory
5. Copy the extension ID and run `ab install-host <chrome-extension-id>`

### `install-host`

Install the Native Messaging host manifest for a Chrome extension ID.

```bash
ab install-host <chrome-extension-id>
```

### `status`

Return the local service status as JSON.

```bash
ab status
```
