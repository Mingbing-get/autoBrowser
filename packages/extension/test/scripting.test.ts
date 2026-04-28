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

  it("returns page metadata with a flat descendant list for summary mode", () => {
    document.title = "Search Page";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://example.com/search")
    });

    document.body.innerHTML = `
      <main id="content">
        <h1 id="page-title">Search</h1>
        <form id="search-form">
          <input id="kw" name="wd" placeholder="Search keyword" />
          <input id="su" type="submit" value="Search now" />
        </form>
        <section>
          <button id="deep-action">Deep action</button>
        </section>
      </main>
    `;

    const result = inspectDom({
      mode: "summary"
    });

    expect(result).toMatchObject({
      title: "Search Page",
      url: "https://example.com/search"
    });

    const payload = result as {
      descendants?: Array<{
        tag: string;
        locator?: { preferred: string };
        text?: string;
        attrs?: Record<string, string>;
      }>;
    };

    expect(payload.descendants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tag: "main",
          locator: expect.objectContaining({
            preferred: "#content"
          })
        }),
        expect.objectContaining({
          tag: "h1",
          text: "Search",
          locator: expect.objectContaining({
            preferred: "#page-title"
          })
        }),
        expect.objectContaining({
          tag: "form",
          locator: expect.objectContaining({
            preferred: "#search-form"
          })
        }),
        expect.objectContaining({
          tag: "section"
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
          text: "Search now",
          locator: expect.objectContaining({
            preferred: "#su"
          })
        }),
        expect.objectContaining({
          tag: "button",
          text: "Deep action",
          locator: expect.objectContaining({
            preferred: "#deep-action"
          })
        })
      ])
    );
    expect(payload.descendants).toHaveLength(7);
  });
});
