import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getElementRectInTab,
  inspectDom,
  querySelectorInTab,
  startClickMappingInTab,
  summarizePageInTab,
  textContentInTab
} from "../src/adapters/scripting.js";

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

  it("stops descending once a meaningful node is collected in query mode", () => {
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

    expect(payload.self?.children).toHaveLength(4);
    expect(payload.self?.explore).toBeUndefined();
    expect(result.meta?.hints).toBeUndefined();
    expect(payload.self?.children).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#kw"
          })
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#su"
          })
        })
      ])
    );
  });

  it("stops descending once a meaningful node is collected in summary mode", () => {
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
        })
      ])
    );
    expect(payload.descendants).toHaveLength(1);
    expect(result).not.toHaveProperty("suggestedSelectors");
    expect(result.meta?.hints).toBeUndefined();
    expect(payload.descendants).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#page-title"
          })
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#search-form"
          })
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#deep-action"
          })
        })
      ])
    );
  });

  it("keeps descending into children when an intermediate node has zero size", () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="collapsed-wrapper">
          <button id="deep-action">Deep action</button>
        </div>
      </div>
    `;

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value() {
        if ((this as HTMLElement).id === "collapsed-wrapper") {
          return {
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            x: 0,
            y: 0,
            toJSON() {
              return {};
            }
          };
        }

        return originalGetBoundingClientRect.call(this);
      }
    });

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
          locator?: { preferred: string };
        }>;
      };
    };

    expect(payload.self?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#deep-action"
          })
        })
      ])
    );
    expect(payload.self?.children).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#collapsed-wrapper"
          })
        })
      ])
    );
  });

  it("returns full innerText without truncation in text mode", () => {
    const longText = "Alpha ".repeat(80).trim();

    document.body.innerHTML = `
      <main id="content">
        <section>
          <h1>Heading</h1>
          <p>${longText}</p>
        </section>
      </main>
    `;

    const result = inspectDom({
      mode: "text",
      selector: "#content"
    });

    expect(result).toEqual({
      found: true,
      text: normalizeWhitespace(`Heading ${longText}`)
    });
    expect(result.text.length).toBeGreaterThan(120);
  });

  it("returns found false when the text selector does not exist", () => {
    document.body.innerHTML = `<main id="content">Hello</main>`;

    const result = inspectDom({
      mode: "text",
      selector: "#missing"
    });

    expect(result).toEqual({
      found: false
    });
  });

  it("returns element position and size in rect mode", () => {
    document.body.innerHTML = `
      <div id="scroller" style="overflow-x:auto;overflow-y:auto">
        <div id="target">Hello</div>
      </div>
    `;

    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        if ((this as HTMLElement).id === "target") {
          return 320;
        }

        if ((this as HTMLElement).id === "scroller") {
          return 640;
        }

        return 100;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if ((this as HTMLElement).id === "target") {
          return 480;
        }

        if ((this as HTMLElement).id === "scroller") {
          return 960;
        }

        return 24;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return (this as HTMLElement).id === "scroller" ? 260 : 100;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return (this as HTMLElement).id === "scroller" ? 180 : 24;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
      configurable: true,
      get() {
        return (this as HTMLElement).id === "scroller" ? 32 : 0;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get() {
        return (this as HTMLElement).id === "scroller" ? 48 : 0;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value() {
        if ((this as HTMLElement).id === "target") {
          return {
            width: 150,
            height: 60,
            top: 25,
            left: 40,
            right: 190,
            bottom: 85,
            x: 40,
            y: 25,
            toJSON() {
              return {};
            }
          };
        }

        if ((this as HTMLElement).id === "scroller") {
          return {
            width: 260,
            height: 180,
            top: 8,
            left: 12,
            right: 272,
            bottom: 188,
            x: 12,
            y: 8,
            toJSON() {
              return {};
            }
          };
        }

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

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 720
    });

    Object.defineProperty(window, "scrollX", {
      configurable: true,
      value: 140
    });

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 260
    });

    const result = inspectDom({
      mode: "rect",
      selector: "#target"
    });

    expect(result).toEqual({
      found: true,
      viewport: {
        innerWidth: 1280,
        innerHeight: 720,
        scrollX: 140,
        scrollY: 260
      },
      rect: {
        x: 40,
        y: 25,
        top: 25,
        left: 40,
        right: 190,
        bottom: 85,
        width: 150,
        height: 60,
        scrollWidth: 320,
        scrollHeight: 480
      },
      scrollableAncestors: [
        {
          tag: "div",
          id: "scroller",
          isRootScroller: false,
          rect: {
            x: 12,
            y: 8,
            top: 8,
            left: 12,
            right: 272,
            bottom: 188,
            width: 260,
            height: 180
          },
          scrollLeft: 32,
          scrollTop: 48,
          scrollWidth: 640,
          scrollHeight: 960,
          clientWidth: 260,
          clientHeight: 180
        }
      ]
    });
  });

  it("returns found false when rect mode cannot find the element", () => {
    document.body.innerHTML = `<div id="target">Hello</div>`;

    const result = inspectDom({
      mode: "rect",
      selector: "#missing"
    });

    expect(result).toEqual({
      found: false
    });
  });

  it("marks truncated text on the node itself without top-level hints", () => {
    const longText = "A".repeat(160);

    document.body.innerHTML = `
      <div id="root">
        <button id="long-copy">${longText}</button>
      </div>
    `;

    const result = inspectDom({
      mode: "query",
      selector: "#root"
    }) as {
      self?: {
        children?: Array<{
          tag: string;
          text?: string;
          meta?: {
            textTruncated?: boolean;
            originalTextLength?: number;
          };
        }>;
      };
      meta?: {
        hints?: string[];
      };
    };

    const truncatedButton = result.self?.children?.find((child) => child.tag === "button");

    expect(truncatedButton?.text?.endsWith("…")).toBe(true);
    expect(truncatedButton?.meta).toMatchObject({
      textTruncated: true,
      originalTextLength: 160
    });
    expect(result.meta?.hints).toBeUndefined();
  });

  it("omits locator fallbacks when there are no alternates", () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="only-locator">Click me</button>
      </div>
    `;

    const result = inspectDom({
      mode: "query",
      selector: "#root"
    }) as {
      self?: {
        children?: Array<{
          locator?: {
            preferred: string;
            fallbacks?: string[];
          };
        }>;
      };
    };

    const button = result.self?.children?.[0];

    expect(button?.locator?.preferred).toBe("#only-locator");
    expect(button?.locator).not.toHaveProperty("fallbacks");
  });
});

