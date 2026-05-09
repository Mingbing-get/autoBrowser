# Xiaohongshu Publish Flow

Use this reference when the task is to create, draft, or publish a Xiaohongshu post.

## Preconditions

- Start from the Xiaohongshu homepage.
- The session must already be logged in.
- If a QR login popup is visible, stop here and wait for login before continuing.

Verify readiness first:

```bash
autoBrowser open "https://www.xiaohongshu.com"
autoBrowser summary
autoBrowser search "扫码登录"
autoBrowser query "input#search-input"
```

Interpretation:

- If a login popup is still visible, do not continue to publishing.
- Only continue once the homepage is in a logged-in state.

## Enter the publish flow

Click the visible "发布" button from the homepage.

```bash
autoBrowser click "<publish-button-selector>"
```

Expected result:

- the browser opens a new tab
- the new tab URL is `https://creator.xiaohongshu.com/publish/publish?source=official`

After clicking:

```bash
autoBrowser tabs
```

Then switch subsequent operations to the new creator tab. Use `--tabId <number>` where needed if the creator tab is not the active tab.

## Publish entry options

The creator page has two main options:

- `上传图文`
- `写长文`

Inside the `上传图文` path, there are two creation modes:

- direct image upload
- text-to-image generation through the "文字配图" entry

## Shared detail page

Several publishing paths eventually reach the same detail page.

On this page:

- the title field is an input with placeholder `填写标题会有更多赞哦`
- the detailed content area is an editable div with class `tiptap ProseMirror`
- topics can be linked directly in the detailed content by typing `#话题名`
- each topic must be separated by a space
- you can click `暂存离开` to save and leave
- you can click `发布` to publish directly

Title input example:

```bash
autoBrowser input "input[placeholder='填写标题会有更多赞哦']" --value "<title>"
```

Content input example:

```bash
autoBrowser input ".tiptap.ProseMirror" --value "<content with #topic1 #topic2>"
```

Rules for topics:

- use the `#` prefix directly in content
- keep one space between topics
- if topic linking behavior is uncertain, re-run `summary` after input and confirm the page recognized them

## Path 1: Upload image post

### Step 1. Open the `上传图文` tab

```bash
autoBrowser click "<upload-image-post-tab-selector>"
```

### Step 2. Choose how to create

This path supports:

- uploading local images directly
- entering the text-to-image workflow

### Step 3A. Directly upload images

Use the upload trigger selector from the current page and upload local files:

```bash
autoBrowser upload "<upload-image-selector>" "/absolute/path/to/image.png"
```

After upload completes, the page should enter the shared detail page.

Then fill details:

```bash
autoBrowser input "input[placeholder='填写标题会有更多赞哦']" --value "<title>"
autoBrowser input ".tiptap.ProseMirror" --value "<content with #topic1 #topic2>"
```

Finish with one of:

```bash
autoBrowser click "<save-and-leave-selector>"
autoBrowser click "<publish-submit-selector>"
```

Meaning:

- `暂存离开`: save the post and leave
- `发布`: publish immediately

## Path 2: Text-to-image inside `上传图文`

### Step 1. Enter the text-to-image page

Click the visible `文字配图` button.

```bash
autoBrowser click "<text-to-image-button-selector>"
```

### Step 2. Enter the generation prompt text

Input the content in the editable div with class `tiptap ProseMirror`.

```bash
autoBrowser input ".tiptap.ProseMirror" --value "<text used to generate the image>"
```

### Step 3. Generate images

Click `生成图片` and wait for the system to finish.

```bash
autoBrowser click "<generate-image-button-selector>"
autoBrowser summary
```

Wait-and-check loop:

- use `summary`
- inspect whether multiple generated images are visible
- do not continue until the page clearly shows generated image choices

### Step 4. Select one generated image

The page shows multiple generated images. Click one image to select it.

```bash
autoBrowser click "<generated-image-option-selector>"
```

### Step 5. Continue to the shared detail page

Click `下一步`.

```bash
autoBrowser click "<next-step-selector>"
```

Expected result:

- the page enters the same shared detail page used by direct image upload
- the detailed content area is already filled with the text entered during image generation

Then continue with the shared detail workflow:

- verify the content is present
- input the title
- optionally append or refine the content
- click `暂存离开` or `发布`

## Path 3: Write long article

### Step 1. Open the `写长文` tab

```bash
autoBrowser click "<long-article-tab-selector>"
```

### Step 2. Click `新的创作`

```bash
autoBrowser click "<new-creation-selector>"
```

### Step 3. Fill title and long-form content

The writing area has:

- a textarea with placeholder `输入标题`
- an editable div with class `rich-editor-content`

Input the title:

```bash
autoBrowser input "textarea[placeholder='输入标题']" --value "<title up to 64 chars>"
```

Input the long article content:

```bash
autoBrowser input ".rich-editor-content" --value "<long article content>"
```

Rules:

- the title limit is 64 characters
- use `summary` if the editor state is unclear after input

### Step 4. Click `一键排版`

```bash
autoBrowser click "<auto-format-button-selector>"
```

Expected result:

- the page enters a formatting preview area

### Step 5. Choose next action

From the formatting preview area, two main actions are available:

- `暂存离开`: save as draft and leave
- `下一步`: continue to the shared detail page

If saving as draft:

```bash
autoBrowser click "<save-and-leave-selector>"
```

If continuing:

```bash
autoBrowser click "<next-step-selector>"
```

Expected result after `下一步`:

- the page enters the same shared detail page
- the title is automatically filled with the earlier title
- the detailed content area is empty

Then continue with the shared detail workflow:

- verify the title is present
- fill `.tiptap.ProseMirror` with the detail content
- add `#话题` with spaces between topics if needed
- click `暂存离开` or `发布`

## Practical guidance

- The publish flow spans multiple states and sometimes a new tab, so inspect after every major click.
- Do not assume the creator tab becomes active automatically; verify with `tabs`.
- Several buttons are described by visible text only. Discover precise selectors from the current DOM before clicking.
- The shared detail page appears after multiple entry paths. Once there, reuse the same title/content/save/publish rules.
- For long waits such as image generation, keep polling with `summary` rather than chaining blind actions.
