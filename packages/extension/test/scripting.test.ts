import { beforeEach, describe, expect, it } from "vitest";
import { inspectDom } from "../src/adapters/scripting.js";

describe("inspectDom", () => {
  beforeEach(() => {
    document.body.innerHTML = "";

    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value() {
        return {
          width: 100,
          height: 24,
          top: 0,
          left: 0,
          right: 100,
          bottom: 24,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          }
        };
      }
    });
  });

  it("returns every meaningful descendant in children without truncating query results", () => {
    document.body.innerHTML = `
      <div id="root">
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <button id="deep-action">Deep action</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <form id="search-form">
          <input id="kw" name="wd" placeholder="Search keyword" />
          <input id="su" type="submit" value="百度一下" />
        </form>
        <div>
          <textarea id="chat-textarea" placeholder="Ask something"></textarea>
          <button id="chat-submit-button">百度一下</button>
        </div>
      </div>
    `;

    const result = inspectDom({
      mode: "query",
      selector: "#root"
    });

    expect(result).toMatchObject({
      found: true
    });

    const payload = result as {
      self?: {
        children?: Array<{
          tag: string;
          locator?: { preferred: string };
          text?: string;
        }>;
      };
    };

    expect(payload.self?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tag: "button",
          text: "Deep action",
          locator: expect.objectContaining({
            preferred: "#deep-action"
          })
        }),
        expect.objectContaining({
          tag: "form",
          locator: expect.objectContaining({
            preferred: "#search-form"
          })
        }),
        expect.objectContaining({
          tag: "input",
          attrs: expect.objectContaining({
            id: "kw",
            name: "wd",
            placeholder: "Search keyword"
          }),
          locator: expect.objectContaining({
            preferred: "#kw"
          })
        }),
        expect.objectContaining({
          tag: "input",
          attrs: expect.objectContaining({
            id: "su",
            type: "submit"
          }),
          text: "百度一下",
          locator: expect.objectContaining({
            preferred: "#su"
          })
        }),
        expect.objectContaining({
          tag: "textarea",
          attrs: expect.objectContaining({
            id: "chat-textarea",
            placeholder: "Ask something"
          }),
          locator: expect.objectContaining({
            preferred: "#chat-textarea"
          })
        }),
        expect.objectContaining({
          tag: "button",
          text: "百度一下",
          locator: expect.objectContaining({
            preferred: "#chat-submit-button"
          })
        })
      ])
    );

    expect(payload.self?.children).toHaveLength(6);
  });
});
