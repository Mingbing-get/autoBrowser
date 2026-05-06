import type { InputCommandResultPayload, InputSourceInfo } from "@autobrowser/shared";

export interface KeyboardTypeResult extends Omit<InputCommandResultPayload, "typed" | "tabId"> {
  inputSource?: InputSourceInfo;
}

export interface KeyboardUploadResult {
  uploaded: true;
  strategy: "native-dialog";
}

export interface KeyboardController {
  typeText(value: string): Promise<KeyboardTypeResult>;
  uploadFile(filepath: string): Promise<KeyboardUploadResult>;
}