describe("script execution retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    const updatedListeners: Array<
      (tabId: number, changeInfo: { status?: "loading" | "complete" }, tab: chrome.tabs.Tab) => void
    > = [];
    let currentTab: chrome.tabs.Tab = {
      id: 3,
      status: "loading",
      url: "https://example.com"
    };

    globalThis.chrome = {
      tabs: {
        async create() {
          return currentTab;
        },
        async get() {
          return currentTab;
        },
        async query() {
          return [currentTab];
        },
        onUpdated: {
          addListener(listener) {
            updatedListeners.push(listener);
          },
          removeListener(listener) {
            const index = updatedListeners.indexOf(listener);
            if (index >= 0) {
              updatedListeners.splice(index, 1);
            }
          }
        }
      },
      scripting: {
        executeScript: vi
          .fn()
          .mockRejectedValueOnce(new Error("Frame with ID 0 was removed."))
          .mockResolvedValueOnce([
            {
              result: {
                title: "Recovered",
                url: "https://example.com",
                descendants: [],
                meta: {
                  textLimit: 120,
                  truncated: false
                }
              }
            }
          ])
      }
    } as unknown as typeof chrome;

    queueMicrotask(() => {
      currentTab = {
        ...currentTab,
        status: "complete"
      };
      updatedListeners[0]?.(3, { status: "complete" }, currentTab);
    });
  });

  it("retries summarizePageInTab when the main frame is replaced during injection", async () => {
    const pending = summarizePageInTab(3);
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({
      title: "Recovered"
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  it("retries querySelectorInTab when the main frame is replaced during injection", async () => {
    (chrome.scripting.executeScript as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockRejectedValueOnce(new Error("Frame with ID 0 was removed."))
      .mockResolvedValueOnce([{ result: { found: true } }]);

    const pending = querySelectorInTab(3, "#app");
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({
      found: true
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  it("reads full text from the selected element", async () => {
    vi.stubGlobal("chrome", {
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              text: "complete page text"
            }
          }
        ])
      }
    });

    await expect(textContentInTab(3, "#s-hotsearch-wrapper")).resolves.toEqual({
      found: true,
      text: "complete page text"
    });
  });

  it("reads element position and size from the selected element", async () => {
    vi.stubGlobal("chrome", {
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 30,
                scrollY: 40
              },
              rect: {
                x: 10,
                y: 12,
                top: 12,
                left: 10,
                right: 210,
                bottom: 92,
                width: 200,
                height: 80,
                scrollWidth: 240,
                scrollHeight: 120
              },
              scrollableAncestors: [
                {
                  tag: "div",
                  isRootScroller: false,
                  rect: {
                    x: 0,
                    y: 0,
                    top: 0,
                    left: 0,
                    right: 300,
                    bottom: 200,
                    width: 300,
                    height: 200
                  },
                  scrollLeft: 8,
                  scrollTop: 16,
                  scrollWidth: 600,
                  scrollHeight: 900,
                  clientWidth: 300,
                  clientHeight: 200
                }
              ]
            }
          }
        ])
      }
    });

    await expect(getElementRectInTab(3, "#card")).resolves.toEqual({
      found: true,
      viewport: {
        innerWidth: 1280,
        innerHeight: 720,
        scrollX: 30,
        scrollY: 40
      },
      rect: {
        x: 10,
        y: 12,
        top: 12,
        left: 10,
        right: 210,
        bottom: 92,
        width: 200,
        height: 80,
        scrollWidth: 240,
        scrollHeight: 120
      },
      scrollableAncestors: [
        {
          tag: "div",
          isRootScroller: false,
          rect: {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 300,
            bottom: 200,
            width: 300,
            height: 200
          },
          scrollLeft: 8,
          scrollTop: 16,
          scrollWidth: 600,
          scrollHeight: 900,
          clientWidth: 300,
          clientHeight: 200
        }
      ]
    });
  });

  it("returns page zoom together with click mapping metrics", async () => {
    vi.stubGlobal("chrome", {
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              rect: {
                left: 0,
                top: 0,
                width: 1200,
                height: 800
              },
              window: {
                screenLeft: 100,
                screenTop: 40,
                innerWidth: 1200,
                innerHeight: 800,
                outerWidth: 1216,
                outerHeight: 920,
                devicePixelRatio: 2
              }
            }
          }
        ])
      },
      tabs: {
        getZoom: vi.fn((_tabId: number, callback: (value: number) => void) => {
          callback(1.5);
        })
      }
    });

    await expect(startClickMappingInTab(3)).resolves.toEqual({
      rect: {
        left: 0,
        top: 0,
        width: 1200,
        height: 800
      },
      window: {
        screenLeft: 100,
        screenTop: 40,
        innerWidth: 1200,
        innerHeight: 800,
        outerWidth: 1216,
        outerHeight: 920,
        devicePixelRatio: 2
      },
      zoom: 1.5
    });
  });
});

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
