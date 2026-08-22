

var RWElements={};

RWElements.rw3D67B462_70CF_4853_A96A_6BEBA046E08B = {};
RWElements.rw3D67B462_70CF_4853_A96A_6BEBA046E08B = (function(componentId) {
    
(() => {

  "use strict";


  let navigationInstanceCount = 0;



  /* =========================================================
     INTRO STORAGE
     ========================================================= */

  /*
   * Change v1 → v2 someday if you significantly redesign
   * the full intro and want everyone to receive the new
   * construction sequence once.
   */

  const INTRO_STORAGE_KEY =
    "chaos-home-intro-v1";



  function hasCompletedFullIntro() {

    try {

      return (
        window.localStorage.getItem(
          INTRO_STORAGE_KEY
        ) === "true"
      );

    } catch (_) {

      /*
       * Some privacy/security contexts can disable storage.
       * In that case, simply behave like a first visit.
       */

      return false;
    }
  }



  function markFullIntroComplete() {

    try {

      window.localStorage.setItem(
        INTRO_STORAGE_KEY,
        "true"
      );

    } catch (_) {

      /*
       * Storage unavailable:
       * nothing breaks; the full intro simply plays again
       * on a future visit.
       */
    }
  }



  /* =========================================================
     RETURNING-VISITOR REPLAY EASTER EGG
     ========================================================= */

  function getIntroResetControls() {

    return Array.from(
      document.querySelectorAll(
        ".chaos-intro-reset"
      )
    );
  }



  function hideIntroResetControls() {

    getIntroResetControls()
      .forEach(
        control => {

          control.classList.remove(
            "is-available"
          );
        }
      );
  }



  function showIntroResetControls() {

    getIntroResetControls()
      .forEach(
        control => {

          control.classList.add(
            "is-available"
          );
        }
      );
  }



  function resetFullIntroForReplay() {

    try {

      window.localStorage.removeItem(
        INTRO_STORAGE_KEY
      );

    } catch (_) {

      /*
       * If storage is unavailable there is nothing to clear.
       * Reloading remains safe.
       */
    }


    window.location.reload();
  }



  function installIntroResetControls() {

    getIntroResetControls()
      .forEach(
        control => {

          control.classList.remove(
            "is-available"
          );


          if (
            control.dataset.chaosResetReady ===
              "true"
          ) {
            return;
          }


          control.dataset.chaosResetReady =
            "true";


          if (
            control.tagName !==
              "BUTTON"
          ) {

            control.setAttribute(
              "role",
              "button"
            );


            if (
              !control.hasAttribute(
                "tabindex"
              )
            ) {

              control.setAttribute(
                "tabindex",
                "0"
              );
            }
          }


          control.setAttribute(
            "aria-label",
            "Replay full Chaos System intro"
          );


          control.addEventListener(
            "click",
            event => {

              event.preventDefault();

              resetFullIntroForReplay();
            }
          );


          control.addEventListener(
            "keydown",
            event => {

              if (
                event.key !==
                  "Enter" &&
                event.key !==
                  " "
              ) {
                return;
              }


              event.preventDefault();

              resetFullIntroForReplay();
            }
          );
        }
      );
  }



  /* =========================================================
     CONFIGURATION
     ========================================================= */

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

      resume: {
        routeId: "node-5_resume",
        url: "/resume/",
        label: "Resume"
      },

      context: {
        routeId: "node-6_context",
        url: "/context/",
        label: "Context"
      }
    },


    nodeHitScale:
      1.18,


    centerHitScale:
      0.92,


    desktopResetDelay:
      1000,


    svgBlurScale:
      0.5
  };



  /* =========================================================
     INITIALIZE ONE NAVIGATION INSTANCE
     ========================================================= */

  function initChaosNavigation(root) {

    if (
      !root ||
      root.dataset.chaosReady ===
        "true"
    ) {
      return;
    }


    const svg =
      root.querySelector(
        "svg"
      );


    if (!svg) {

      console.warn(
        "Chaos navigation: inline SVG was not found."
      );

      return;
    }


    root.dataset.chaosReady =
      "true";


    const instanceNumber =
      ++navigationInstanceCount;


    const filterId =
      `chaos-active-route-filter-${instanceNumber}`;


    const finePointerQuery =
      window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      );


    const mobileQuery =
      window.matchMedia(
        "(max-width: 767px)"
      );


    const reducedMotionQuery =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );


    let activeNode =
      null;


    let keyboardNode =
      null;


    let resetTimer =
      null;


    let entranceFinishTimer =
      null;


    let centerHitTarget =
      null;


    const nodeRecords =
      new Map();


    const entranceAnimations =
      new Set();


    const introOriginalStyles =
      new Map();



    /* =======================================================
       ELEMENT UTILITIES
       ======================================================= */

    function getElement(id) {

      return svg.querySelector(
        `#${CSS.escape(id)}`
      );
    }



    function requireElement(id) {

      const element =
        getElement(id);


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

      const circle =
        createSvgElement(
          "circle"
        );


      circle.setAttribute(
        "class",
        className
      );


      return circle;
    }



    /* =======================================================
       CSS VALUE READERS
       ======================================================= */

    function readCssValue(
      propertyName,
      fallback = ""
    ) {

      const value =
        getComputedStyle(root)
          .getPropertyValue(
            propertyName
          )
          .trim();


      return value ||
        fallback;
    }



    function readCssNumber(
      propertyName,
      fallback = 0
    ) {

      const value =
        parseFloat(
          readCssValue(
            propertyName,
            `${fallback}`
          )
        );


      return Number.isFinite(value)
        ? value
        : fallback;
    }



    function readCssColor(
      propertyName,
      fallback
    ) {

      return readCssValue(
        propertyName,
        fallback
      );
    }



    function readCssTime(
      propertyName,
      fallback = 0
    ) {

      const raw =
        readCssValue(
          propertyName,
          `${fallback}ms`
        );


      if (
        raw.endsWith("ms")
      ) {

        const value =
          parseFloat(raw);


        return Number.isFinite(value)
          ? value
          : fallback;
      }


      if (
        raw.endsWith("s")
      ) {

        const value =
          parseFloat(raw);


        return Number.isFinite(value)
          ? value * 1000
          : fallback;
      }


      const value =
        parseFloat(raw);


      return Number.isFinite(value)
        ? value
        : fallback;
    }



    /* =======================================================
       SVG FILTER HELPERS
       ======================================================= */

    function createDropShadow({
      input,
      result,
      blur,
      color
    }) {

      const shadow =
        createSvgElement(
          "feDropShadow"
        );


      shadow.setAttribute(
        "in",
        input
      );


      shadow.setAttribute(
        "dx",
        "0"
      );


      shadow.setAttribute(
        "dy",
        "0"
      );


      shadow.setAttribute(
        "stdDeviation",
        String(blur)
      );


      shadow.setAttribute(
        "flood-color",
        color
      );


      shadow.setAttribute(
        "flood-opacity",
        "1"
      );


      shadow.setAttribute(
        "result",
        result
      );


      return shadow;
    }



    function installNativeRouteFilter() {

      let defs =
        svg.querySelector(
          "defs"
        );


      if (!defs) {

        defs =
          createSvgElement(
            "defs"
          );


        svg.insertBefore(
          defs,
          svg.firstChild
        );
      }


      const filter =
        createSvgElement(
          "filter"
        );


      filter.setAttribute(
        "id",
        filterId
      );


      filter.setAttribute(
        "x",
        "-100%"
      );


      filter.setAttribute(
        "y",
        "-100%"
      );


      filter.setAttribute(
        "width",
        "300%"
      );


      filter.setAttribute(
        "height",
        "300%"
      );


      filter.setAttribute(
        "color-interpolation-filters",
        "sRGB"
      );


      defs.appendChild(
        filter
      );


      for (
        const record
        of nodeRecords.values()
      ) {

        record.route
          ?.setAttribute(
            "filter",
            `url(#${filterId})`
          );
      }


      return filter;
    }



    function syncNativeRouteFilter(
      filter
    ) {

      const scale =
        CONFIG.svgBlurScale;


      const edgeColor =
        readCssColor(
          "--chaos-edge-color",
          "rgb(0 0 0 / 1)"
        );


      const glowColor =
        readCssColor(
          "--chaos-glow-color",
          "rgb(9, 133, 0)"
        );


      const edgeNear =
        readCssNumber(
          "--chaos-edge-near",
          6
        ) *
        scale;


      const edgeFar =
        readCssNumber(
          "--chaos-edge-far",
          13
        ) *
        scale;


      const glowNear =
        readCssNumber(
          "--chaos-glow-near",
          2
        ) *
        scale;


      const glowMid =
        readCssNumber(
          "--chaos-glow-mid",
          5
        ) *
        scale;


      const glowFar =
        readCssNumber(
          "--chaos-glow-far",
          7
        ) *
        scale;


      filter.replaceChildren(

        createDropShadow({
          input:
            "SourceGraphic",

          result:
            "chaos-edge-near",

          blur:
            edgeNear,

          color:
            edgeColor
        }),


        createDropShadow({
          input:
            "chaos-edge-near",

          result:
            "chaos-edge-far",

          blur:
            edgeFar,

          color:
            edgeColor
        }),


        createDropShadow({
          input:
            "chaos-edge-far",

          result:
            "chaos-glow-near",

          blur:
            glowNear,

          color:
            glowColor
        }),


        createDropShadow({
          input:
            "chaos-glow-near",

          result:
            "chaos-glow-mid",

          blur:
            glowMid,

          color:
            glowColor
        }),


        createDropShadow({
          input:
            "chaos-glow-mid",

          result:
            "chaos-glow-far",

          blur:
            glowFar,

          color:
            glowColor
        })
      );
    }



    /* =======================================================
       RESET TIMING
       ======================================================= */

    function cancelScheduledReset() {

      if (
        resetTimer ===
        null
      ) {
        return;
      }


      window.clearTimeout(
        resetTimer
      );


      resetTimer =
        null;
    }



    function scheduleNavigationReset() {

      cancelScheduledReset();


      resetTimer =
        window.setTimeout(
          () => {

            resetTimer =
              null;


            if (
              keyboardNode ===
              null
            ) {

              resetNavigation();
            }
          },

          CONFIG.desktopResetDelay
        );
    }



    /* =======================================================
       IDENTIFY CORE SVG ELEMENTS
       ======================================================= */

    const chaosEye =
      requireElement(
        "chaos-eye"
      );


    const chaosTendrils =
      requireElement(
        "chaos-tendrils"
      );



    /* =======================================================
       BUILD NODE RECORDS
       ======================================================= */

    for (
      const [name, config]
      of Object.entries(
        CONFIG.nodes
      )
    ) {

      const record = {

        name,

        config,

        route:
          requireElement(
            config.routeId
          ),

        center:
          requireElement(
            `${name}_center`
          ),

        normal:
          requireElement(
            `${name}_node`
          ),

        normalBackground:
          requireElement(
            `${name}_node_background`
          ),

        inverted:
          requireElement(
            `${name}_node-invert`
          ),

        invertedBackground:
          requireElement(
            `${name}_node-invert_background`
          ),

        hitTarget:
          null
      };


      record.route
        ?.classList.add(
          "chaos-route"
        );


      record.center
        ?.classList.add(
          "chaos-center"
        );


      record.normal
        ?.classList.add(
          "chaos-node-normal"
        );


      record.normalBackground
        ?.classList.add(
          "chaos-node-normal-background"
        );


      record.inverted
        ?.classList.add(
          "chaos-node-inverted"
        );


      record.invertedBackground
        ?.classList.add(
          "chaos-node-inverted-background"
        );


      nodeRecords.set(
        name,
        record
      );
    }



    /* =======================================================
       INSTALL ACTIVE ROUTE FILTER
       ======================================================= */

    const nativeRouteFilter =
      installNativeRouteFilter();


    syncNativeRouteFilter(
      nativeRouteFilter
    );



    /* =======================================================
       ENTRANCE STATE CHECK
       ======================================================= */

    function entranceIsActive() {

      return (
        root.classList.contains(
          "chaos-intro-active"
        ) ||
        root.classList.contains(
          "chaos-return-active"
        )
      );
    }



    /* =======================================================
       INTERACTION STATE
       ======================================================= */

    function clearStateClasses() {

      for (
        const record
        of nodeRecords.values()
      ) {

        record.route
          ?.classList.remove(
            "is-active"
          );


        record.center
          ?.classList.remove(
            "is-active"
          );


        record.normal
          ?.classList.remove(
            "is-selected"
          );


        record.normalBackground
          ?.classList.remove(
            "is-selected"
          );


        record.inverted
          ?.classList.remove(
            "is-selected"
          );


        record.invertedBackground
          ?.classList.remove(
            "is-selected"
          );
      }
    }



    function setActiveNode(name) {

      if (
        entranceIsActive()
      ) {
        return;
      }


      if (
        !nodeRecords.has(name)
      ) {
        return;
      }


      cancelScheduledReset();


      activeNode =
        name;


      root.classList.add(
        "is-engaged"
      );


      root.dataset.activeNode =
        name;


      clearStateClasses();


      const record =
        nodeRecords.get(
          name
        );


      record.route
        ?.classList.add(
          "is-active"
        );


      record.center
        ?.classList.add(
          "is-active"
        );


      record.normal
        ?.classList.add(
          "is-selected"
        );


      record.normalBackground
        ?.classList.add(
          "is-selected"
        );


      record.inverted
        ?.classList.add(
          "is-selected"
        );


      record.invertedBackground
        ?.classList.add(
          "is-selected"
        );


      centerHitTarget
        ?.setAttribute(
          "aria-label",
          `Open ${record.config.label}`
        );
    }



    function resetNavigation() {

      cancelScheduledReset();


      activeNode =
        null;


      root.classList.remove(
        "is-engaged"
      );


      root.removeAttribute(
        "data-active-node"
      );


      clearStateClasses();


      centerHitTarget
        ?.setAttribute(
          "aria-label",
          "Chaos System navigation center"
        );
    }



    function navigateTo(name) {

      if (
        entranceIsActive()
      ) {
        return;
      }


      const record =
        nodeRecords.get(
          name
        );


      if (!record) {
        return;
      }


      window.location.assign(
        record.config.url
      );
    }



    /* =======================================================
       OUTER NODE HIT TARGETS
       ======================================================= */

    for (
      const record
      of nodeRecords.values()
    ) {

      const source =

        record.normalBackground ||

        record.invertedBackground ||

        record.normal;


      if (
        !source ||
        typeof source.getBBox !==
          "function"
      ) {
        continue;
      }


      const box =
        source.getBBox();


      const cx =
        box.x +
        box.width / 2;


      const cy =
        box.y +
        box.height / 2;


      const radius =

        Math.max(
          box.width,
          box.height
        ) /
        2 *
        CONFIG.nodeHitScale;


      const hit =
        makeSvgCircle(
          "chaos-hit-target chaos-node-hit-target"
        );


      hit.setAttribute(
        "cx",
        String(cx)
      );


      hit.setAttribute(
        "cy",
        String(cy)
      );


      hit.setAttribute(
        "r",
        String(radius)
      );


      hit.setAttribute(
        "tabindex",
        "0"
      );


      hit.setAttribute(
        "role",
        "link"
      );


      hit.setAttribute(
        "aria-label",
        `Open ${record.config.label}`
      );


      hit.dataset.chaosNode =
        record.name;


      svg.appendChild(
        hit
      );


      record.hitTarget =
        hit;



      hit.addEventListener(
        "pointerenter",
        event => {

          if (
            finePointerQuery.matches &&
            event.pointerType !==
              "touch"
          ) {

            cancelScheduledReset();

            setActiveNode(
              record.name
            );
          }
        }
      );



      hit.addEventListener(
        "pointerleave",
        event => {

          if (
            finePointerQuery.matches &&
            event.pointerType !==
              "touch" &&
            keyboardNode ===
              null
          ) {

            scheduleNavigationReset();
          }
        }
      );



      hit.addEventListener(
        "click",
        event => {

          if (
            finePointerQuery.matches &&
            event.detail !==
              0
          ) {

            navigateTo(
              record.name
            );
          }
        }
      );



      hit.addEventListener(
        "pointerup",
        event => {

          if (
            event.pointerType ===
            "touch"
          ) {

            event.preventDefault();

            setActiveNode(
              record.name
            );
          }
        }
      );



      hit.addEventListener(
        "focus",
        () => {

          if (
            entranceIsActive()
          ) {
            return;
          }


          cancelScheduledReset();


          keyboardNode =
            record.name;


          setActiveNode(
            record.name
          );
        }
      );



      hit.addEventListener(
        "blur",
        () => {

          keyboardNode =
            null;


          window.requestAnimationFrame(
            () => {

              if (
                !root.contains(
                  document.activeElement
                )
              ) {

                resetNavigation();
              }
            }
          );
        }
      );



      hit.addEventListener(
        "keydown",
        event => {

          if (
            event.key ===
              "Enter" ||

            event.key ===
              " "
          ) {

            event.preventDefault();

            navigateTo(
              record.name
            );
          }


          if (
            event.key ===
              "Escape"
          ) {

            event.preventDefault();

            resetNavigation();

            hit.blur();
          }
        }
      );
    }



    /* =======================================================
       CENTER CONFIRMATION TARGET
       ======================================================= */

    if (
      chaosEye &&
      typeof chaosEye.getBBox ===
        "function"
    ) {

      const box =
        chaosEye.getBBox();


      const cx =
        box.x +
        box.width / 2;


      const cy =
        box.y +
        box.height / 2;


      const radius =

        Math.min(
          box.width,
          box.height
        ) /
        2 *
        CONFIG.centerHitScale;


      centerHitTarget =
        makeSvgCircle(
          "chaos-hit-target chaos-center-hit-target"
        );


      centerHitTarget.setAttribute(
        "cx",
        String(cx)
      );


      centerHitTarget.setAttribute(
        "cy",
        String(cy)
      );


      centerHitTarget.setAttribute(
        "r",
        String(radius)
      );


      centerHitTarget.setAttribute(
        "role",
        "link"
      );


      centerHitTarget.setAttribute(
        "aria-label",
        "Chaos System navigation center"
      );


      svg.appendChild(
        centerHitTarget
      );


      centerHitTarget.addEventListener(
        "click",
        event => {

          if (
            activeNode &&
            finePointerQuery.matches &&
            event.detail !==
              0
          ) {

            navigateTo(
              activeNode
            );
          }
        }
      );


      centerHitTarget.addEventListener(
        "pointerup",
        event => {

          if (
            event.pointerType ===
              "touch" &&
            activeNode
          ) {

            event.preventDefault();

            navigateTo(
              activeNode
            );
          }
        }
      );
    }



    /* =======================================================
       ROOT POINTER BEHAVIOR
       ======================================================= */

    root.addEventListener(
      "pointerenter",
      event => {

        if (
          finePointerQuery.matches &&
          event.pointerType !==
            "touch"
        ) {

          cancelScheduledReset();
        }
      }
    );


    root.addEventListener(
      "pointerleave",
      event => {

        if (
          finePointerQuery.matches &&
          event.pointerType !==
            "touch" &&
          keyboardNode ===
            null
        ) {

          scheduleNavigationReset();
        }
      }
    );



    /* =======================================================
       BLANK-SPACE TOUCH RESET
       ======================================================= */

    svg.addEventListener(
      "pointerup",
      event => {

        if (
          event.pointerType !==
            "touch"
        ) {
          return;
        }


        const hitTarget =
          event.target.closest?.(
            ".chaos-hit-target"
          );


        if (!hitTarget) {

          resetNavigation();
        }
      }
    );



    /* =======================================================
       OUTSIDE RESET
       ======================================================= */

    document.addEventListener(
      "pointerdown",
      event => {

        if (
          activeNode &&
          !root.contains(
            event.target
          )
        ) {

          resetNavigation();
        }
      },

      {
        passive: true
      }
    );


    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
            "Escape" &&
          activeNode
        ) {

          resetNavigation();
        }
      }
    );



    /* =======================================================
       INPUT MODE CHANGE
       ======================================================= */

    finePointerQuery
      .addEventListener?.(
        "change",
        () => {

          if (
            keyboardNode ===
              null
          ) {

            resetNavigation();
          }
        }
      );



    /* =======================================================
       RESPONSIVE FILTER SYNC
       ======================================================= */

    const syncResponsiveFilter =
      () => {

        syncNativeRouteFilter(
          nativeRouteFilter
        );
      };


    if (
      typeof mobileQuery.addEventListener ===
      "function"
    ) {

      mobileQuery.addEventListener(
        "change",
        syncResponsiveFilter
      );

    } else {

      mobileQuery.addListener(
        syncResponsiveFilter
      );
    }



    /* =======================================================
       ENTRANCE ANIMATION UTILITIES
       ======================================================= */

    function trackEntranceAnimation(
      animation
    ) {

      entranceAnimations.add(
        animation
      );


      animation.finished
        .catch(() => {});


      return animation;
    }



    function cancelEntranceAnimations() {

      entranceAnimations.forEach(
        animation => {

          try {

            animation.cancel();

          } catch (_) {}
        }
      );


      entranceAnimations.clear();
    }



    function clearEntranceTimer() {

      if (
        entranceFinishTimer ===
          null
      ) {
        return;
      }


      window.clearTimeout(
        entranceFinishTimer
      );


      entranceFinishTimer =
        null;
    }



    /* =======================================================
       FULL INTRO — DRAWABLE SHAPES
       ======================================================= */

    function getDrawableShapes(element) {

      if (!element) {
        return [];
      }


      const selector =
        [
          "path",
          "line",
          "polyline",
          "polygon",
          "rect",
          "circle",
          "ellipse"
        ].join(",");


      const result =
        [];


      if (
        element.matches?.(
          selector
        )
      ) {

        result.push(
          element
        );
      }


      result.push(
        ...element.querySelectorAll(
          selector
        )
      );


      return result;
    }



    function rememberIntroStyle(
      element
    ) {

      if (
        introOriginalStyles.has(
          element
        )
      ) {
        return;
      }


      introOriginalStyles.set(
        element,
        {
          fillOpacity:
            element.style.fillOpacity,

          stroke:
            element.style.stroke,

          strokeWidth:
            element.style.strokeWidth,

          strokeOpacity:
            element.style.strokeOpacity,

          strokeDasharray:
            element.style.strokeDasharray,

          strokeDashoffset:
            element.style.strokeDashoffset,

          strokeLinecap:
            element.style.strokeLinecap,

          strokeLinejoin:
            element.style.strokeLinejoin,

          paintOrder:
            element.style.paintOrder,

          opacity:
            element.style.opacity
        }
      );
    }



    /* =======================================================
       FULL INTRO — PREPARE DRAW / FILL PART
       ======================================================= */

    function prepareIntroPart(
      source,
      strokeColorProperty,
      strokeWidthProperty
    ) {

      if (!source) {
        return [];
      }


      const strokeColor =
        readCssColor(
          strokeColorProperty,
          "rgb(255,255,255)"
        );


      const strokeWidth =
        readCssValue(
          strokeWidthProperty,
          "3px"
        );


      const shapes =
        getDrawableShapes(
          source
        );


      const prepared =
        [];


      shapes.forEach(
        shape => {

          if (
            typeof shape.getTotalLength !==
              "function"
          ) {
            return;
          }


          let length = 0;


          try {

            length =
              shape.getTotalLength();

          } catch (_) {

            return;
          }


          if (
            !Number.isFinite(length) ||
            length <= 0
          ) {
            return;
          }


          rememberIntroStyle(
            shape
          );


          const computed =
            getComputedStyle(
              shape
            );


          const finalFillOpacity =
            parseFloat(
              computed.fillOpacity
            );


          const hiddenLength =
            length *
            1.025;


          shape.style.fillOpacity =
            "0";


          shape.style.stroke =
            strokeColor;


          shape.style.strokeWidth =
            strokeWidth;


          shape.style.strokeOpacity =
            "1";


          shape.style.strokeLinecap =
            "round";


          shape.style.strokeLinejoin =
            "round";


          shape.style.paintOrder =
            "fill stroke";


          shape.style.strokeDasharray =
            `${hiddenLength} ${hiddenLength}`;


          shape.style.strokeDashoffset =
            `${hiddenLength}`;


          prepared.push({
            shape,
            hiddenLength,

            finalFillOpacity:
              Number.isFinite(
                finalFillOpacity
              )
                ? finalFillOpacity
                : 1
          });
        }
      );


      return prepared;
    }



    /* =======================================================
       FULL INTRO — DRAW / FILL / STROKE OUT
       ======================================================= */

    function animateIntroPart(
      prepared,
      controls
    ) {

      const drawDelay =
        readCssTime(
          controls.drawDelay
        );


      const drawDuration =
        readCssTime(
          controls.drawDuration
        );


      const drawEasing =
        readCssValue(
          controls.drawEasing,
          "ease"
        );


      const fillDelay =
        readCssTime(
          controls.fillDelay
        );


      const fillDuration =
        readCssTime(
          controls.fillDuration
        );


      const fillEasing =
        readCssValue(
          controls.fillEasing,
          "ease"
        );


      const strokeOutDelay =
        readCssTime(
          controls.strokeOutDelay
        );


      const strokeOutDuration =
        readCssTime(
          controls.strokeOutDuration
        );


      const strokeOutEasing =
        readCssValue(
          controls.strokeOutEasing,
          "ease"
        );


      prepared.forEach(
        item => {

          trackEntranceAnimation(
            item.shape.animate(

              [
                {
                  strokeDashoffset:
                    `${item.hiddenLength}`
                },

                {
                  strokeDashoffset:
                    "0"
                }
              ],

              {
                delay:
                  drawDelay,

                duration:
                  drawDuration,

                easing:
                  drawEasing,

                fill:
                  "forwards"
              }
            )
          );


          trackEntranceAnimation(
            item.shape.animate(

              [
                {
                  fillOpacity:
                    0
                },

                {
                  fillOpacity:
                    item.finalFillOpacity
                }
              ],

              {
                delay:
                  fillDelay,

                duration:
                  fillDuration,

                easing:
                  fillEasing,

                fill:
                  "forwards"
              }
            )
          );


          trackEntranceAnimation(
            item.shape.animate(

              [
                {
                  strokeOpacity:
                    1
                },

                {
                  strokeOpacity:
                    0
                }
              ],

              {
                delay:
                  strokeOutDelay,

                duration:
                  strokeOutDuration,

                easing:
                  strokeOutEasing,

                fill:
                  "forwards"
              }
            )
          );
        }
      );
    }



    /* =======================================================
       FULL INTRO — PREPARE NODE
       ======================================================= */

    function prepareIntroNode(record) {

      if (!record) {
        return [];
      }


      return [
        record.normal,
        record.normalBackground
      ]
        .filter(Boolean)
        .map(
          element => {

            rememberIntroStyle(
              element
            );


            const computedOpacity =
              parseFloat(
                getComputedStyle(
                  element
                ).opacity
              );


            element.style.opacity =
              "0";


            return {
              element,

              finalOpacity:
                Number.isFinite(
                  computedOpacity
                )
                  ? computedOpacity
                  : 1
            };
          }
        );
    }



    function animateIntroNode(
      prepared,
      delayProperty
    ) {

      const delay =
        readCssTime(
          delayProperty
        );


      const duration =
        readCssTime(
          "--chaos-intro-node-duration"
        );


      const easing =
        readCssValue(
          "--chaos-intro-node-easing",
          "ease"
        );


      prepared.forEach(
        item => {

          trackEntranceAnimation(
            item.element.animate(

              [
                {
                  opacity: 0
                },

                {
                  opacity:
                    item.finalOpacity
                }
              ],

              {
                delay,
                duration,
                easing,

                fill:
                  "forwards"
              }
            )
          );
        }
      );
    }



    /* =======================================================
       FULL INTRO — TOTAL DURATION
       ======================================================= */

    function getFullIntroDuration() {

      const centerEnd =
        Math.max(

          readCssTime(
            "--chaos-intro-center-draw-delay"
          ) +
          readCssTime(
            "--chaos-intro-center-draw-duration"
          ),

          readCssTime(
            "--chaos-intro-center-fill-delay"
          ) +
          readCssTime(
            "--chaos-intro-center-fill-duration"
          ),

          readCssTime(
            "--chaos-intro-center-stroke-out-delay"
          ) +
          readCssTime(
            "--chaos-intro-center-stroke-out-duration"
          )
        );


      const tendrilsEnd =
        Math.max(

          readCssTime(
            "--chaos-intro-tendrils-draw-delay"
          ) +
          readCssTime(
            "--chaos-intro-tendrils-draw-duration"
          ),

          readCssTime(
            "--chaos-intro-tendrils-fill-delay"
          ) +
          readCssTime(
            "--chaos-intro-tendrils-fill-duration"
          ),

          readCssTime(
            "--chaos-intro-tendrils-stroke-out-delay"
          ) +
          readCssTime(
            "--chaos-intro-tendrils-stroke-out-duration"
          )
        );


      const nodeDuration =
        readCssTime(
          "--chaos-intro-node-duration"
        );


      const nodesEnd =
        Math.max(

          readCssTime(
            "--chaos-intro-video-delay"
          ),

          readCssTime(
            "--chaos-intro-design-delay"
          ),

          readCssTime(
            "--chaos-intro-audio-delay"
          ),

          readCssTime(
            "--chaos-intro-ai-delay"
          ),

          readCssTime(
            "--chaos-intro-resume-delay"
          ),

          readCssTime(
            "--chaos-intro-context-delay"
          )

        ) +
        nodeDuration;


      const settleEnd =
        readCssTime(
          "--chaos-intro-settle-duration"
        );


      return Math.max(
        centerEnd,
        tendrilsEnd,
        nodesEnd,
        settleEnd
      );
    }



    /* =======================================================
       FULL INTRO — FINISH
       ======================================================= */

    function finishFullIntro() {

      clearEntranceTimer();


      /*
       * Establish permanent normal visual state while
       * interaction transitions are still disabled.
       */

      if (chaosEye) {
        chaosEye.style.opacity =
          "1";
      }


      if (chaosTendrils) {
        chaosTendrils.style.opacity =
          "1";
      }


      for (
        const record
        of nodeRecords.values()
      ) {

        if (record.normal) {
          record.normal.style.opacity =
            "1";
        }


        if (
          record.normalBackground
        ) {

          record.normalBackground.style.opacity =
            "1";
        }
      }


      /*
       * Restore all temporary construction properties.
       * Opacity stays explicitly final until the handoff.
       */

      introOriginalStyles.forEach(
        (styles, element) => {

          element.style.fillOpacity =
            styles.fillOpacity;

          element.style.stroke =
            styles.stroke;

          element.style.strokeWidth =
            styles.strokeWidth;

          element.style.strokeOpacity =
            styles.strokeOpacity;

          element.style.strokeDasharray =
            styles.strokeDasharray;

          element.style.strokeDashoffset =
            styles.strokeDashoffset;

          element.style.strokeLinecap =
            styles.strokeLinecap;

          element.style.strokeLinejoin =
            styles.strokeLinejoin;

          element.style.paintOrder =
            styles.paintOrder;
        }
      );


      cancelEntranceAnimations();


      svg.getAnimations()
        .forEach(
          animation => {

            try {
              animation.cancel();
            } catch (_) {}
          }
        );


      svg.style.transform =
        "translateY(0) scale(1)";


      /*
       * The visitor only earns the returning-visitor mode
       * after the COMPLETE full animation has finished.
       */

      markFullIntroComplete();


      window.requestAnimationFrame(
        () => {

          window.requestAnimationFrame(
            () => {

              root.classList.remove(
                "chaos-intro-active",
                "chaos-intro-running"
              );


              if (chaosEye) {
                chaosEye.style.opacity =
                  "";
              }


              if (chaosTendrils) {
                chaosTendrils.style.opacity =
                  "";
              }


              for (
                const record
                of nodeRecords.values()
              ) {

                if (record.normal) {
                  record.normal.style.opacity =
                    "";
                }


                if (
                  record.normalBackground
                ) {

                  record.normalBackground.style.opacity =
                    "";
                }
              }


              introOriginalStyles.clear();


              svg.style.transform =
                "";


              root.removeAttribute(
                "aria-busy"
              );


              root.dataset.chaosEntranceComplete =
                "true";
            }
          );
        }
      );
    }



    /* =======================================================
       FULL INTRO — START
       ======================================================= */

    function startFullIntro() {

      root.setAttribute(
        "aria-busy",
        "true"
      );


      root.classList.add(
        "chaos-intro-active"
      );


      const centerPrepared =
        prepareIntroPart(
          chaosEye,
          "--chaos-intro-center-stroke-color",
          "--chaos-intro-center-stroke-width"
        );


      const tendrilsPrepared =
        prepareIntroPart(
          chaosTendrils,
          "--chaos-intro-tendrils-stroke-color",
          "--chaos-intro-tendrils-stroke-width"
        );


      const videoPrepared =
        prepareIntroNode(
          nodeRecords.get(
            "video"
          )
        );


      const designPrepared =
        prepareIntroNode(
          nodeRecords.get(
            "design"
          )
        );


      const audioPrepared =
        prepareIntroNode(
          nodeRecords.get(
            "audio"
          )
        );


      const aiPrepared =
        prepareIntroNode(
          nodeRecords.get(
            "ai"
          )
        );


      const resumePrepared =
        prepareIntroNode(
          nodeRecords.get(
            "resume"
          )
        );


      const contextPrepared =
        prepareIntroNode(
          nodeRecords.get(
            "context"
          )
        );


      root.classList.remove(
        "chaos-intro-preparing"
      );


      /*
       * Accessibility preference:
       * go directly to completed state.
       *
       * We also mark the full intro as complete because
       * deliberately replaying a long motion sequence on
       * every visit would defeat the user's preference.
       */

      if (
        reducedMotionQuery.matches
      ) {

        markFullIntroComplete();

        finishFullIntro();

        return;
      }


      window.requestAnimationFrame(
        () => {

          window.requestAnimationFrame(
            () => {

              root.classList.add(
                "chaos-intro-running"
              );


              animateIntroPart(
                centerPrepared,
                {
                  drawDelay:
                    "--chaos-intro-center-draw-delay",

                  drawDuration:
                    "--chaos-intro-center-draw-duration",

                  drawEasing:
                    "--chaos-intro-center-draw-easing",

                  fillDelay:
                    "--chaos-intro-center-fill-delay",

                  fillDuration:
                    "--chaos-intro-center-fill-duration",

                  fillEasing:
                    "--chaos-intro-center-fill-easing",

                  strokeOutDelay:
                    "--chaos-intro-center-stroke-out-delay",

                  strokeOutDuration:
                    "--chaos-intro-center-stroke-out-duration",

                  strokeOutEasing:
                    "--chaos-intro-center-stroke-out-easing"
                }
              );


              animateIntroPart(
                tendrilsPrepared,
                {
                  drawDelay:
                    "--chaos-intro-tendrils-draw-delay",

                  drawDuration:
                    "--chaos-intro-tendrils-draw-duration",

                  drawEasing:
                    "--chaos-intro-tendrils-draw-easing",

                  fillDelay:
                    "--chaos-intro-tendrils-fill-delay",

                  fillDuration:
                    "--chaos-intro-tendrils-fill-duration",

                  fillEasing:
                    "--chaos-intro-tendrils-fill-easing",

                  strokeOutDelay:
                    "--chaos-intro-tendrils-stroke-out-delay",

                  strokeOutDuration:
                    "--chaos-intro-tendrils-stroke-out-duration",

                  strokeOutEasing:
                    "--chaos-intro-tendrils-stroke-out-easing"
                }
              );


              animateIntroNode(
                videoPrepared,
                "--chaos-intro-video-delay"
              );


              animateIntroNode(
                designPrepared,
                "--chaos-intro-design-delay"
              );


              animateIntroNode(
                audioPrepared,
                "--chaos-intro-audio-delay"
              );


              animateIntroNode(
                aiPrepared,
                "--chaos-intro-ai-delay"
              );


              animateIntroNode(
                resumePrepared,
                "--chaos-intro-resume-delay"
              );


              animateIntroNode(
                contextPrepared,
                "--chaos-intro-context-delay"
              );


              entranceFinishTimer =
                window.setTimeout(
                  finishFullIntro,
                  getFullIntroDuration() +
                    100
                );
            }
          );
        }
      );
    }



    /* =======================================================
       RETURNING VISITOR — PREPARE
       ======================================================= */

    function prepareReturningIntro() {

      if (chaosEye) {
        chaosEye.style.opacity =
          "0";
      }


      if (chaosTendrils) {
        chaosTendrils.style.opacity =
          "0";
      }


      for (
        const record
        of nodeRecords.values()
      ) {

        if (record.normal) {
          record.normal.style.opacity =
            "0";
        }


        if (
          record.normalBackground
        ) {

          record.normalBackground.style.opacity =
            "0";
        }
      }
    }



    /* =======================================================
       RETURNING VISITOR — GROUP FADE
       ======================================================= */

    function animateReturningGroup(
      elements,
      delayProperty,
      durationProperty,
      easingProperty
    ) {

      const delay =
        readCssTime(
          delayProperty
        );


      const duration =
        readCssTime(
          durationProperty
        );


      const easing =
        readCssValue(
          easingProperty,
          "ease"
        );


      elements
        .filter(Boolean)
        .forEach(
          element => {

            trackEntranceAnimation(
              element.animate(

                [
                  {
                    opacity: 0
                  },

                  {
                    opacity: 1
                  }
                ],

                {
                  delay,
                  duration,
                  easing,

                  fill:
                    "forwards"
                }
              )
            );
          }
        );
    }



    /* =======================================================
       RETURNING VISITOR — TOTAL DURATION
       ======================================================= */

    function getReturningIntroDuration() {

      const centerEnd =
        readCssTime(
          "--chaos-return-center-delay"
        ) +
        readCssTime(
          "--chaos-return-center-duration"
        );


      const tendrilsEnd =
        readCssTime(
          "--chaos-return-tendrils-delay"
        ) +
        readCssTime(
          "--chaos-return-tendrils-duration"
        );


      const nodesEnd =
        readCssTime(
          "--chaos-return-nodes-delay"
        ) +
        readCssTime(
          "--chaos-return-nodes-duration"
        );


      const settleEnd =
        readCssTime(
          "--chaos-return-settle-duration"
        );


      return Math.max(
        centerEnd,
        tendrilsEnd,
        nodesEnd,
        settleEnd
      );
    }



    /* =======================================================
       RETURNING VISITOR — FINISH
       ======================================================= */

    function finishReturningIntro() {

      clearEntranceTimer();


      /*
       * Write the permanent final state underneath
       * the fill-forwards animations first.
       */

      if (chaosEye) {
        chaosEye.style.opacity =
          "1";
      }


      if (chaosTendrils) {
        chaosTendrils.style.opacity =
          "1";
      }


      for (
        const record
        of nodeRecords.values()
      ) {

        if (record.normal) {
          record.normal.style.opacity =
            "1";
        }


        if (
          record.normalBackground
        ) {

          record.normalBackground.style.opacity =
            "1";
        }
      }


      cancelEntranceAnimations();


      svg.getAnimations()
        .forEach(
          animation => {

            try {
              animation.cancel();
            } catch (_) {}
          }
        );


      svg.style.transform =
        "translateY(0) scale(1)";


      window.requestAnimationFrame(
        () => {

          window.requestAnimationFrame(
            () => {

              root.classList.remove(
                "chaos-return-active",
                "chaos-return-running"
              );


              if (chaosEye) {
                chaosEye.style.opacity =
                  "";
              }


              if (chaosTendrils) {
                chaosTendrils.style.opacity =
                  "";
              }


              for (
                const record
                of nodeRecords.values()
              ) {

                if (record.normal) {
                  record.normal.style.opacity =
                    "";
                }


                if (
                  record.normalBackground
                ) {

                  record.normalBackground.style.opacity =
                    "";
                }
              }


              svg.style.transform =
                "";


              root.removeAttribute(
                "aria-busy"
              );


              root.dataset.chaosEntranceComplete =
                "true";


              /*
               * Reveal the replay Easter egg only after
               * the RETURNING-VISITOR entrance is complete.
               * The first-visit full intro never reveals it
               * during that same visit.
               */

              showIntroResetControls();
            }
          );
        }
      );
    }



    /* =======================================================
       RETURNING VISITOR — START
       ======================================================= */

    function startReturningIntro() {

      root.setAttribute(
        "aria-busy",
        "true"
      );


      root.classList.add(
        "chaos-return-active"
      );


      prepareReturningIntro();


      root.classList.remove(
        "chaos-intro-preparing"
      );


      if (
        reducedMotionQuery.matches
      ) {

        finishReturningIntro();

        return;
      }


      window.requestAnimationFrame(
        () => {

          window.requestAnimationFrame(
            () => {

              root.classList.add(
                "chaos-return-running"
              );


              /* ---------------- CENTER ---------------- */

              animateReturningGroup(
                [
                  chaosEye
                ],

                "--chaos-return-center-delay",

                "--chaos-return-center-duration",

                "--chaos-return-center-easing"
              );


              /* ------------- TENDRILS ---------------- */

              animateReturningGroup(
                [
                  chaosTendrils
                ],

                "--chaos-return-tendrils-delay",

                "--chaos-return-tendrils-duration",

                "--chaos-return-tendrils-easing"
              );


              /* ------------- ALL NODES --------------- */

              const nodeElements =
                [];


              for (
                const record
                of nodeRecords.values()
              ) {

                if (record.normal) {
                  nodeElements.push(
                    record.normal
                  );
                }


                if (
                  record.normalBackground
                ) {

                  nodeElements.push(
                    record.normalBackground
                  );
                }
              }


              animateReturningGroup(
                nodeElements,

                "--chaos-return-nodes-delay",

                "--chaos-return-nodes-duration",

                "--chaos-return-nodes-easing"
              );


              entranceFinishTimer =
                window.setTimeout(
                  finishReturningIntro,
                  getReturningIntroDuration() +
                    100
                );
            }
          );
        }
      );
    }



    /* =======================================================
       INITIAL INTERACTION STATE
       ======================================================= */

    resetNavigation();



    /* =======================================================
       CHOOSE ENTRANCE MODE
       ======================================================= */

    if (
      hasCompletedFullIntro()
    ) {

      startReturningIntro();

    } else {

      startFullIntro();
    }
  }



  /* =========================================================
     LOAD SVG + INITIALIZE
     ========================================================= */

  async function loadAndInitChaosNavigation(
    root
  ) {

    if (
      !root ||
      root.dataset.chaosLoadStarted ===
        "true"
    ) {
      return;
    }


    root.dataset.chaosLoadStarted =
      "true";


    /*
     * Hide BEFORE fetching so neither entrance mode can
     * ever begin with a completed-interface flash.
     */

    root.classList.add(
      "chaos-intro-preparing"
    );


    const svgUrl =
      root.dataset.chaosSvgUrl;


    if (!svgUrl) {

      root.classList.remove(
        "chaos-intro-preparing"
      );


      console.error(
        "Chaos navigation: data-chaos-svg-url is missing."
      );

      return;
    }


    try {

      const response =
        await fetch(
          svgUrl,
          {
            credentials:
              "same-origin",

            cache:
              "no-cache"
          }
        );


      if (!response.ok) {

        throw new Error(
          `SVG request failed: HTTP ${response.status} ${response.statusText}`
        );
      }


      const svgText =
        await response.text();


      if (
        !svgText.includes(
          "<svg"
        )
      ) {

        throw new Error(
          "The resource loaded, but it did not contain SVG markup."
        );
      }


      root.innerHTML =
        svgText;


      const svg =
        root.querySelector(
          "svg"
        );


      if (!svg) {

        throw new Error(
          "SVG text loaded, but the browser did not create an SVG element."
        );
      }


      svg.removeAttribute(
        "width"
      );


      svg.removeAttribute(
        "height"
      );


      svg.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
      );


      initChaosNavigation(
        root
      );


      console.info(
        "Chaos navigation: SVG loaded and initialized successfully."
      );


    } catch (error) {

      root.dataset.chaosLoadError =
        "true";


      root.classList.remove(
        "chaos-intro-preparing",
        "chaos-intro-active",
        "chaos-intro-running",
        "chaos-return-active",
        "chaos-return-running"
      );


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



  /* =========================================================
     INITIALIZE ALL INSTANCES
     ========================================================= */

  function initAllChaosNavigation() {

    /*
     * Install and hide replay controls before choosing
     * the entrance mode. The returning path will reveal
     * them only after its short entrance completes.
     */

    installIntroResetControls();

    hideIntroResetControls();


    document
      .querySelectorAll(
        "[data-chaos-navigation]"
      )
      .forEach(
        loadAndInitChaosNavigation
      );
  }



  /* =========================================================
     DOCUMENT READY
     ========================================================= */

  if (
    document.readyState ===
      "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initAllChaosNavigation,
      {
        once: true
      }
    );

  } else {

    initAllChaosNavigation();
  }

})();

return componentId;})(RWElements.rw3D67B462_70CF_4853_A96A_6BEBA046E08B);