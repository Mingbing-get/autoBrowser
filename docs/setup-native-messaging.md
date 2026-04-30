# Native Messaging Setup

## 1. Build the workspace

```bash
pnpm install
pnpm build
```

## 2. Load the extension

Open Chrome and go to `chrome://extensions`.

- Enable `Developer mode`
- Choose `Load unpacked`
- Select `packages/extension/dist`

The installable extension directory is `packages/extension/dist`.

## 3. Get the extension ID

After loading the unpacked extension, copy its Chrome extension ID from `chrome://extensions`.

## 4. Install the Native Messaging host manifest

Run:

```bash
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js install-host <chrome-extension-id>
```

This command:

- writes the manifest to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.autobrowser.host.json`
- fills `allowed_origins` with your extension ID
- creates `~/Library/Application Support/autoBrowser/native-host.sh` with an absolute Node runtime path
- marks both the launcher and `packages/native-host/dist/bin.js` as executable

If you want to inspect the template, it is still available at:

- `packages/native-host/manifests/com.autobrowser.host.json`

## 5. Start the service

Run this in one shell:

```bash
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js serve
```

This starts:

- HTTP API on `127.0.0.1:3210`
- Native host bridge on `127.0.0.1:3211`

## 6. Send commands

Run these in another shell:

```bash
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js open "https://www.baidu.com"
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js query "#su"
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js query "#su" --tabId 123
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js search-from-point 120 84 --tabId 123
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js summary --tabId 123
node /Users/mingbing/apps/ai-project/autoBrowser/packages/cli/dist/bin.js text "#content" --tabId 123
```

## Notes

- The current MVP assumes one connected browser session.
- `query` / `summary` / `text` run against the current active tab in the last-focused Chrome window by default.
- If you pass `tabId`, the extension activates that tab first and then runs the command there. If the tab does not exist, the command returns an error.
- The extension reconnects to the native host automatically after disconnect.
