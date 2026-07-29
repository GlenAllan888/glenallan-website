

var RWElements={};

RWElements.rw7CA6A693_A0FF_453C_BB92_DF169FB802D0 = {};
RWElements.rw7CA6A693_A0FF_453C_BB92_DF169FB802D0 = (function(componentId) {
    
(() => {
  "use strict";

  let navigationInstanceCount = 0;

  const CONFIG = {
    nodes: {
      video: {
        routeId: "node-1_video",
        url: "/video/",
        label: "Video"
      },
      design: {
        routeId: "node-2_design",
        url: "/design/",
        label: "Design"
      },
      audio: {
        routeId: "node-3_audio",
        url: "/audio/",
        label: "Audio"
      },
      ai: {
        routeId: "node-4_ai",
        url: "/ai/",
        label: "AI"
      },
      context: {
        routeId: "node-5_context",
        url: "/context/",
        label: "Context"
      },
      resume: {
        routeId: "node-6_resume",
        url: "/resume/",
        label: "Resume"
      }
    },

    /* Slightly enlarges each visible circular node into a forgiving hit area. */
    nodeHitScale: 1.18,

    /* The center target is derived from the Chaos Eye bounding box. */
    centerHitScale: 0.92,

    /*
     * Prevents the interface from immediately collapsing while the pointer
     * moves through the space between desktop nodes.
     */
    desktopResetDelay: 1000,

    /*
     * CSS drop-shadow blur values and SVG Gaussian standard deviation are not
     * numerically identical. This translates the CSS values into SVG values.
     */
    svgBlurScale: 0.5
  };

  function initChaosNavigation(root) {
    if (!root || root.dataset.chaosReady === "true") return;

    const svg = root.querySelector("svg");

    if (!svg) {
      console.warn("Chaos navigation: inline SVG was not found.");
      return;
    }

    root.dataset.chaosReady = "true";

    const instanceNumber = ++navigationInstanceCount;
    const filterId =
      `chaos-active-route-filter-${instanceNumber}`;

    const finePointerQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    );

    const mobileQuery = window.matchMedia(
      "(max-width: 767px)"
    );

    let activeNode = null;
    let keyboardNode = null;
    let resetTimer = null;
    let centerHitTarget = null;

    const nodeRecords = new Map();

    function getElement(id) {
      return svg.querySelector(`#${CSS.escape(id)}`);
    }

    function requireElement(id) {
      const element = getElement(id);

      if (!element) {
        console.warn(
          `Chaos navigation: missing SVG element #${id}`
        );
      }

      return element;
    }

    function createSvgElement(name) {
      return document.createElementNS(
        "http://www.w3.org/2000/svg",
        name
      );
    }

    function makeSvgCircle(className) {
      const circle = createSvgElement("circle");
      circle.setAttribute("class", className);
      return circle;
    }

    function readCssNumber(propertyName, fallback) {
      const styles = getComputedStyle(root);
      const value = parseFloat(
        styles.getPropertyValue(propertyName)
      );

      return Number.isFinite(value) ? value : fallback;
    }

    function readCssColor(propertyName, fallback) {
      const styles = getComputedStyle(root);
      const value = styles
        .getPropertyValue(propertyName)
        .trim();

      return value || fallback;
    }

    function createDropShadow({
      input,
      result,
      blur,
      color
    }) {
      const shadow = createSvgElement("feDropShadow");

      shadow.setAttribute("in", input);
      shadow.setAttribute("dx", "0");
      shadow.setAttribute("dy", "0");
      shadow.setAttribute("stdDeviation", String(blur));
      shadow.setAttribute("flood-color", color);
      shadow.setAttribute("flood-opacity", "1");
      shadow.setAttribute("result", result);

      return shadow;
    }

    function installNativeRouteFilter() {
      let defs = svg.querySelector("defs");

      if (!defs) {
        defs = createSvgElement("defs");
        svg.insertBefore(defs, svg.firstChild);
      }

      const filter = createSvgElement("filter");

      filter.setAttribute("id", filterId);

      /*
       * Expanded filter region prevents the outer glow from being clipped.
       */
      filter.setAttribute("x", "-100%");
      filter.setAttribute("y", "-100%");
      filter.setAttribute("width", "300%");
      filter.setAttribute("height", "300%");
      filter.setAttribute(
        "color-interpolation-filters",
        "sRGB"
      );

      defs.appendChild(filter);

      /*
       * Apply the native SVG filter directly to every route.
       * Inactive routes remain hidden through opacity.
       */
      for (const record of nodeRecords.values()) {
        record.route?.setAttribute(
          "filter",
          `url(#${filterId})`
        );
      }

      return filter;
    }

    function syncNativeRouteFilter(filter) {
      const scale = CONFIG.svgBlurScale;

      const edgeColor = readCssColor(
        "--chaos-edge-color",
        "rgb(0 0 0 / 1)"
      );

      const glowColor = readCssColor(
        "--chaos-glow-color",
        "rgb(9, 133, 0)"
      );

      const edgeNear =
        readCssNumber("--chaos-edge-near", 6) * scale;

      const edgeFar =
        readCssNumber("--chaos-edge-far", 13) * scale;

      const glowNear =
        readCssNumber("--chaos-glow-near", 2) * scale;

      const glowMid =
        readCssNumber("--chaos-glow-mid", 5) * scale;

      const glowFar =
        readCssNumber("--chaos-glow-far", 7) * scale;

      /*
       * Rebuild the filter chain from the current CSS variables.
       *
       * Each stage receives the accumulated output of the previous stage,
       * closely following the behavior of chained CSS drop-shadow filters.
       */
      filter.replaceChildren(
        createDropShadow({
          input: "SourceGraphic",
          result: "chaos-edge-near",
          blur: edgeNear,
          color: edgeColor
        }),

        createDropShadow({
          input: "chaos-edge-near",
          result: "chaos-edge-far",
          blur: edgeFar,
          color: edgeColor
        }),

        createDropShadow({
          input: "chaos-edge-far",
          result: "chaos-glow-near",
          blur: glowNear,
          color: glowColor
        }),

        createDropShadow({
          input: "chaos-glow-near",
          result: "chaos-glow-mid",
          blur: glowMid,
          color: glowColor
        }),

        createDropShadow({
          input: "chaos-glow-mid",
          result: "chaos-glow-far",
          blur: glowFar,
          color: glowColor
        })
      );
    }

    function cancelScheduledReset() {
      if (resetTimer === null) return;

      window.clearTimeout(resetTimer);
      resetTimer = null;
    }

    function scheduleNavigationReset() {
      cancelScheduledReset();

      resetTimer = window.setTimeout(() => {
        resetTimer = null;

        if (keyboardNode === null) {
          resetNavigation();
        }
      }, CONFIG.desktopResetDelay);
    }

    const chaosEye = requireElement("chaos-eye");
    const chaosTendrils = requireElement("chaos-tendrils");

    if (chaosEye) {
      chaosEye.classList.add("chaos-default-center");
    }

    if (chaosTendrils) {
      chaosTendrils.classList.add("chaos-passive-field");
    }

    for (const [name, config] of Object.entries(CONFIG.nodes)) {
      const record = {
        name,
        config,
        route: requireElement(config.routeId),
        center: requireElement(`${name}_center`),
        normal: requireElement(`${name}_node`),
        normalBackground: requireElement(
          `${name}_node_background`
        ),
        inverted: requireElement(
          `${name}_node-invert`
        ),
        invertedBackground: requireElement(
          `${name}_node-invert_background`
        ),
        hitTarget: null
      };

      record.route?.classList.add("chaos-route");
      record.center?.classList.add("chaos-center");
      record.normal?.classList.add("chaos-node-normal");

      record.normalBackground?.classList.add(
        "chaos-node-normal-background"
      );

      record.inverted?.classList.add(
        "chaos-node-inverted"
      );

      record.invertedBackground?.classList.add(
        "chaos-node-inverted-background"
      );

      nodeRecords.set(name, record);
    }

    /*
     * Install the SVG-native route filter after all route elements
     * have been identified.
     */
    const nativeRouteFilter = installNativeRouteFilter();
    syncNativeRouteFilter(nativeRouteFilter);

    function clearStateClasses() {
      for (const record of nodeRecords.values()) {
        record.route?.classList.remove("is-active");
        record.center?.classList.remove("is-active");
        record.normal?.classList.remove("is-selected");

        record.normalBackground?.classList.remove(
          "is-selected"
        );

        record.inverted?.classList.remove("is-selected");

        record.invertedBackground?.classList.remove(
          "is-selected"
        );
      }
    }

    function setActiveNode(name) {
      if (!nodeRecords.has(name)) return;

      cancelScheduledReset();

      activeNode = name;

      root.classList.add("is-engaged");
      root.dataset.activeNode = name;

      clearStateClasses();

      const record = nodeRecords.get(name);

      record.route?.classList.add("is-active");
      record.center?.classList.add("is-active");
      record.normal?.classList.add("is-selected");

      record.normalBackground?.classList.add(
        "is-selected"
      );

      record.inverted?.classList.add("is-selected");

      record.invertedBackground?.classList.add(
        "is-selected"
      );

      centerHitTarget?.setAttribute(
        "aria-label",
        `Open ${record.config.label}`
      );
    }

    function resetNavigation() {
      cancelScheduledReset();

      activeNode = null;

      root.classList.remove("is-engaged");
      root.removeAttribute("data-active-node");

      clearStateClasses();

      centerHitTarget?.setAttribute(
        "aria-label",
        "Chaos System navigation center"
      );
    }

    function navigateTo(name) {
      const record = nodeRecords.get(name);

      if (!record) return;

      window.location.assign(record.config.url);
    }

    /*
     * Create explicit interaction circles above all artwork. This keeps
     * pointer behavior stable while visible layers crossfade underneath.
     */
    for (const record of nodeRecords.values()) {
      const source =
        record.normalBackground ||
        record.invertedBackground ||
        record.normal;

      if (
        !source ||
        typeof source.getBBox !== "function"
      ) {
        continue;
      }

      const box = source.getBBox();

      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      const radius =
        Math.max(box.width, box.height) /
        2 *
        CONFIG.nodeHitScale;

      const hit = makeSvgCircle(
        "chaos-hit-target chaos-node-hit-target"
      );

      hit.setAttribute("cx", String(cx));
      hit.setAttribute("cy", String(cy));
      hit.setAttribute("r", String(radius));
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("role", "link");
      hit.setAttribute(
        "aria-label",
        `Open ${record.config.label}`
      );

      hit.dataset.chaosNode = record.name;

      svg.appendChild(hit);
      record.hitTarget = hit;

      hit.addEventListener("pointerenter", event => {
        if (
          finePointerQuery.matches &&
          event.pointerType !== "touch"
        ) {
          cancelScheduledReset();
          setActiveNode(record.name);
        }
      });

      hit.addEventListener("pointerleave", event => {
        if (
          finePointerQuery.matches &&
          event.pointerType !== "touch" &&
          keyboardNode === null
        ) {
          scheduleNavigationReset();
        }
      });

      hit.addEventListener("click", event => {
        if (
          finePointerQuery.matches &&
          event.detail !== 0
        ) {
          navigateTo(record.name);
        }
      });

      hit.addEventListener("pointerup", event => {
        if (event.pointerType === "touch") {
          event.preventDefault();
          setActiveNode(record.name);
        }
      });

      hit.addEventListener("focus", () => {
        cancelScheduledReset();
        keyboardNode = record.name;
        setActiveNode(record.name);
      });

      hit.addEventListener("blur", () => {
        keyboardNode = null;

        window.requestAnimationFrame(() => {
          if (!root.contains(document.activeElement)) {
            resetNavigation();
          }
        });
      });

      hit.addEventListener("keydown", event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          navigateTo(record.name);
        }

        if (event.key === "Escape") {
          event.preventDefault();
          resetNavigation();
          hit.blur();
        }
      });
    }

    /*
     * The selected expanded artwork is the confirmation/navigation target
     * on touch devices. Its geometry is based on the Chaos Eye bounds.
     */
    if (
      chaosEye &&
      typeof chaosEye.getBBox === "function"
    ) {
      const box = chaosEye.getBBox();

      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      const radius =
        Math.min(box.width, box.height) /
        2 *
        CONFIG.centerHitScale;

      centerHitTarget = makeSvgCircle(
        "chaos-hit-target chaos-center-hit-target"
      );

      centerHitTarget.setAttribute("cx", String(cx));
      centerHitTarget.setAttribute("cy", String(cy));
      centerHitTarget.setAttribute("r", String(radius));
      centerHitTarget.setAttribute("role", "link");

      centerHitTarget.setAttribute(
        "aria-label",
        "Chaos System navigation center"
      );

      svg.appendChild(centerHitTarget);

      centerHitTarget.addEventListener(
        "click",
        event => {
          if (
            activeNode &&
            finePointerQuery.matches &&
            event.detail !== 0
          ) {
            navigateTo(activeNode);
          }
        }
      );

      centerHitTarget.addEventListener(
        "pointerup",
        event => {
          if (
            event.pointerType === "touch" &&
            activeNode
          ) {
            event.preventDefault();
            navigateTo(activeNode);
          }
        }
      );
    }

    /*
     * Entering the overall component cancels a reset that may have been
     * scheduled while crossing the space between interaction targets.
     */
    root.addEventListener("pointerenter", event => {
      if (
        finePointerQuery.matches &&
        event.pointerType !== "touch"
      ) {
        cancelScheduledReset();
      }
    });

    /*
     * Leaving the complete component schedules the same delayed reset.
     */
    root.addEventListener("pointerleave", event => {
      if (
        finePointerQuery.matches &&
        event.pointerType !== "touch" &&
        keyboardNode === null
      ) {
        scheduleNavigationReset();
      }
    });

    /* A touch on blank SVG space resets the held selection. */
    svg.addEventListener("pointerup", event => {
      if (event.pointerType !== "touch") return;

      const hitTarget = event.target.closest?.(
        ".chaos-hit-target"
      );

      if (!hitTarget) {
        resetNavigation();
      }
    });

    /*
     * A pointer interaction outside the component resets the held selection.
     * This provides a consistent escape path for both touch and desktop.
     */
    document.addEventListener(
      "pointerdown",
      event => {
        if (
          activeNode &&
          !root.contains(event.target)
        ) {
          resetNavigation();
        }
      },
      { passive: true }
    );

    document.addEventListener("keydown", event => {
      if (
        event.key === "Escape" &&
        activeNode
      ) {
        resetNavigation();
      }
    });

    /*
     * Reset mouse-hover state if the device changes input mode.
     */
    finePointerQuery.addEventListener?.(
      "change",
      () => {
        if (keyboardNode === null) {
          resetNavigation();
        }
      }
    );

    /*
     * Re-read the CSS variables when the responsive breakpoint changes.
     * This keeps the SVG-native filter synchronized with mobile CSS values.
     */
    const syncResponsiveFilter = () => {
      syncNativeRouteFilter(nativeRouteFilter);
    };

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener(
        "change",
        syncResponsiveFilter
      );
    } else {
      mobileQuery.addListener(syncResponsiveFilter);
    }

    resetNavigation();
  }

  async function loadAndInitChaosNavigation(root) {
    if (
      !root ||
      root.dataset.chaosLoadStarted === "true"
    ) {
      return;
    }

    root.dataset.chaosLoadStarted = "true";

    const svgUrl = root.dataset.chaosSvgUrl;

    if (!svgUrl) {
      console.error(
        "Chaos navigation: data-chaos-svg-url is missing."
      );
      return;
    }

    try {
      const response = await fetch(svgUrl, {
        credentials: "same-origin",
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `SVG request failed: HTTP ${response.status} ${response.statusText}`
        );
      }

      const svgText = await response.text();

      if (!svgText.includes("<svg")) {
        throw new Error(
          "The resource loaded, but it did not contain SVG markup."
        );
      }

      root.innerHTML = svgText;

      const svg = root.querySelector("svg");

      if (!svg) {
        throw new Error(
          "SVG text loaded, but the browser did not create an SVG element."
        );
      }

      /*
       * Remove exported fixed dimensions so CSS controls sizing.
       * The viewBox remains, preserving the square aspect ratio.
       */
        svg.removeAttribute("width");
        svg.removeAttribute("height");

        svg.setAttribute(
          "preserveAspectRatio",
          "xMidYMid meet"
);

      initChaosNavigation(root);

      console.info(
        "Chaos navigation: SVG loaded and initialized successfully."
      );
    } catch (error) {
      root.dataset.chaosLoadError = "true";

      console.error(
        "Chaos navigation failed to load:",
        error
      );

      root.innerHTML = `
        <div style="
          color: white;
          background: rgba(255, 0, 0, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.35);
          padding: 1rem;
          line-height: 1.4;
          font-family: system-ui, sans-serif;
        ">
          Chaos navigation SVG failed to load.
          Check the browser console.
        </div>
      `;
    }
  }

  function initAllChaosNavigation() {
    document
      .querySelectorAll("[data-chaos-navigation]")
      .forEach(loadAndInitChaosNavigation);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initAllChaosNavigation,
      { once: true }
    );
  } else {
    initAllChaosNavigation();
  }
})();

return componentId;})(RWElements.rw7CA6A693_A0FF_453C_BB92_DF169FB802D0);