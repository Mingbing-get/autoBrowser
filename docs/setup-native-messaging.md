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
```

## Notes

- The current MVP assumes one connected browser session.
- `query` runs against the current active tab in the last-focused Chrome window.
- The extension reconnects to the native host automatically after disconnect.
