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
node packages/cli/dist/bin.js query "#id"
node packages/cli/dist/bin.js query "#id" --tabId 123
node packages/cli/dist/bin.js search-from-point 120 84 --tabId 123
node packages/cli/dist/bin.js summary --tabId 123
node packages/cli/dist/bin.js text "#content" --tabId 123
node packages/cli/dist/bin.js rect "#content" --tabId 123
node packages/cli/dist/bin.js click "#content" --tabId 123
node packages/cli/dist/bin.js input "#search" --value "hello world" --tabId 123
```

`input` clicks the target element first, then types into it through native keyboard automation. On macOS, non-ASCII text such as Chinese is entered through a temporary clipboard paste fallback, and the command result includes the detected input source when available.

Chrome setup details are in `docs/setup-native-messaging.md`.

When loading the extension in Chrome, choose `packages/extension/dist` as the unpacked extension directory.
