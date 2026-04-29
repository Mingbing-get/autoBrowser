import type { InputCommandResultPayload, InputSourceInfo } from "@autobrowser/shared";

export interface KeyboardTypeResult extends Omit<InputCommandResultPayload, "typed" | "tabId"> {
  inputSource?: InputSourceInfo;
}

export interface KeyboardController {
  typeText(value: string): Promise<KeyboardTypeResult>;
}
