export function validateExtensionId(extensionId: string) {
  if (!/^[a-p]{32}$/.test(extensionId)) {
    throw new Error("Chrome extension ID must be 32 characters using letters a-p.");
  }
}
