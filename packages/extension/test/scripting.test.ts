import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finishClickObservationAction,
  finishClickObservationInTab,
  getElementRectInTab,
  inspectDom,
  observeClickAction,
  observeClickInTab,
  querySelectorInTab,
  searchElementsFromPointInTab,
  searchTextInTab,
  startClickObservationInTab,
  startClickObservationAction,
  startClickMappingInTab,
  summarizePageInTab,
  textContentInTab
} from "../src/adapters/scripting.js";
import { buildFallbackObservation } from "../src/adapters/scripting/click-observation-helpers.js";

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

  it("returns the full hit stack for searchFromPoint mode", () => {
    document.body.innerHTML = `
      <div id="app">
        <button id="search-button" aria-label="Search now">Search now</button>
      </div>
    `;

    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => {
        const button = document.getElementById("search-button");
        const app = document.getElementById("app");
        return [button, app].filter(Boolean);
      })
    });

    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = originalGetComputedStyle(element);
      if ((element as HTMLElement).id === "search-button") {
        return {
          ...style,
          zIndex: "10",
          pointerEvents: "auto",
          display: "block",
          visibility: "visible"
        };
      }

      return style;
    });

    const result = inspectDom({
      mode: "searchFromPoint",
      x: 120,
      y: 84
    });

    expect(result).toMatchObject({
      found: true,
      x: 120,
      y: 84,
      matches: [
        {
          level: 0,
          selector: "#search-button",
          tag: "button",
          text: "Search now",
          attrs: {
            id: "search-button",
            "aria-label": "Search now"
          },
          visible: true,
          rect: {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 100,
            bottom: 24,
            width: 100,
            height: 24,
            scrollWidth: 0,
            scrollHeight: 0
          },
          styles: {
            zIndex: "10",
            pointerEvents: "auto",
            display: "block",
            visibility: "visible"
          }
        },
        {
          level: 1,
          selector: "#app",
          tag: "div",
          visible: true
        }
      ]
    });
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

  it("finds visible semantic nodes whose text contains the search text", () => {
    document.body.innerHTML = `
      <section id="container">
        <button id="search-button"><span>Search now</span></button>
        <p id="subtitle">Search now and discover more</p>
        <input id="search-input" placeholder="Search keyword" />
      </section>
    `;

    const result = inspectDom({
      mode: "search",
      text: "search"
    }) as {
      found: boolean;
      matches: Array<{
        selector: string;
        tag: string;
        text?: string;
        attrs?: Record<string, string>;
        state?: {
          clickable?: boolean;
          editable?: boolean;
        };
        visible: boolean;
      }>;
      meta: {
        query: string;
        limit: number;
        totalMatches: number;
        truncated: boolean;
      };
    };

    expect(result.found).toBe(true);
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selector: "#search-button",
          tag: "button",
          text: "Search now",
          state: expect.objectContaining({
            clickable: true
          }),
          visible: true
        }),
        expect.objectContaining({
          selector: "#subtitle",
          tag: "p",
          text: "Search now and discover more",
          visible: true
        }),
        expect.objectContaining({
          selector: "#search-input",
          tag: "input",
          attrs: expect.objectContaining({
            placeholder: "Search keyword"
          }),
          state: expect.objectContaining({
            clickable: true,
            editable: true
          }),
          visible: true
        })
      ])
    );
    expect(result.matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selector: "#container"
        })
      ])
    );
    expect(result.meta).toEqual({
      query: "search",
      limit: 20,
      totalMatches: 3,
      truncated: false
    });
  });

  it("returns an empty search result when no node contains the search text", () => {
    document.body.innerHTML = `<main id="content">Hello</main>`;

    const result = inspectDom({
      mode: "search",
      text: "missing"
    });

    expect(result).toEqual({
      found: false,
      matches: [],
      meta: {
        query: "missing",
        limit: 20,
        totalMatches: 0,
        truncated: false
      }
    });
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

describe("click observation helpers", () => {
  it("builds a fallback observation without window", () => {
    const originalWindow = globalThis.window;
    // Simulate extension background/service worker context.
    Reflect.deleteProperty(globalThis, "window");

    try {
      expect(buildFallbackObservation()).toEqual({
        primaryEffect: "no-visible-change",
        regions: [],
        navigation: {
          from: "",
          to: "",
          changed: false
        },
        meta: {
          debugSource: "extension-fallback",
          durationMs: 0,
          endedBy: "no-change",
          networkEvents: 0,
          meaningfulMutations: 0
        }
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow
      });
    }
  });
});

describe("script execution retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();

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

  it("retries finishClickObservationInTab when the main frame is replaced during injection", async () => {
    (chrome.scripting.executeScript as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockRejectedValueOnce(new Error("Frame with ID 0 was removed."))
      .mockResolvedValueOnce([
        {
          result: {
            tabId: 3,
            observation: {
              primaryEffect: "content-update",
              regions: [
                {
                  key: "#menu",
                  locator: {
                    preferred: "#menu"
                  },
                  confidence: 1,
                  reasons: ["mutation-observed"],
                  changedNodes: []
                }
              ],
              navigation: {
                from: "https://example.com",
                to: "https://example.com",
                changed: false
              },
              meta: {
                durationMs: 120,
                endedBy: "stabilized",
                networkEvents: 1,
                meaningfulMutations: 2
              }
            }
          }
        }
      ]);

    const pending = finishClickObservationInTab(3, {
      awaitStability: true
    });
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({
      observation: {
        primaryEffect: "content-update",
        regions: [
          expect.objectContaining({
            key: "#menu"
          })
        ]
      }
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  it("retries finishClickObservationInTab when injection returns no result", async () => {
    (chrome.scripting.executeScript as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          result: {
            tabId: 3,
            observation: {
              primaryEffect: "content-update",
              regions: [
                {
                  key: "#menu",
                  locator: {
                    preferred: "#menu"
                  },
                  confidence: 1,
                  reasons: ["mutation-observed"],
                  changedNodes: []
                }
              ],
              navigation: {
                from: "https://example.com",
                to: "https://example.com",
                changed: false
              },
              meta: {
                durationMs: 120,
                endedBy: "stabilized",
                networkEvents: 1,
                meaningfulMutations: 2
              }
            }
          }
        }
      ]);

    const result = await finishClickObservationInTab(3, {
      awaitStability: true
    });

    expect(result).toMatchObject({
      observation: {
        primaryEffect: "content-update",
        regions: [
          expect.objectContaining({
            key: "#menu"
          })
        ]
      }
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  it("runs clickObserve injection code without relying on module closure state", async () => {
    vi.stubGlobal("chrome", {
      scripting: {
        executeScript: vi.fn(async ({ func, args }: { func: (...input: unknown[]) => unknown; args: unknown[] }) => {
          const isolated = window.eval(`(${func.toString()})`) as (...input: unknown[]) => unknown;
          return [{ result: await isolated(...args) }];
        })
      }
    });

    document.body.innerHTML = `
      <button id="trigger" aria-expanded="false">Open</button>
      <div id="host"></div>
    `;

    const trigger = document.querySelector("#trigger") as HTMLButtonElement;
    const host = document.querySelector("#host") as HTMLDivElement;

    trigger.addEventListener("click", () => {
      trigger.setAttribute("aria-expanded", "true");
      host.innerHTML = `
        <div id="menu" role="listbox">
          <button id="first-option">First</button>
        </div>
      `;
    });

    await expect(
      startClickObservationInTab(3, {
        selector: "#trigger",
        tabId: 3
      })
    ).resolves.toEqual({
      started: true,
      tabId: 3
    });

    trigger.click();
    await Promise.resolve();
    await Promise.resolve();

    await expect(
      finishClickObservationInTab(3, {
        tabId: 3,
        awaitStability: false
      })
    ).resolves.toMatchObject({
      tabId: 3,
      observation: {
        regions: expect.arrayContaining([
          expect.objectContaining({
            locator: expect.objectContaining({
              preferred: "#menu"
            })
          })
        ])
      }
    });

    await expect(
      observeClickInTab(3, {
        selector: "#trigger",
        observe: {
          minObserveMs: 0,
          stableWindowMs: 0,
          maxObserveMs: 50
        }
      })
    ).resolves.toMatchObject({
      clicked: true,
      tabId: 3
    });
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

  it("reads matching nodes from the page by text", async () => {
    vi.stubGlobal("chrome", {
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              found: true,
              matches: [
                {
                  selector: "#search-button",
                  tag: "button",
                  text: "Search now",
                  visible: true
                }
              ],
              meta: {
                query: "Search",
                limit: 20,
                totalMatches: 1,
                truncated: false
              }
            }
          }
        ])
      }
    });

    await expect(searchTextInTab(3, "Search")).resolves.toEqual({
      found: true,
      matches: [
        {
          selector: "#search-button",
          tag: "button",
          text: "Search now",
          visible: true
        }
      ],
      meta: {
        query: "Search",
        limit: 20,
        totalMatches: 1,
        truncated: false
      }
    });
  });

  it("reads the full hit stack from a page coordinate", async () => {
    vi.stubGlobal("chrome", {
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              found: true,
              x: 120,
              y: 84,
              matches: [
                {
                  level: 0,
                  selector: "#search-button",
                  tag: "button",
                  text: "Search now",
                  visible: true,
                  rect: {
                    x: 100,
                    y: 60,
                    top: 60,
                    left: 100,
                    right: 180,
                    bottom: 92,
                    width: 80,
                    height: 32,
                    scrollWidth: 80,
                    scrollHeight: 32
                  }
                }
              ]
            }
          }
        ])
      }
    });

    await expect(searchElementsFromPointInTab(3, 120, 84)).resolves.toEqual({
      found: true,
      x: 120,
      y: 84,
      matches: [
        {
          level: 0,
          selector: "#search-button",
          tag: "button",
          text: "Search now",
          visible: true,
          rect: {
            x: 100,
            y: 60,
            top: 60,
            left: 100,
            right: 180,
            bottom: 92,
            width: 80,
            height: 32,
            scrollWidth: 80,
            scrollHeight: 32
          }
        }
      ]
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

  it("observes post-click meaningful changes until the page stabilizes", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <button id="trigger" aria-expanded="false">Open</button>
      <div id="host"></div>
    `;

    const trigger = document.querySelector("#trigger") as HTMLButtonElement;
    const host = document.querySelector("#host") as HTMLDivElement;

    trigger.addEventListener("click", () => {
      trigger.setAttribute("aria-expanded", "true");

      window.setTimeout(() => {
        host.innerHTML = `
          <div id="menu" role="listbox">
            <button id="first-option">First</button>
            <button id="second-option">Second</button>
          </div>
        `;
      }, 50);
    });

    const pending = observeClickAction({
      selector: "#trigger",
      observe: {
        minObserveMs: 20,
        stableWindowMs: 40,
        maxObserveMs: 500
      }
    });

    await vi.advanceTimersByTimeAsync(160);
    const result = await pending;

    expect(result.clicked).toBe(true);
    expect(result.observation.primaryEffect).toBe("overlay");
    expect(result.observation.meta.endedBy).toBe("stabilized");
    expect(result.observation.meta.meaningfulMutations).toBeGreaterThan(0);
    expect(result.observation.regions).toHaveLength(4);
    expect(result.observation.regions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "listbox",
          locator: expect.objectContaining({
            preferred: "#menu"
          }),
          changedNodes: [
            expect.objectContaining({
              change: "added",
              after: expect.objectContaining({
                locator: expect.objectContaining({
                  preferred: "#menu"
                })
              })
            })
          ]
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#first-option"
          }),
          changedNodes: [
            expect.objectContaining({
              change: "added"
            })
          ]
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#second-option"
          }),
          changedNodes: [
            expect.objectContaining({
              change: "added"
            })
          ]
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#trigger"
          }),
          changedNodes: [
            expect.objectContaining({
              change: "state-updated"
            })
          ]
        })
      ])
    );
    expect(result.observation.regions.every((region) => !("tree" in region))).toBe(true);

    vi.useRealTimers();
  });

  it("observes post-click meaningful changes across start and finish phases", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <button id="trigger" aria-expanded="false">Open</button>
      <div id="host"></div>
    `;

    const trigger = document.querySelector("#trigger") as HTMLButtonElement;
    const host = document.querySelector("#host") as HTMLDivElement;

    trigger.addEventListener("click", () => {
      trigger.setAttribute("aria-expanded", "true");

      window.setTimeout(() => {
        host.innerHTML = `
          <div id="menu" role="listbox">
            <button id="first-option">First</button>
            <button id="second-option">Second</button>
          </div>
        `;
      }, 50);
    });

    expect(
      startClickObservationAction({
        selector: "#trigger",
        observe: {
          minObserveMs: 20,
          stableWindowMs: 40,
          maxObserveMs: 500
        }
      })
    ).toEqual({
      started: true,
      tabId: 0
    });

    trigger.click();

    const pending = finishClickObservationAction({
      awaitStability: true,
      observe: {
        minObserveMs: 20,
        stableWindowMs: 40,
        maxObserveMs: 500
      }
    });

    await vi.advanceTimersByTimeAsync(160);
    const result = await pending;

    expect(result.observation.primaryEffect).toBe("overlay");
    expect(result.observation.meta.endedBy).toBe("stabilized");
    expect(result.observation.meta.meaningfulMutations).toBeGreaterThan(0);
    expect(result.observation.regions).toHaveLength(4);
    expect(result.observation.regions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#menu"
          })
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#first-option"
          })
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#second-option"
          })
        }),
        expect.objectContaining({
          locator: expect.objectContaining({
            preferred: "#trigger"
          })
        })
      ])
    );

    vi.useRealTimers();
  });
});

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
