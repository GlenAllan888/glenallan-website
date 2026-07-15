

var RWElements={};

RWElements.rw472BE526_16FF_4719_925C_3305F5BE4480 = {};
RWElements.rw472BE526_16FF_4719_925C_3305F5BE4480 = (function(componentId) {
    
(() => {
  "use strict";

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
    centerHitScale: 0.92
  };

  function initChaosNavigation(root) {
    if (!root || root.dataset.chaosReady === "true") return;

    const svg = root.querySelector("svg");
    if (!svg) {
      console.warn("Chaos navigation: inline SVG was not found.");
      return;
    }

    root.dataset.chaosReady = "true";

    const finePointerQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    );

    let activeNode = null;
    let keyboardNode = null;

    const nodeRecords = new Map();

    function getElement(id) {
      return svg.querySelector(`#${CSS.escape(id)}`);
    }

    function requireElement(id) {
      const element = getElement(id);
      if (!element) {
        console.warn(`Chaos navigation: missing SVG element #${id}`);
      }
      return element;
    }

    const chaosEye = requireElement("chaos-eye");
    const chaosTendrils = requireElement("chaos-tendrils");

    if (chaosEye) chaosEye.classList.add("chaos-default-center");
    if (chaosTendrils) chaosTendrils.classList.add("chaos-passive-field");

    for (const [name, config] of Object.entries(CONFIG.nodes)) {
      const record = {
        name,
        config,
        route: requireElement(config.routeId),
        center: requireElement(`${name}_center`),
        normal: requireElement(`${name}_node`),
        normalBackground: requireElement(`${name}_node_background`),
        inverted: requireElement(`${name}_node-invert`),
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
      record.inverted?.classList.add("chaos-node-inverted");
      record.invertedBackground?.classList.add(
        "chaos-node-inverted-background"
      );

      nodeRecords.set(name, record);
    }

    function clearStateClasses() {
      for (const record of nodeRecords.values()) {
        record.route?.classList.remove("is-active");
        record.center?.classList.remove("is-active");
        record.normal?.classList.remove("is-selected");
        record.normalBackground?.classList.remove("is-selected");
        record.inverted?.classList.remove("is-selected");
        record.invertedBackground?.classList.remove("is-selected");
      }
    }

    function setActiveNode(name) {
      if (!nodeRecords.has(name)) return;

      activeNode = name;
      root.classList.add("is-engaged");
      root.dataset.activeNode = name;

      clearStateClasses();

      const record = nodeRecords.get(name);
      record.route?.classList.add("is-active");
      record.center?.classList.add("is-active");
      record.normal?.classList.add("is-selected");
      record.normalBackground?.classList.add("is-selected");
      record.inverted?.classList.add("is-selected");
      record.invertedBackground?.classList.add("is-selected");

      centerHitTarget?.setAttribute(
        "aria-label",
        `Open ${record.config.label}`
      );
    }

    function resetNavigation() {
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

    function makeSvgCircle(className) {
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("class", className);
      return circle;
    }

    /* Create explicit interaction circles above all artwork. This keeps
       pointer behavior stable while visible layers crossfade underneath. */
    for (const record of nodeRecords.values()) {
      const source =
        record.normalBackground ||
        record.invertedBackground ||
        record.normal;

      if (!source || typeof source.getBBox !== "function") continue;

      const box = source.getBBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const radius =
        Math.max(box.width, box.height) /
        2 *
        CONFIG.nodeHitScale;

      const hit = makeSvgCircle("chaos-hit-target chaos-node-hit-target");
      hit.setAttribute("cx", String(cx));
      hit.setAttribute("cy", String(cy));
      hit.setAttribute("r", String(radius));
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("role", "link");
      hit.setAttribute("aria-label", `Open ${record.config.label}`);
      hit.dataset.chaosNode = record.name;

      svg.appendChild(hit);
      record.hitTarget = hit;

      hit.addEventListener("pointerenter", event => {
        if (
          finePointerQuery.matches &&
          event.pointerType !== "touch"
        ) {
          setActiveNode(record.name);
        }
      });

      hit.addEventListener("pointerleave", event => {
        if (
          finePointerQuery.matches &&
          event.pointerType !== "touch" &&
          keyboardNode === null
        ) {
          resetNavigation();
        }
      });

      hit.addEventListener("click", event => {
        if (finePointerQuery.matches && event.detail !== 0) {
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
        if (event.key === "Enter" || event.key === " ") {
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

    /* The selected expanded artwork is the confirmation/navigation target
       on touch devices. Its geometry is based on the Chaos Eye bounds. */
    let centerHitTarget = null;

    if (chaosEye && typeof chaosEye.getBBox === "function") {
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

      centerHitTarget.addEventListener("click", event => {
        if (activeNode && finePointerQuery.matches && event.detail !== 0) {
          navigateTo(activeNode);
        }
      });

      centerHitTarget.addEventListener("pointerup", event => {
        if (event.pointerType === "touch" && activeNode) {
          event.preventDefault();
          navigateTo(activeNode);
        }
      });
    }

    /* A touch on blank SVG space resets the held selection. */
    svg.addEventListener("pointerup", event => {
      if (event.pointerType !== "touch") return;

      const hitTarget = event.target.closest?.(".chaos-hit-target");
      if (!hitTarget) {
        resetNavigation();
      }
    });

    /* A touch outside the component also resets the held selection. */
    document.addEventListener(
      "pointerdown",
      event => {
        if (
          event.pointerType === "touch" &&
          activeNode &&
          !root.contains(event.target)
        ) {
          resetNavigation();
        }
      },
      { passive: true }
    );

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && activeNode) {
        resetNavigation();
      }
    });

    /* Reset a mouse-hover preview if the device changes input mode. */
    finePointerQuery.addEventListener?.("change", () => {
      if (keyboardNode === null) resetNavigation();
    });

    resetNavigation();
  }

 async function loadAndInitChaosNavigation(root) {
  if (!root || root.dataset.chaosLoadStarted === "true") {
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
      Remove the exported fixed dimensions so the CSS controls sizing.
      The viewBox remains, preserving the square aspect ratio.
    */
    svg.removeAttribute("width");
    svg.removeAttribute("height");

    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "auto");
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


return componentId;})(RWElements.rw472BE526_16FF_4719_925C_3305F5BE4480);