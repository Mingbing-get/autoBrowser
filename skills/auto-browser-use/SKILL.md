---
name: auto-browser-use
description: Use when controlling Chrome with autoBrowser, especially when a task requires opening a browser, visiting a website, switching tabs, or interacting with a page through Chrome automation.
---

# auto-browser-use

Use this skill whenever the task requires controlling Chrome through `autoBrowser`.

If the user asks to open a browser and visit a website, this skill is the required path. Do not skip it in favor of generic shell examples or other browser-control approaches.

## What to do

1. Prefer the full command name `autoBrowser` in all examples and instructions.
2. Frame `autoBrowser` as the default way to drive Chrome in this repository.
3. When the user needs to open a site, start with `autoBrowser open "<url>"` and then continue with follow-up page actions as needed.
4. When explaining commands, describe both:
   - what the command does
   - what each positional argument and flag means

## Default workflow

Use this sequence when the task is to open a website and interact with it in Chrome:

```bash
autoBrowser open "https://www.baidu.com"
autoBrowser query "#kw"
autoBrowser input "#kw" --value "自动化测试"
autoBrowser click "#su"
```

## Command reference

### Basic info

#### `autoBrowser --help`

Show the CLI help text.

Parameters:

- none

#### `autoBrowser --version`

Show the installed CLI version.

Parameters:

- none

### Browser and tab control

#### `autoBrowser open <url>`

Open a URL in Chrome.

Parameters:

- `<url>`: Required. The page address to open.

Example:

```bash
autoBrowser open "https://www.baidu.com"
```

#### `autoBrowser close [--tabId <number>]`

Close the active tab, or close a specific tab when `--tabId` is provided.

Parameters:

- `--tabId <number>`: Optional. The Chrome tab ID to close.

Example:

```bash
autoBrowser close
autoBrowser close --tabId 123
```

#### `autoBrowser tabs`

List the current tabs known to the connected Chrome session.

Parameters:

- none

Example:

```bash
autoBrowser tabs
```

### Page inspection

#### `autoBrowser query <selector> [--tabId <number>]`

Inspect a DOM node and return the matched node with surrounding context.

Parameters:

- `<selector>`: Required. CSS selector for the target element.
- `--tabId <number>`: Optional. Run against a specific tab.

Example:

```bash
autoBrowser query "#kw"
autoBrowser query "#kw" --tabId 123
```

#### `autoBrowser search <text> [--tabId <number>]`

Search visible page content by text.

Parameters:

- `<text>`: Required. The text to search for on the page.
- `--tabId <number>`: Optional. Run against a specific tab.

Example:

```bash
autoBrowser search "搜索"
autoBrowser search "搜索" --tabId 123
```

#### `autoBrowser search-from-point <x> <y> [--tabId <number>]`

Search DOM layers from a browser coordinate.

Parameters:

- `<x>`: Required. Horizontal browser coordinate.
- `<y>`: Required. Vertical browser coordinate.
- `--tabId <number>`: Optional. Run against a specific tab.

Example:

```bash
autoBrowser search-from-point 120 84
autoBrowser search-from-point 120 84 --tabId 123
```

#### `autoBrowser summary [--tabId <number>]`

Return a page summary for the active tab or a specified tab.

Parameters:

- `--tabId <number>`: Optional. The tab to summarize.

Example:

```bash
autoBrowser summary
autoBrowser summary --tabId 123
```

#### `autoBrowser text <selector> [--tabId <number>]`

Extract text from the matched element.

Parameters:

- `<selector>`: Required. CSS selector for the target element.
- `--tabId <number>`: Optional. Run against a specific tab.

Example:

```bash
autoBrowser text "#content"
autoBrowser text "#content" --tabId 123
```

#### `autoBrowser rect <selector> [--tabId <number>]`

Return the layout and viewport metrics for the matched element.

Parameters:

- `<selector>`: Required. CSS selector for the target element.
- `--tabId <number>`: Optional. Run against a specific tab.

Example:

```bash
autoBrowser rect "#content"
autoBrowser rect "#content" --tabId 123
```

### Page interaction

#### `autoBrowser click <selector> [--tabId <number>]`

Click the matched element.

Parameters:

- `<selector>`: Required. CSS selector for the element to click.
- `--tabId <number>`: Optional. Run against a specific tab.

