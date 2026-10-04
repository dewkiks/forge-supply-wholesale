/**
 * b8f Component Selector - In-iframe script for component selection
 */

// @ts-ignore - html2canvas loaded dynamically
declare const html2canvas: any;

(() => {
  const OVERLAY_CLASS = "__b8f_overlay__";
  let overlays: { overlay: HTMLDivElement; label: HTMLDivElement; el: HTMLElement }[] = [];
  let hoverOverlay: HTMLDivElement | null = null;
  let hoverLabel: HTMLDivElement | null = null;
  let currentHoveredElement: HTMLElement | null = null;
  let highlightedElement: HTMLElement | null = null;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  let state: { type: "inactive" } | { type: "inspecting"; element: HTMLElement | null } = { type: "inactive" };

  const css = (el: HTMLElement, obj: Partial<CSSStyleDeclaration>) => Object.assign(el.style, obj);

  function makeOverlay() {
    const overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    css(overlay, {
      position: "absolute",
      border: "2px solid #7f22fe",
      background: "rgba(0,170,255,.05)",
      pointerEvents: "none",
      zIndex: "2147483647",
      borderRadius: "4px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    });

    const label = document.createElement("div");
    css(label, {
      position: "absolute",
      left: "0",
      top: "100%",
      transform: "translateY(4px)",
      background: "#7f22fe",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: "12px",
      lineHeight: "1.2",
      padding: "3px 5px",
      whiteSpace: "nowrap",
      borderRadius: "4px",
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
      pointerEvents: "auto",
    });
    overlay.appendChild(label);
    document.body.appendChild(overlay);
    return { overlay, label };
  }

  function updateOverlay(el: HTMLElement | null, isSelected = false, isHighlighted = false) {
    if (!el) {
      if (hoverOverlay) hoverOverlay.style.display = "none";
      return;
    }

    if (isSelected) {
      if (overlays.some((item) => item.el === el)) return;
      const { overlay, label } = makeOverlay();
      overlays.push({ overlay, label, el });
      const rect = el.getBoundingClientRect();
      const borderColor = isHighlighted ? "#00ff00" : "#7f22fe";
      const backgroundColor = isHighlighted ? "rgba(0, 255, 0, 0.05)" : "rgba(127, 34, 254, 0.05)";
      css(overlay, {
        top: `${rect.top + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        display: "block",
        border: `3px solid ${borderColor}`,
        background: backgroundColor,
      });
      css(label, { display: "none" });
      return;
    }

    if (!hoverOverlay || !hoverLabel) {
      const o = makeOverlay();
      hoverOverlay = o.overlay;
      hoverLabel = o.label;
    }

    const rect = el.getBoundingClientRect();
    css(hoverOverlay, {
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      display: "block",
      border: "2px solid #7f22fe",
      background: "rgba(0,170,255,.05)",
    });
    css(hoverLabel, { background: "#7f22fe" });

    while (hoverLabel.firstChild) hoverLabel.removeChild(hoverLabel.firstChild);

    const name = el.dataset.b8fName || "<unknown>";
    const file = (el.dataset.b8fId || "").split(":")[0];

    const nameEl = document.createElement("div");
    nameEl.textContent = name;
    hoverLabel.appendChild(nameEl);

    if (file) {
      const fileEl = document.createElement("span");
      css(fileEl, { fontSize: "10px", opacity: ".8" });
      fileEl.textContent = file.replace(/\\/g, "/");
      hoverLabel.appendChild(fileEl);
    }

    requestAnimationFrame(updateAllOverlayPositions);
  }

  function updateAllOverlayPositions() {
    overlays.forEach(({ overlay, el }) => {
      const rect = el.getBoundingClientRect();
      css(overlay, {
        top: `${rect.top + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    });

    if (hoverOverlay && hoverOverlay.style.display !== "none" && state.type === "inspecting" && state.element) {
      const rect = state.element.getBoundingClientRect();
      css(hoverOverlay, {
        top: `${rect.top + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }

    // Send updated coordinates for highlighted component
    if (highlightedElement) {
      const highlightedItem = overlays.find(({ el }) => el === highlightedElement);
      if (highlightedItem) {
        const rect = highlightedItem.el.getBoundingClientRect();
        window.parent.postMessage({
          type: "b8f-component-coordinates-updated",
          coordinates: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        }, "*");
      }
    }
  }

  function clearOverlays() {
    overlays.forEach(({ overlay }) => overlay.remove());
    overlays = [];
    if (hoverOverlay) {
      hoverOverlay.remove();
      hoverOverlay = null;
      hoverLabel = null;
    }
    currentHoveredElement = null;
    highlightedElement = null;
  }

  function removeOverlayById(componentId: string) {
    const indicesToRemove: number[] = [];
    overlays.forEach((item, index) => {
      if (item.el.dataset.b8fId === componentId) {
        indicesToRemove.push(index);
      }
    });

    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      const { overlay } = overlays[indicesToRemove[i]];
      overlay.remove();
      overlays.splice(indicesToRemove[i], 1);
    }

    if (highlightedElement && highlightedElement.dataset.b8fId === componentId) {
      highlightedElement = null;
    }
  }

  function onMouseMove(e: MouseEvent) {
    let el = e.target as HTMLElement | null;
    while (el && !el.dataset?.b8fId) el = el.parentElement;
    currentHoveredElement = el;

    if (state.type === "inspecting") {
      if (state.element === el) return;
      state.element = el;
      if (el) {
        updateOverlay(el, false);
      } else if (hoverOverlay) {
        hoverOverlay.style.display = "none";
      }
    }
  }

  function onMouseLeave(e: MouseEvent) {
    if (!e.relatedTarget) {
      if (hoverOverlay) {
        hoverOverlay.style.display = "none";
        requestAnimationFrame(updateAllOverlayPositions);
      }
      currentHoveredElement = null;
      if (state.type === "inspecting") state.element = null;
    }
  }

  // Check if element has only static text content (no nested elements)
  function hasStaticTextContent(el: HTMLElement): boolean {
    // Check if all child nodes are text nodes or whitespace
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        return false; // Has nested elements
      }
    }
    // Has text content and no nested elements
    return el.textContent?.trim().length ? true : false;
  }

  function onDoubleClick(e: MouseEvent) {
    if (state.type !== "inspecting") return;

    let el = e.target as HTMLElement | null;
    while (el && !el.dataset?.b8fId) el = el.parentElement;

    if (!el) return;

    // Only allow text editing if element has static text content
    if (!hasStaticTextContent(el)) return;

    e.preventDefault();
    e.stopPropagation();

    // Generate runtime ID if needed
    if (!el.dataset.b8fRuntimeId) {
      el.dataset.b8fRuntimeId = `b8f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    window.parent.postMessage({
      type: "b8f-component-double-clicked",
      component: {
        id: el.dataset.b8fId,
        name: el.dataset.b8fName,
        runtimeId: el.dataset.b8fRuntimeId,
        index: getB8fIndex(el),
      },
      hasStaticText: true,
    }, "*");
  }

  function onClick(e: MouseEvent) {
    if (state.type !== "inspecting" || !state.element) return;
    e.preventDefault();
    e.stopPropagation();

    const clickedComponentId = state.element.dataset.b8fId || "";
    const clickedElement = state.element;
    const selectedItem = overlays.find((item) => item.el === clickedElement);

    // If clicking on an already selected component, deselect it
    if (selectedItem) {
      if ((state.element as any).contentEditable === "true") {
        return;
      }

      removeOverlayById(clickedComponentId);
      requestAnimationFrame(updateAllOverlayPositions);
      highlightedElement = null;

      window.parent.postMessage({
        type: "b8f-component-deselected",
        componentId: clickedComponentId,
      }, "*");
      return;
    }

    // Update previously highlighted component's overlay
    if (highlightedElement && highlightedElement !== state.element) {
      const previousItem = overlays.find((item) => item.el === highlightedElement);
      if (previousItem) {
        css(previousItem.overlay, {
          border: "3px solid #7f22fe",
          background: "rgba(127, 34, 254, 0.05)",
        });
      }
    }

    highlightedElement = state.element;

    // Create overlay for newly selected element
    updateOverlay(state.element, true, true);
    requestAnimationFrame(updateAllOverlayPositions);

    // Generate a unique runtime ID for this element if it doesn't have one
    if (!state.element.dataset.b8fRuntimeId) {
      state.element.dataset.b8fRuntimeId = `b8f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const rect = state.element.getBoundingClientRect();
    window.parent.postMessage({
      type: "b8f-component-selected",
      component: {
        id: clickedComponentId,
        name: state.element.dataset.b8fName,
        runtimeId: state.element.dataset.b8fRuntimeId,
        index: getB8fIndex(state.element),
      },
      coordinates: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    }, "*");
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

    const key = e.key.toLowerCase();
    if (key === "c" && e.shiftKey && (isMac ? e.metaKey : e.ctrlKey)) {
      e.preventDefault();
      window.parent.postMessage({ type: "b8f-select-component-shortcut" }, "*");
    }
  }

  function activate() {
    if (state.type === "inactive") {
      window.addEventListener("click", onClick, true);
      window.addEventListener("dblclick", onDoubleClick, true);
    }
    state = { type: "inspecting", element: null };
  }

  function deactivate() {
    if (state.type === "inactive") return;
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("dblclick", onDoubleClick, true);
    if (hoverOverlay) hoverOverlay.style.display = "none";
    currentHoveredElement = null;
    state = { type: "inactive" };
  }

  // Load html2canvas dynamically for screenshot functionality
  function loadHtml2Canvas(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof html2canvas !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load html2canvas"));
      document.head.appendChild(script);
    });
  }

  // ============ Visual Editor Handlers ============

  // Track text editing state
  const textEditingState = new Map<string, { originalText: string; currentText: string; cleanup: () => void }>();

  // The tagger assigns data-b8f-id by SOURCE location, so every element rendered
  // from the same JSX (e.g. items in a `.map()`) shares one id. This returns the
  // element's position among its same-id siblings so we can disambiguate them.
  // Unlike the runtime id — which is set imperatively and wiped whenever React
  // remounts the node — the index survives re-renders as long as list order is
  // stable.
  function getB8fIndex(el: HTMLElement): number {
    const id = el.dataset.b8fId;
    if (!id) return 0;
    const all = Array.from(document.querySelectorAll(`[data-b8f-id="${CSS.escape(id)}"]`));
    return all.indexOf(el);
  }

  function findElementByB8fId(b8fId: string, runtimeId?: string, index?: number): HTMLElement | null {
    // 1. Runtime id is the most specific match, but only resolves if the node
    //    was not remounted since selection (the attribute lives outside React).
    if (runtimeId) {
      const byRuntimeId = document.querySelector(`[data-b8f-runtime-id="${CSS.escape(runtimeId)}"]`) as HTMLElement | null;
      if (byRuntimeId) return byRuntimeId;
    }

    const escaped = CSS.escape(b8fId);
    const matches = document.querySelectorAll(`[data-b8f-id="${escaped}"]`);

    // 2. Live reference to the currently highlighted element — covers the case
    //    where the runtime id was lost but the node is still mounted.
    if (
      highlightedElement &&
      highlightedElement.isConnected &&
      highlightedElement.dataset.b8fId === b8fId
    ) {
      return highlightedElement;
    }

    // 3. Disambiguate duplicate ids by index (stable across re-renders). This is
    //    what prevents an edit from landing on the WRONG instance (e.g. the
    //    first list item) when the runtime id has been wiped.
    if (typeof index === "number" && index >= 0 && index < matches.length) {
      return matches[index] as HTMLElement;
    }

    // 4. Last resort: first match.
    return (matches[0] as HTMLElement) || null;
  }

  function applyStyles(element: HTMLElement, styles: any) {
    if (!element || !styles) return;

    const applySpacing = (type: string, values: any) => {
      if (!values) return;
      Object.entries(values).forEach(([side, value]) => {
        const cssProperty = `${type}${side.charAt(0).toUpperCase() + side.slice(1)}` as any;
        (element.style as any)[cssProperty] = value;
      });
    };

    applySpacing("margin", styles.margin);
    applySpacing("padding", styles.padding);

    if (styles.border) {
      if (styles.border.width !== undefined) {
        element.style.borderWidth = styles.border.width;
        element.style.borderStyle = "solid";
      }
      if (styles.border.radius !== undefined) {
        element.style.borderRadius = styles.border.radius;
      }
      if (styles.border.color !== undefined) {
        element.style.borderColor = styles.border.color;
      }
    }

    if (styles.backgroundColor !== undefined) {
      element.style.backgroundColor = styles.backgroundColor;
    }

    if (styles.text) {
      const textProps: Record<string, string> = {
        fontSize: "fontSize",
        fontWeight: "fontWeight",
        fontFamily: "fontFamily",
        color: "color",
      };
      Object.entries(textProps).forEach(([key, cssProp]) => {
        if (styles.text[key] !== undefined) {
          (element.style as any)[cssProp] = styles.text[key];
        }
      });
    }
  }

  function handleGetStyles(data: { elementId: string; runtimeId?: string; index?: number }) {
    console.debug('[b8f] handleGetStyles called', data);
    const { elementId, runtimeId, index } = data;
    const element = findElementByB8fId(elementId, runtimeId, index);
    console.debug('[b8f] Found element:', element);
    if (element) {
      const computedStyle = window.getComputedStyle(element);
      const styles = {
        margin: {
          top: computedStyle.marginTop,
          right: computedStyle.marginRight,
          bottom: computedStyle.marginBottom,
          left: computedStyle.marginLeft,
        },
        padding: {
          top: computedStyle.paddingTop,
          right: computedStyle.paddingRight,
          bottom: computedStyle.paddingBottom,
          left: computedStyle.paddingLeft,
        },
        border: {
          width: computedStyle.borderWidth,
          radius: computedStyle.borderRadius,
          color: computedStyle.borderColor,
        },
        backgroundColor: computedStyle.backgroundColor,
        text: {
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          fontFamily: computedStyle.fontFamily,
          color: computedStyle.color,
        },
      };

      window.parent.postMessage({
        type: "b8f-component-styles",
        data: styles,
      }, "*");
    }
  }

  function handleModifyStyles(data: { elementId: string; runtimeId?: string; index?: number; styles: any }) {
    console.debug('[b8f] handleModifyStyles called', data);
    const { elementId, runtimeId, index, styles } = data;
    const element = findElementByB8fId(elementId, runtimeId, index);
    console.debug('[b8f] Found element for styles:', element, 'styles:', styles);
    if (element) {
      applyStyles(element, styles);
      console.debug('[b8f] Applied styles to element');

      // Send updated coordinates after style change
      const rect = element.getBoundingClientRect();
      window.parent.postMessage({
        type: "b8f-component-coordinates-updated",
        coordinates: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      }, "*");
    }
  }

  function handleEnableTextEditing(data: { componentId: string; runtimeId?: string; index?: number }) {
    const { componentId, runtimeId, index } = data;

    // Clean up any existing text editing states first
    textEditingState.forEach((state, existingId) => {
      if (existingId !== componentId) {
        state.cleanup();
      }
    });

    const element = findElementByB8fId(componentId, runtimeId, index);
    if (element) {
      const originalText = element.innerText;

      element.contentEditable = "true";
      element.focus();

      // Select all text
      const range = document.createRange();
      range.selectNodeContents(element);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      // Send updates as user types
      const onInput = () => {
        const currentText = element.innerText;
        const state = textEditingState.get(componentId);
        if (state) {
          state.currentText = currentText;
        }

        window.parent.postMessage({
          type: "b8f-text-updated",
          componentId,
          text: currentText,
        }, "*");
      };

      element.addEventListener("input", onInput);

      // Prevent click from propagating to selector while editing
      const stopProp = (e: Event) => e.stopPropagation();
      element.addEventListener("click", stopProp);

      // Cleanup function
      const cleanup = () => {
        element.contentEditable = "false";
        element.removeEventListener("input", onInput);
        element.removeEventListener("click", stopProp);

        // Send final text update
        const finalText = element.innerText;
        window.parent.postMessage({
          type: "b8f-text-finalized",
          componentId,
          text: finalText,
        }, "*");

        textEditingState.delete(componentId);
      };

      // Store state
      textEditingState.set(componentId, {
        originalText,
        currentText: originalText,
        cleanup,
      });
    }
  }

  function handleDisableTextEditing(data: { componentId: string }) {
    const { componentId } = data;
    const state = textEditingState.get(componentId);
    if (state) {
      state.cleanup();
    }
  }

  function handleGetTextContent(data: { componentId: string; runtimeId?: string; index?: number }) {
    const { componentId, runtimeId, index } = data;
    const element = findElementByB8fId(componentId, runtimeId, index);
    const state = textEditingState.get(componentId);

    window.parent.postMessage({
      type: "b8f-text-content-response",
      componentId,
      text: state ? state.currentText : element ? element.innerText : null,
      isEditing: !!state,
    }, "*");
  }

  // ============ Screenshot ============

  // Take screenshot of the document body
  async function takeScreenshot() {
    try {
      await loadHtml2Canvas();

      // Hide overlays before screenshot
      overlays.forEach(({ overlay }) => {
        overlay.style.display = "none";
      });
      if (hoverOverlay) {
        hoverOverlay.style.display = "none";
      }

      // Use the LAYOUT viewport (clientWidth/clientHeight) — not innerWidth/
      // innerHeight, which include the scrollbar. Handing html2canvas a window
      // that's wider than the real layout makes it re-flow the cloned document
      // at that wider width, which shifts centered / right-aligned elements
      // (buttons, labels) sideways in the capture. clientWidth matches what the
      // page actually laid out at, so components land exactly where the user
      // sees them.
      const docEl = document.documentElement;
      const viewportWidth = docEl.clientWidth;
      const viewportHeight = docEl.clientHeight;

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#09090b", // Prevent transparency glitches
        scale: 1, // Use scale 1 for consistent coordinates with annotator
        windowWidth: viewportWidth,
        windowHeight: viewportHeight,
        width: viewportWidth,
        height: viewportHeight,
        x: window.scrollX,
        y: window.scrollY,
      });

      // Restore overlays
      overlays.forEach(({ overlay }) => {
        overlay.style.display = "block";
      });

      const dataUrl = canvas.toDataURL("image/png");
      window.parent.postMessage({
        type: "b8f-screenshot-response",
        dataUrl,
      }, "*");
    } catch (error) {
      console.error("Screenshot failed:", error);
      window.parent.postMessage({
        type: "b8f-screenshot-error",
        error: String(error),
      }, "*");
    }
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    console.debug('[b8f] Received message:', e.data.type, e.data);
    switch (e.data.type) {
      case "activate-b8f-component-selector":
        activate();
        break;
      case "deactivate-b8f-component-selector":
        deactivate();
        break;
      case "clear-b8f-component-overlays":
        clearOverlays();
        break;
      case "update-b8f-overlay-positions":
        updateAllOverlayPositions();
        break;
      case "remove-b8f-component-overlay":
      case "deselect-b8f-component":
        if (e.data.componentId) removeOverlayById(e.data.componentId);
        break;
      case "b8f-take-screenshot":
        takeScreenshot();
        break;
      // Visual Editor handlers
      case "get-b8f-component-styles":
        handleGetStyles(e.data.data);
        break;
      case "modify-b8f-component-styles":
        handleModifyStyles(e.data.data);
        break;
      case "enable-b8f-text-editing":
        handleEnableTextEditing(e.data.data);
        break;
      case "disable-b8f-text-editing":
        handleDisableTextEditing(e.data.data);
        break;
      case "get-b8f-text-content":
        handleGetTextContent(e.data.data);
        break;
      case "cleanup-all-text-editing":
        textEditingState.forEach((state) => state.cleanup());
        break;
    }
  });

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mouseleave", onMouseLeave, true);
  window.addEventListener("resize", updateAllOverlayPositions);
  window.addEventListener("scroll", updateAllOverlayPositions, true);

  function initializeComponentSelector() {
    if (!document.body) return;

    // Check if running in iframe (needed for component selection)
    const isInIframe = window.parent !== window;
    if (!isInIframe) {
      console.debug("b8F component selector: not in iframe, skipping initialization");
      return;
    }

    // Retry initialization with backoff to handle race conditions
    // Components may not be rendered yet, or parent listener may not be ready
    let attempts = 0;
    const maxAttempts = 5;

    const tryInit = () => {
      attempts++;
      if (document.body.querySelector("[data-b8f-id]")) {
        window.parent.postMessage({ type: "b8f-component-selector-initialized" }, "*");
        console.debug("b8F component selector initialized");
      } else if (attempts < maxAttempts) {
        // Components may not be rendered yet, retry with increasing delay
        setTimeout(tryInit, 100 * attempts);
      } else {
        console.debug("b8F component selector: no instrumented components found after retries");
      }
    };

    // Start after a small delay to let parent set up message listener
    setTimeout(tryInit, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeComponentSelector);
  } else {
    initializeComponentSelector();
  }
})();