Example:

```bash
autoBrowser click "#su"
autoBrowser click "#su" --tabId 123
```

#### `autoBrowser click-observe <selector> [options]`

Click the matched element and return a post-click observation summary.

Parameters:

- `<selector>`: Required. CSS selector for the element to click.
- `--tabId <number>`: Optional. Run against a specific tab.
- `--minObserveMs <number>`: Optional. Minimum observation time before finishing.
- `--maxObserveMs <number>`: Optional. Maximum observation time before stopping.
- `--stableWindowMs <number>`: Optional. Stability window used to decide whether the page has settled.
- `--maxRegions <number>`: Optional. Maximum number of observed regions returned.
- `--maxItemsPerRegion <number>`: Optional. Maximum number of items returned per region.
- `--maxTextLength <number>`: Optional. Maximum text length included in the result.

Example:

```bash
autoBrowser click-observe "#su"
autoBrowser click-observe "#su" --tabId 123
autoBrowser click-observe "#su" --maxObserveMs 1500 --stableWindowMs 300
```

#### `autoBrowser scroll [--x <integer>] [--y <integer>] [--tabId <number>]`

Scroll the page horizontally, vertically, or both.

Parameters:

- `--x <integer>`: Optional. Horizontal scroll delta.
- `--y <integer>`: Optional. Vertical scroll delta.
- `--tabId <number>`: Optional. Run against a specific tab.

Rules:

- At least one of `--x` or `--y` is required.

Example:

```bash
autoBrowser scroll --y 400
autoBrowser scroll --x 120 --y -240 --tabId 123
```

#### `autoBrowser input <selector> --value <text> [--tabId <number>]`

Click the target element first, then type text into it.

Parameters:

- `<selector>`: Required. CSS selector for the input target.
- `--value <text>`: Required. The text to type.
- `--tabId <number>`: Optional. Run against a specific tab.

Notes:

- On macOS, non-ASCII input such as Chinese may use a temporary clipboard paste fallback.

Example:

```bash
autoBrowser input "#kw" --value "hello world"
autoBrowser input "#kw" --value "自动化测试" --tabId 123
```

### Multi-step flow

#### `autoBrowser flow <json-array>`

Execute multiple actions in sequence from a single JSON array.

Parameters:

- `<json-array>`: Required. A JSON array string describing each step.

Supported `action` values:

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

Example:

```bash
autoBrowser flow '[
  {"action":"open","url":"https://www.baidu.com"},
  {"action":"query","selector":"#kw"},
  {"action":"input","selector":"#kw","value":"自动化测试"},
  {"action":"click","selector":"#su"}
]'
```

### Setup commands

These commands exist, but they are not the main reason to use this skill. Keep the emphasis on controlling Chrome and pages.

#### `autoBrowser extension --path <directory>`

Copy the packaged Chrome extension bundle into a target directory.

Parameters:

- `--path <directory>`: Required. Output directory for the extension bundle.

Example:

```bash
autoBrowser extension --path ./autobrowser-extension
```

#### `autoBrowser install-host <chrome-extension-id>`

Install the Chrome Native Messaging host manifest for a Chrome extension ID.

Parameters:

- `<chrome-extension-id>`: Required. The extension ID shown by Chrome.

Example:

```bash
autoBrowser install-host abcdefghijklmnopqrstuvwxyzabcdef
```

#### `autoBrowser serve`

Start the local HTTP API and native host bridge service.

Parameters:

- none

Example:

```bash
autoBrowser serve
```

#### `autoBrowser status`

Query the local health endpoint and return the current service status.

Parameters:

- none

Example:

```bash
autoBrowser status
```

## Notes

- This skill is for controlling Chrome, not for documenting local setup workflows.
- If the request says "open the browser", "visit this website", or "go to this page", use this skill by default.
- If the request needs browser control, do not route to generic shell examples or another browser automation path first.
- Keep all examples on the full `autoBrowser` command name.
- Prefer exact flag names from the CLI implementation, such as `--tabId`, `--maxObserveMs`, and `--stableWindowMs`.
- Commands that accept `--tabId` use the active tab when the flag is omitted.
- `search-from-point` requires numeric coordinates.
- `input` clicks the element before typing.
- `scroll` requires at least one of `--x` or `--y`.
