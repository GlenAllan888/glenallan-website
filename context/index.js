

var RWElements={};

RWElements.rw6E45E7B5_073B_4B14_852B_77991D0DA416 = {};
RWElements.rw6E45E7B5_073B_4B14_852B_77991D0DA416 = (function(componentId) {
    
document.addEventListener('DOMContentLoaded', () => {

    const fields =
        document.querySelectorAll('.svg-field-effect');


    fields.forEach(field => {

        /* =================================================
           MEASURE EVERY SVG GEOMETRY ELEMENT
           ================================================= */

        const geometry =
            field.querySelectorAll(
                'svg path, svg line, svg polyline, svg polygon, svg rect, svg circle, svg ellipse'
            );

        geometry.forEach(element => {

            if (
                typeof element.getTotalLength ===
                'function'
            ) {

                const length =
                    element.getTotalLength();

                element.style.setProperty(
                    '--svg-path-length',
                    length
                );
            }
        });


        /* =================================================
           ACTIVATE WHEN FIELD ENTERS VIEWPORT
           ================================================= */

        const observer =
            new IntersectionObserver(

                entries => {

                    entries.forEach(entry => {

                        if (entry.isIntersecting) {

                            entry.target.classList.add(
                                'svg-field-active'
                            );

                        } else {

                            entry.target.classList.remove(
                                'svg-field-active'
                            );
                        }
                    });
                },

                {
                    threshold: 0.35
                }
            );


        observer.observe(field);
    });

});

return componentId;})(RWElements.rw6E45E7B5_073B_4B14_852B_77991D0DA416);
RWElements.rw62E419DA_8201_4C74_B625_90E6FDD01BF5 = {};
RWElements.rw62E419DA_8201_4C74_B625_90E6FDD01BF5 = (function(componentId) {
    
document.addEventListener('DOMContentLoaded', () => {

    const dividers =
        document.querySelectorAll('.svg-effects');


    /* =====================================================
       UTILITY — READ CSS TIME VALUES

       Supports:
       1200ms
       1.2s
       ===================================================== */

    const readTime = (element, property) => {

        const value = getComputedStyle(element)
            .getPropertyValue(property)
            .trim();

        if (!value) return 0;

        if (value.endsWith('ms')) {
            return parseFloat(value);
        }

        if (value.endsWith('s')) {
            return parseFloat(value) * 1000;
        }

        return parseFloat(value) || 0;
    };


    /* =====================================================
       UTILITY — READ PIXEL VALUES
       ===================================================== */

    const readPixels = (element, property) => {

        const value = getComputedStyle(element)
            .getPropertyValue(property)
            .trim();

        return parseFloat(value) || 0;
    };


    /* =====================================================
       ARROW GRADIENT GENERATION

       Creates a unique gradient for every arrow SVG.
       Reveal is handled entirely by CSS.
       ===================================================== */

    document.querySelectorAll('.svg-arrow-cue svg')
        .forEach((svg, index) => {

            const namespace =
                'http://www.w3.org/2000/svg';

            const wrapper =
                svg.closest('.svg-arrow-cue');

            if (!wrapper) return;


            /* ---------------------------------------------
               UNIQUE GRADIENT ID
               --------------------------------------------- */

            const gradientID =
                `svg-arrow-gradient-${index}`;


            /* ---------------------------------------------
               SVG DEFS
               --------------------------------------------- */

            let defs =
                svg.querySelector('defs');

            if (!defs) {

                defs =
                    document.createElementNS(
                        namespace,
                        'defs'
                    );

                svg.insertBefore(
                    defs,
                    svg.firstChild
                );
            }


            /* ---------------------------------------------
               VERTICAL GRADIENT
               --------------------------------------------- */

            const gradient =
                document.createElementNS(
                    namespace,
                    'linearGradient'
                );

            gradient.setAttribute(
                'id',
                gradientID
            );

            gradient.setAttribute('x1', '0%');
            gradient.setAttribute('y1', '0%');
            gradient.setAttribute('x2', '0%');
            gradient.setAttribute('y2', '100%');


            /* TOP STOP */

            const topStop =
                document.createElementNS(
                    namespace,
                    'stop'
                );

            topStop.setAttribute(
                'offset',
                '0%'
            );

            topStop.style.stopColor =
                'var(--arrow-gradient-top)';

            topStop.style.stopOpacity =
                'var(--arrow-gradient-top-opacity)';


            const midStop =
                document.createElementNS(
                    namespace,
                    'stop'
                );

            const midpoint =
                getComputedStyle(wrapper)
                    .getPropertyValue(
                        '--arrow-gradient-midpoint'
                )
                .trim() || '50%';

            midStop.setAttribute(
                'offset',
                midpoint
            );

            midStop.style.stopColor =
                'var(--arrow-gradient-mid)';

            midStop.style.stopOpacity =
                'var(--arrow-gradient-mid-opacity)';


            const bottomStop =
                document.createElementNS(
                    namespace,
                    'stop'
                );

            bottomStop.setAttribute(
                'offset',
                '100%'
                );

            bottomStop.style.stopColor =
                'var(--arrow-gradient-bottom)';

            bottomStop.style.stopOpacity =
                'var(--arrow-gradient-bottom-opacity)';


            gradient.appendChild(topStop);
            gradient.appendChild(midStop);
            gradient.appendChild(bottomStop);

            defs.appendChild(gradient);


            /* ---------------------------------------------
               APPLY GRADIENT TO ARROW GEOMETRY
               --------------------------------------------- */

            const shapes =
                svg.querySelectorAll(
                    'path, polygon, rect, circle, ellipse'
                );

            shapes.forEach(shape => {

                shape.style.fill =
                    `url(#${gradientID})`;

                shape.style.stroke =
                    'none';
            });
        });


    /* =====================================================
       DIVIDER INITIALIZATION
       ===================================================== */

    dividers.forEach(divider => {


        /* ---------------------------------------------
           MEASURE DIVIDER SVG GEOMETRY
           --------------------------------------------- */

        const geometry =
            divider.querySelectorAll(
                'svg path, svg line, svg polyline, svg polygon, svg rect, svg circle, svg ellipse'
            );

        geometry.forEach(element => {

            if (
                typeof element.getTotalLength ===
                'function'
            ) {

                const length =
                    element.getTotalLength();

                element.style.setProperty(
                    '--svg-path-length',
                    length
                );
            }
        });


        /* ---------------------------------------------
           FIND PAGEFLOW SLIDE + ARROW
           --------------------------------------------- */

        const slide =
            divider.closest('.pageflow-slide');

        if (!slide) return;


        const arrow =
            slide.querySelector('.svg-arrow-cue');


        let sequenceToken = 0;
        let currentBounce = null;


        /* =================================================
           ARROW BOUNCE LOOP

           DOWN
           RETURN
           DOWN
           RETURN
           PAUSE
           REPEAT
           ================================================= */

        const startArrowLoop = async token => {

            if (!arrow) return;


            const startDelay =
                readTime(
                    arrow,
                    '--arrow-bounce-start-delay'
                );

            const bounceDuration =
                readTime(
                    arrow,
                    '--arrow-bounce-duration'
                );

            const bouncePause =
                readTime(
                    arrow,
                    '--arrow-bounce-pause'
                );

            const distanceFirst =
                readPixels(
                    arrow,
                    '--arrow-bounce-distance-first'
                );

            const distanceSecond =
                readPixels(
                    arrow,
                    '--arrow-bounce-distance-second'
                );


            /* -----------------------------------------
               WAIT UNTIL ARROW SHOULD BEGIN BOUNCING
               ----------------------------------------- */

            await new Promise(resolve =>
                setTimeout(
                    resolve,
                    startDelay
                )
            );


            /* -----------------------------------------
               REPEAT WHILE THIS SLIDE REMAINS ACTIVE
               ----------------------------------------- */

            while (
                token === sequenceToken &&
                slide.classList.contains(
                    'svg-sequence-active'
                )
            ) {

                currentBounce =
                    arrow.animate(

                        [
                            {
                                transform:
                                    'translateY(0)',
                                offset: 0
                            },

                            {
                                transform:
                                    `translateY(${distanceFirst}px)`,
                                offset: 0.20
                            },

                            {
                                transform:
                                    'translateY(0)',
                                offset: 0.40
                            },

                            {
                                transform:
                                    `translateY(${distanceSecond}px)`,
                                offset: 0.60
                            },

                            {
                                transform:
                                    'translateY(0)',
                                offset: 1
                            }
                        ],

                        {
                            duration:
                                bounceDuration,

                            easing:
                                'ease-in-out',

                            fill:
                                'none'
                        }
                    );


                try {

                    await currentBounce.finished;

                } catch (_) {

                    return;
                }


                /* -------------------------------------
                   PAUSE BETWEEN PAIRS
                   ------------------------------------- */

                await new Promise(resolve =>
                    setTimeout(
                        resolve,
                        bouncePause
                    )
                );
            }
        };


        /* =================================================
           VIEWPORT / SLIDE OBSERVER
           ================================================= */

        const observer =
            new IntersectionObserver(

                entries => {

                    entries.forEach(entry => {


                        /* ------------------------------
                           ENTER
                           ------------------------------ */

                        if (entry.isIntersecting) {

                            /*
                             * Invalidates any previous
                             * asynchronous sequence.
                             */

                            sequenceToken++;

                            const token =
                                sequenceToken;


                            /*
                             * This single class now:
                             *
                             * - activates divider animation
                             * - activates arrow CSS reveal
                             */

                            slide.classList.add(
                                'svg-sequence-active'
                            );


                            /*
                             * Bounce begins independently
                             * according to its CSS delay.
                             */

                            startArrowLoop(token);
                        }


                        /* ------------------------------
                           LEAVE
                           ------------------------------ */

                        else {

                            /*
                             * Immediately invalidate
                             * current bounce loop.
                             */

                            sequenceToken++;


                            /*
                             * Removing this class resets
                             * the CSS arrow reveal and
                             * divider sequence.
                             */

                            slide.classList.remove(
                                'svg-sequence-active'
                            );


                            /*
                             * Kill active bounce animation.
                             */

                            if (currentBounce) {

                                currentBounce.cancel();

                                currentBounce = null;
                            }
                        }
                    });
                },

                {
                    threshold: 0.35
                }
            );


        observer.observe(divider);
    });

});

return componentId;})(RWElements.rw62E419DA_8201_4C74_B625_90E6FDD01BF5);
RWElements.rw68470102_25D3_4E0E_AA37_39C045377C31 = {};
RWElements.rw68470102_25D3_4E0E_AA37_39C045377C31 = (function(componentId) {
    
document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================
       MAIN CONTEXT MAP
       ===================================================== */

    const roots =
        document.querySelectorAll(
            '.context-map-animation'
        );

    if (!roots.length) return;



    /* =====================================================
       CONSTRUCTION PAINT ORDER

       IMPORTANT:
       Chaos Field overlays do NOT live here.

       They are triggered by the purple fill of their
       corresponding base geometry so they do not alter
       the construction cadence.
       ===================================================== */

    const paintOrder = [

        'text_0',
        'inner-circle',

        'ring_1',
        'dotted-ring_1',

        'dotted-ring_2',
        'ring-band',
        'dotted-ring_3',

        'spoke_1',
        'outer-ring_1',
        'outer-dotted-ring_1',
        'outer-circle_1',
        'text_1',

        'spoke_2',
        'outer-ring_2',
        'outer-dotted-ring_2',
        'outer-circle_2',
        'text_2',

        'spoke_3',
        'outer-ring_3',
        'outer-dotted-ring_3',
        'outer-circle_3',
        'text_3',

        'spoke_4',
        'outer-ring_4',
        'outer-dotted-ring_4',
        'outer-circle_4',
        'text_4',

        'spoke_5',
        'outer-ring_5',
        'outer-dotted-ring_5',
        'outer-circle_5',
        'text_5',

        'spoke_6',
        'outer-ring_6',
        'outer-dotted-ring_6',
        'outer-circle_6',
        'text_6',

        'spoke_7',
        'outer-ring_7',
        'outer-dotted-ring_7',
        'outer-circle_7',
        'text_7',

        'spoke_8',
        'outer-ring_8',
        'outer-dotted-ring_8',
        'outer-circle_8',
        'text_8',

        'spoke_9',
        'outer-ring_9',
        'outer-dotted-ring_9',
        'outer-circle_9',
        'text_9',

        'spoke_10',
        'outer-ring_10',
        'outer-dotted-ring_10',
        'outer-circle_10',
        'text_10'
    ];



    /* =====================================================
       OVERLAY PAIRS
       ===================================================== */

    const overlayMap = {

        'inner-circle':
            'inner-circle-overlay',

        'ring-band':
            'ring-band-overlay',

        'outer-circle_1':
            'outer-circle-overlay_1',

        'outer-circle_2':
            'outer-circle-overlay_2',

        'outer-circle_3':
            'outer-circle-overlay_3',

        'outer-circle_4':
            'outer-circle-overlay_4',

        'outer-circle_5':
            'outer-circle-overlay_5',

        'outer-circle_6':
            'outer-circle-overlay_6',

        'outer-circle_7':
            'outer-circle-overlay_7',

        'outer-circle_8':
            'outer-circle-overlay_8',

        'outer-circle_9':
            'outer-circle-overlay_9',

        'outer-circle_10':
            'outer-circle-overlay_10'
    };


    const overlayClasses =
        Object.values(
            overlayMap
        );



    /* =====================================================
       UTILITIES
       ===================================================== */

    const readCSS = (
        element,
        property,
        fallback = ''
    ) => {

        const value =
            getComputedStyle(element)
                .getPropertyValue(property)
                .trim();

        return value || fallback;
    };


    const readTime = (
        element,
        property
    ) => {

        const value =
            readCSS(
                element,
                property,
                '0ms'
            );

        if (value.endsWith('ms')) {
            return parseFloat(value) || 0;
        }

        if (value.endsWith('s')) {
            return (
                (parseFloat(value) || 0) *
                1000
            );
        }

        return parseFloat(value) || 0;
    };


    const readNumber = (
        element,
        property,
        fallback = 0
    ) => {

        const value =
            parseFloat(
                readCSS(
                    element,
                    property,
                    `${fallback}`
                )
            );

        return Number.isFinite(value)
            ? value
            : fallback;
    };


    const wait = ms =>
        new Promise(resolve =>
            setTimeout(
                resolve,
                ms
            )
        );


    const isSpoke =
        element => {

            if (!element) return false;

            return Array.from(
                element.classList
            ).some(className =>
                /^spoke_\d+$/.test(
                    className
                )
            );
        };



    /* =====================================================
       DETERMINE LAYER TYPE
       ===================================================== */

    const getType =
        className => {

            if (
                /^text_\d+$/.test(
                    className
                )
            ) {
                return 'text';
            }

            if (
                className ===
                'inner-circle'
            ) {
                return 'inner-circle';
            }

            if (
                className ===
                'ring-band'
            ) {
                return 'ring-band';
            }

            if (
                /^ring_\d+$/.test(
                    className
                )
            ) {
                return 'ring';
            }

            if (
                /^dotted-ring_\d+$/.test(
                    className
                )
            ) {
                return 'dotted-ring';
            }

            if (
                /^spoke_\d+$/.test(
                    className
                )
            ) {
                return 'spoke';
            }

            if (
                /^outer-ring_\d+$/.test(
                    className
                )
            ) {
                return 'outer-ring';
            }

            if (
                /^outer-dotted-ring_\d+$/.test(
                    className
                )
            ) {
                return 'outer-dotted-ring';
            }

            if (
                /^outer-circle_\d+$/.test(
                    className
                )
            ) {
                return 'outer-circle';
            }

            return 'unknown';
        };



    /* =====================================================
       GET TIMING
       ===================================================== */

    const getTiming = (
        root,
        type
    ) => {

        if (type === 'text') {

            return {

                drawDuration:
                    readTime(
                        root,
                        '--cm-text-draw-duration'
                    ),

                drawEasing:
                    readCSS(
                        root,
                        '--cm-text-draw-easing',
                        'linear'
                    ),

                fillDelay:
                    readTime(
                        root,
                        '--cm-text-fill-delay'
                    ),

                fillDuration:
                    readTime(
                        root,
                        '--cm-text-fill-duration'
                    ),

                fillEasing:
                    readCSS(
                        root,
                        '--cm-text-fill-easing',
                        'ease'
                    ),

                darkenDelay:
                    readTime(
                        root,
                        '--cm-text-darken-delay'
                    ),

                darkenDuration:
                    readTime(
                        root,
                        '--cm-text-darken-duration'
                    ),

                darkenEasing:
                    readCSS(
                        root,
                        '--cm-text-darken-easing',
                        'ease'
                    ),

                shadowDelay:
                    readTime(
                        root,
                        '--cm-text-shadow-delay'
                    ),

                shadowDuration:
                    readTime(
                        root,
                        '--cm-text-shadow-duration'
                    ),

                shadowEasing:
                    readCSS(
                        root,
                        '--cm-text-shadow-easing',
                        'ease'
                    ),

                advance:
                    readTime(
                        root,
                        '--cm-text-advance'
                    )
            };
        }


        const prefix =
            `--cm-${type}`;


        return {

            drawDuration:
                readTime(
                    root,
                    `${prefix}-draw-duration`
                ),

            drawEasing:
                readCSS(
                    root,
                    `${prefix}-draw-easing`,
                    'linear'
                ),

            fillDelay:
                readTime(
                    root,
                    `${prefix}-fill-delay`
                ),

            fillDuration:
                readTime(
                    root,
                    `${prefix}-fill-duration`
                ),

            fillEasing:
                readCSS(
                    root,
                    `${prefix}-fill-easing`,
                    'ease'
                ),

            advance:
                readTime(
                    root,
                    `${prefix}-advance`
                )
        };
    };



    /* =====================================================
       INITIALIZE EACH MAP
       ===================================================== */

    roots.forEach(
        (root, rootIndex) => {

            const svg =
                root.matches('svg')
                    ? root
                    : root.querySelector('svg');


            if (!svg) return;


            const slide =
                root.closest(
                    '.pageflow-slide'
                );


            const overlay =
                slide
                    ? slide.querySelector(
                        '.context-nav-overlay'
                    )
                    : document.querySelector(
                        '.context-nav-overlay'
                    );


            const navText =
                overlay
                    ? overlay.querySelector(
                        '.context-nav-instruction'
                    )
                    : null;


            const navArrow =
                overlay
                    ? overlay.querySelector(
                        '.context-nav-arrow'
                    )
                    : null;


            let sequenceToken = 0;
            let slideIsActive = false;


            const runningAnimations =
                new Set();



            /* =================================================
               ANIMATION TRACKING
               ================================================= */

            const trackAnimation =
                animation => {

                    runningAnimations.add(
                        animation
                    );

                    animation.finished
                        .catch(() => {});

                    return animation;
                };


            const cancelAnimations =
                () => {

                    runningAnimations.forEach(
                        animation => {

                            try {
                                animation.cancel();
                            } catch (_) {}
                        }
                    );

                    runningAnimations.clear();
                };



            /* =================================================
               RESET STANDARD MAP LAYER
               ================================================= */

            const resetLayer =
                element => {

                    if (!element) return;


                    const black =
                        readCSS(
                            root,
                            '--cm-black',
                            '#000000'
                        );


                    element.style.fill =
                        black;

                    element.style.stroke =
                        black;

                    element.style.filter =
                        '';


                    /*
                     * Spokes are invisible until
                     * their own construction begins.
                     */

                    element.style.opacity =
                        isSpoke(element)
                            ? '0'
                            : '1';


                    if (
                        typeof element.getTotalLength ===
                        'function'
                    ) {

                        const length =
                            element.getTotalLength();


                        const hiddenLength =
                            length * 1.025;


                        element.style.strokeDasharray =
                            `${hiddenLength} ${hiddenLength}`;


                        element.style.strokeDashoffset =
                            `${hiddenLength}`;
                    }
                };



            /* =================================================
               RESET CHAOS FIELD OVERLAY
               ================================================= */

            const resetOverlay =
                element => {

                    if (!element) return;


                    element.style.fill =
                        readCSS(
                            root,
                            '--cm-overlay-color',
                            '#1b003d'
                        );


                    element.style.stroke =
                        'none';


                    element.style.opacity =
                        '0';


                    element.style.filter =
                        '';


                    element.style.strokeDasharray =
                        'none';


                    element.style.strokeDashoffset =
                        '0';
                };



            /* =================================================
               ANIMATE CHAOS FIELD OVERLAY
               ================================================= */

            const animateOverlay = (
                baseClassName,
                baseFillDelay,
                token
            ) => {

                const overlayClass =
                    overlayMap[
                        baseClassName
                    ];


                if (!overlayClass) {
                    return;
                }


                const element =
                    svg.querySelector(
                        `.${overlayClass}`
                    );


                if (!element) {
                    return;
                }


                const overlayDelay =
                    readTime(
                        root,
                        '--cm-overlay-delay'
                    );


                const overlayDuration =
                    readTime(
                        root,
                        '--cm-overlay-duration'
                    );


                const overlayEasing =
                    readCSS(
                        root,
                        '--cm-overlay-easing',
                        'ease'
                    );


                const overlayOpacity =
                    readNumber(
                        root,
                        '--cm-overlay-opacity',
                        .55
                    );


                const overlayColor =
                    readCSS(
                        root,
                        '--cm-overlay-color',
                        '#1b003d'
                    );


                /*
                 * Delay is relative to PURPLE FILL START.
                 */

                setTimeout(
                    () => {

                        if (
                            token !== sequenceToken ||
                            !slideIsActive
                        ) {
                            return;
                        }


                        element.style.fill =
                            overlayColor;

                        element.style.stroke =
                            'none';


                        trackAnimation(
                            element.animate(

                                [
                                    {
                                        opacity: 0
                                    },

                                    {
                                        opacity:
                                            overlayOpacity
                                    }
                                ],

                                {
                                    duration:
                                        overlayDuration,

                                    easing:
                                        overlayEasing,

                                    fill:
                                        'forwards'
                                }
                            )
                        );

                    },

                    baseFillDelay +
                    overlayDelay
                );
            };



            /* =================================================
               REMOVE GENERATED ARROW GRADIENT COPIES
               ================================================= */

            const removeArrowGradientOverlays =
                () => {

                    if (!navArrow) return;


                    navArrow
                        .querySelectorAll(
                            '[data-context-gradient-overlay]'
                        )
                        .forEach(
                            element => {

                                element.remove();
                            }
                        );
                };



            /* =================================================
               RESET NAVIGATION
               ================================================= */

            const resetNavigation =
                () => {

                    if (navText) {

                        navText.style.opacity =
                            '0';

                        navText.style.visibility =
                            'hidden';

                        navText.style.transform =
                            '';
                    }


                    if (navArrow) {

                        navArrow.style.opacity =
                            '0';

                        navArrow.style.visibility =
                            'hidden';

                        navArrow.style.transform =
                            'translateY(0)';


                        navArrow
                            .getAnimations({
                                subtree: true
                            })
                            .forEach(
                                animation => {

                                    try {
                                        animation.cancel();
                                    } catch (_) {}
                                }
                            );


                        removeArrowGradientOverlays();


                        const shapes =
                            navArrow.querySelectorAll(
                                `
                                svg path:not([data-context-gradient-overlay]),
                                svg polygon:not([data-context-gradient-overlay]),
                                svg polyline:not([data-context-gradient-overlay]),
                                svg rect:not([data-context-gradient-overlay]),
                                svg circle:not([data-context-gradient-overlay]),
                                svg ellipse:not([data-context-gradient-overlay])
                                `
                            );


                        shapes.forEach(
                            shape => {

                                shape.style.fill =
                                    '';

                                shape.style.stroke =
                                    '';

                                shape.style.strokeWidth =
                                    '';

                                shape.style.strokeDasharray =
                                    '';

                                shape.style.strokeDashoffset =
                                    '';

                                shape.style.filter =
                                    '';
                            }
                        );
                    }
                };



            /* =================================================
               COMPLETE HARD RESET
               ================================================= */

            const resetMap =
                () => {

                    cancelAnimations();


                    paintOrder.forEach(
                        className => {

                            resetLayer(
                                svg.querySelector(
                                    `.${className}`
                                )
                            );
                        }
                    );


                    overlayClasses.forEach(
                        className => {

                            resetOverlay(
                                svg.querySelector(
                                    `.${className}`
                                )
                            );
                        }
                    );


                    root.style.opacity =
                        '1';


                    resetNavigation();
                };



            /* =================================================
               DRAW NON-TEXT GEOMETRY
               ================================================= */

            const animateGeometry = (
                element,
                timing,
                token,
                className
            ) => {

                if (!element) return;


                /*
                 * Spokes become visible only when
                 * their own animation begins.
                 */

                if (
                    isSpoke(element)
                ) {

                    element.style.opacity =
                        '1';
                }


                const green =
                    readCSS(
                        root,
                        '--cm-green',
                        '#18ff1c'
                    );


                const purple =
                    readCSS(
                        root,
                        '--cm-purple',
                        '#6900e5'
                    );


                const black =
                    readCSS(
                        root,
                        '--cm-black',
                        '#000000'
                    );


                if (
                    typeof element.getTotalLength ===
                    'function'
                ) {

                    const length =
                        element.getTotalLength();


                    const hiddenLength =
                        length * 1.025;


                    element.style.stroke =
                        green;


                    trackAnimation(
                        element.animate(

                            [
                                {
                                    strokeDashoffset:
                                        `${hiddenLength}`
                                },

                                {
                                    strokeDashoffset:
                                        '0'
                                }
                            ],

                            {
                                duration:
                                    timing.drawDuration,

                                easing:
                                    timing.drawEasing,

                                fill:
                                    'forwards'
                            }
                        )
                    );
                }



                /* -----------------------------------------
                   PURPLE FILL
                   ----------------------------------------- */

                setTimeout(
                    () => {

                        if (
                            token !== sequenceToken
                        ) {
                            return;
                        }


                        trackAnimation(
                            element.animate(

                                [
                                    {
                                        fill:
                                            black
                                    },

                                    {
                                        fill:
                                            purple
                                    }
                                ],

                                {
                                    duration:
                                        timing.fillDuration,

                                    easing:
                                        timing.fillEasing,

                                    fill:
                                        'forwards'
                                }
                            )
                        );

                    },

                    timing.fillDelay
                );



                /*
                 * If this geometry owns a Chaos Field,
                 * begin that texture shortly after the
                 * purple fill starts.
                 */

                animateOverlay(
                    className,
                    timing.fillDelay,
                    token
                );
            };



            /* =================================================
               DRAW TEXT
               ================================================= */

            const animateText = (
                element,
                timing,
                token
            ) => {

                if (!element) return;


                const green =
                    readCSS(
                        root,
                        '--cm-green',
                        '#18ff1c'
                    );


                const black =
                    readCSS(
                        root,
                        '--cm-black',
                        '#000000'
                    );


                const shadowStart =
                    readCSS(
                        root,
                        '--cm-text-shadow-start',
                        'none'
                    );


                const shadow =
                    readCSS(
                        root,
                        '--cm-text-shadow',
                        'none'
                    );


                if (
                    typeof element.getTotalLength ===
                    'function'
                ) {

                    const length =
                        element.getTotalLength();


                    const hiddenLength =
                        length * 1.025;


                    element.style.stroke =
                        green;


                    trackAnimation(
                        element.animate(

                            [
                                {
                                    strokeDashoffset:
                                        `${hiddenLength}`
                                },

                                {
                                    strokeDashoffset:
                                        '0'
                                }
                            ],

                            {
                                duration:
                                    timing.drawDuration,

                                easing:
                                    timing.drawEasing,

                                fill:
                                    'forwards'
                            }
                        )
                    );
                }



                /* GREEN FILL */

                setTimeout(
                    () => {

                        if (
                            token !== sequenceToken
                        ) return;


                        trackAnimation(
                            element.animate(

                                [
                                    {
                                        fill:
                                            black
                                    },

                                    {
                                        fill:
                                            green
                                    }
                                ],

                                {
                                    duration:
                                        timing.fillDuration,

                                    easing:
                                        timing.fillEasing,

                                    fill:
                                        'forwards'
                                }
                            )
                        );

                    },

                    timing.fillDelay
                );



                /* GREEN STROKE → BLACK */

                setTimeout(
                    () => {

                        if (
                            token !== sequenceToken
                        ) return;


                        trackAnimation(
                            element.animate(

                                [
                                    {
                                        stroke:
                                            green
                                    },

                                    {
                                        stroke:
                                            black
                                    }
                                ],

                                {
                                    duration:
                                        timing.darkenDuration,

                                    easing:
                                        timing.darkenEasing,

                                    fill:
                                        'forwards'
                                }
                            )
                        );

                    },

                    timing.darkenDelay
                );



                /* DROP SHADOW */

                setTimeout(
                    () => {

                        if (
                            token !== sequenceToken
                        ) return;


                        trackAnimation(
                            element.animate(

                                [
                                    {
                                        filter:
                                            shadowStart
                                    },

                                    {
                                        filter:
                                            shadow
                                    }
                                ],

                                {
                                    duration:
                                        timing.shadowDuration,

                                    easing:
                                        timing.shadowEasing,

                                    fill:
                                        'forwards'
                                }
                            )
                        );

                    },

                    timing.shadowDelay
                );
            };



            /* =================================================
               BUILD NAV ARROW
               ================================================= */

            const initializeArrow =
                () => {

                    if (!navArrow) return;


                    const arrowSvg =
                        navArrow.querySelector(
                            'svg'
                        );


                    if (!arrowSvg) return;


                    const namespace =
                        'http://www.w3.org/2000/svg';


                    const make =
                        tag =>
                            document.createElementNS(
                                namespace,
                                tag
                            );


                    let defs =
                        arrowSvg.querySelector(
                            'defs'
                        );


                    if (!defs) {

                        defs =
                            make('defs');


                        arrowSvg.insertBefore(
                            defs,
                            arrowSvg.firstChild
                        );
                    }



                    /* -----------------------------------------
                       GRADIENT
                       ----------------------------------------- */

                    const gradientID =
                        `context-nav-gradient-${rootIndex}`;


                    let gradient =
                        arrowSvg.querySelector(
                            `#${gradientID}`
                        );


                    if (!gradient) {

                        gradient =
                            make(
                                'linearGradient'
                            );


                        gradient.setAttribute(
                            'id',
                            gradientID
                        );


                        defs.appendChild(
                            gradient
                        );
                    }


                    gradient.setAttribute(
                        'x1',
                        '0%'
                    );

                    gradient.setAttribute(
                        'y1',
                        '0%'
                    );

                    gradient.setAttribute(
                        'x2',
                        '0%'
                    );

                    gradient.setAttribute(
                        'y2',
                        '100%'
                    );


                    while (
                        gradient.firstChild
                    ) {

                        gradient.removeChild(
                            gradient.firstChild
                        );
                    }


                    const addStop = (
                        offset,
                        colorProperty,
                        opacityProperty,
                        fallbackColor
                    ) => {

                        const stop =
                            make('stop');


                        stop.setAttribute(
                            'offset',
                            offset
                        );


                        stop.setAttribute(
                            'stop-color',
                            readCSS(
                                root,
                                colorProperty,
                                fallbackColor
                            )
                        );


                        stop.setAttribute(
                            'stop-opacity',
                            readCSS(
                                root,
                                opacityProperty,
                                '1'
                            )
                        );


                        gradient.appendChild(
                            stop
                        );
                    };


                    addStop(
                        '0%',
                        '--cm-nav-arrow-gradient-top',
                        '--cm-nav-arrow-gradient-top-opacity',
                        '#000000'
                    );


                    addStop(
                        readCSS(
                            root,
                            '--cm-nav-arrow-gradient-midpoint',
                            '50%'
                        ),
                        '--cm-nav-arrow-gradient-mid',
                        '--cm-nav-arrow-gradient-mid-opacity',
                        'rgba(0,0,0,.29)'
                    );


                    addStop(
                        '100%',
                        '--cm-nav-arrow-gradient-bottom',
                        '--cm-nav-arrow-gradient-bottom-opacity',
                        '#52ff02'
                    );


                    navArrow
                        ._contextGradientID =
                            gradientID;



                    /* -----------------------------------------
                       THREE-LAYER INNER SHADOW
                       ----------------------------------------- */

                    const filterID =
                        `context-nav-inner-shadow-${rootIndex}`;


                    const oldFilter =
                        arrowSvg.querySelector(
                            `#${filterID}`
                        );


                    if (oldFilter) {
                        oldFilter.remove();
                    }


                    const filter =
                        make('filter');


                    filter.setAttribute(
                        'id',
                        filterID
                    );

                    filter.setAttribute(
                        'x',
                        '-50%'
                    );

                    filter.setAttribute(
                        'y',
                        '-50%'
                    );

                    filter.setAttribute(
                        'width',
                        '200%'
                    );

                    filter.setAttribute(
                        'height',
                        '200%'
                    );


                    const shadowResults =
                        [];


                    const addInnerShadow =
                        layer => {

                            const blurResult =
                                `innerBlur${layer}`;

                            const offsetResult =
                                `innerOffset${layer}`;

                            const edgeResult =
                                `innerEdge${layer}`;

                            const floodResult =
                                `innerColor${layer}`;

                            const finalResult =
                                `innerShadow${layer}`;


                            const blur =
                                make(
                                    'feGaussianBlur'
                                );


                            blur.setAttribute(
                                'in',
                                'SourceAlpha'
                            );


                            blur.setAttribute(
                                'stdDeviation',
                                readNumber(
                                    root,
                                    `--cm-nav-arrow-inner-shadow-${layer}-blur`,
                                    layer === 1
                                        ? 1.5
                                        : layer === 2
                                            ? 3
                                            : 6
                                )
                            );


                            blur.setAttribute(
                                'result',
                                blurResult
                            );


                            const offset =
                                make(
                                    'feOffset'
                                );


                            offset.setAttribute(
                                'in',
                                blurResult
                            );


                            offset.setAttribute(
                                'dx',
                                readNumber(
                                    root,
                                    `--cm-nav-arrow-inner-shadow-${layer}-offset-x`,
                                    0
                                )
                            );


                            offset.setAttribute(
                                'dy',
                                readNumber(
                                    root,
                                    `--cm-nav-arrow-inner-shadow-${layer}-offset-y`,
                                    layer === 1
                                        ? .5
                                        : layer === 2
                                            ? 1
                                            : 1.5
                                )
                            );


                            offset.setAttribute(
                                'result',
                                offsetResult
                            );


                            const edge =
                                make(
                                    'feComposite'
                                );


                            edge.setAttribute(
                                'in',
                                'SourceAlpha'
                            );


                            edge.setAttribute(
                                'in2',
                                offsetResult
                            );


                            edge.setAttribute(
                                'operator',
                                'out'
                            );


                            edge.setAttribute(
                                'result',
                                edgeResult
                            );


                            const flood =
                                make(
                                    'feFlood'
                                );


                            flood.setAttribute(
                                'flood-color',
                                readCSS(
                                    root,
                                    '--cm-nav-arrow-inner-shadow-color',
                                    '#000000'
                                )
                            );


                            flood.setAttribute(
                                'flood-opacity',
                                readNumber(
                                    root,
                                    `--cm-nav-arrow-inner-shadow-${layer}-opacity`,
                                    layer === 1
                                        ? 1
                                        : layer === 2
                                            ? .85
                                            : .55
                                )
                            );


                            flood.setAttribute(
                                'result',
                                floodResult
                            );


                            const color =
                                make(
                                    'feComposite'
                                );


                            color.setAttribute(
                                'in',
                                floodResult
                            );


                            color.setAttribute(
                                'in2',
                                edgeResult
                            );


                            color.setAttribute(
                                'operator',
                                'in'
                            );


                            color.setAttribute(
                                'result',
                                finalResult
                            );


                            filter.appendChild(
                                blur
                            );

                            filter.appendChild(
                                offset
                            );

                            filter.appendChild(
                                edge
                            );

                            filter.appendChild(
                                flood
                            );

                            filter.appendChild(
                                color
                            );


                            shadowResults.push(
                                finalResult
                            );
                        };


                    addInnerShadow(1);
                    addInnerShadow(2);
                    addInnerShadow(3);


                    const merge =
                        make(
                            'feMerge'
                        );


                    const sourceNode =
                        make(
                            'feMergeNode'
                        );


                    sourceNode.setAttribute(
                        'in',
                        'SourceGraphic'
                    );


                    merge.appendChild(
                        sourceNode
                    );


                    shadowResults.forEach(
                        result => {

                            const node =
                                make(
                                    'feMergeNode'
                                );


                            node.setAttribute(
                                'in',
                                result
                            );


                            merge.appendChild(
                                node
                            );
                        }
                    );


                    filter.appendChild(
                        merge
                    );


                    defs.appendChild(
                        filter
                    );


                    navArrow
                        ._contextInnerShadowID =
                            filterID;
                };


            initializeArrow();



            /* =================================================
               ARROW BOUNCE
               ================================================= */

            const startArrowBounce =
                async token => {

                    if (!navArrow) return;


                    const initialDelay =
                        readTime(
                            root,
                            '--cm-nav-arrow-bounce-delay'
                        );


                    const duration =
                        readTime(
                            root,
                            '--cm-nav-arrow-bounce-duration'
                        );


                    const pause =
                        readTime(
                            root,
                            '--cm-nav-arrow-bounce-pause'
                        );


                    const first =
                        readNumber(
                            root,
                            '--cm-nav-arrow-bounce-first',
                            11
                        );


                    const second =
                        readNumber(
                            root,
                            '--cm-nav-arrow-bounce-second',
                            6
                        );


                    await wait(
                        initialDelay
                    );


                    while (
                        token === sequenceToken &&
                        slideIsActive
                    ) {

                        const animation =
                            navArrow.animate(

                                [
                                    {
                                        transform:
                                            'translateY(0)',
                                        offset: 0
                                    },

                                    {
                                        transform:
                                            `translateY(${first}px)`,
                                        offset: .20
                                    },

                                    {
                                        transform:
                                            'translateY(0)',
                                        offset: .40
                                    },

                                    {
                                        transform:
                                            `translateY(${second}px)`,
                                        offset: .62
                                    },

                                    {
                                        transform:
                                            'translateY(0)',
                                        offset: 1
                                    }
                                ],

                                {
                                    duration,
                                    easing:
                                        'ease-in-out'
                                }
                            );


                        trackAnimation(
                            animation
                        );


                        try {
                            await animation.finished;
                        } catch (_) {
                            return;
                        }


                        await wait(
                            pause
                        );
                    }
                };



            /* =================================================
               NAVIGATION OUTRO
               ================================================= */

            const showNavigation =
                async token => {

                    const hold =
                        readTime(
                            root,
                            '--cm-nav-hold-duration'
                        );


                    await wait(
                        hold
                    );


                    if (
                        token !== sequenceToken ||
                        !slideIsActive
                    ) {
                        return;
                    }



                    /* DIM MAP */

                    const dimOpacity =
                        readNumber(
                            root,
                            '--cm-map-dim-opacity',
                            .15
                        );


                    const dimDuration =
                        readTime(
                            root,
                            '--cm-map-dim-duration'
                        );


                    const dimEasing =
                        readCSS(
                            root,
                            '--cm-map-dim-easing',
                            'ease'
                        );


                    trackAnimation(
                        root.animate(

                            [
                                {
                                    opacity: 1
                                },

                                {
                                    opacity:
                                        dimOpacity
                                }
                            ],

                            {
                                duration:
                                    dimDuration,

                                easing:
                                    dimEasing,

                                fill:
                                    'forwards'
                            }
                        )
                    );



                    /* NAV TEXT */

                    if (navText) {

                        navText.style.visibility =
                            'visible';


                        await wait(
                            readTime(
                                root,
                                '--cm-nav-text-delay'
                            )
                        );


                        if (
                            token !== sequenceToken ||
                            !slideIsActive
                        ) {
                            return;
                        }


                        const offset =
                            readCSS(
                                root,
                                '--cm-nav-text-start-offset',
                                '8px'
                            );


                        trackAnimation(
                            navText.animate(

                                [
                                    {
                                        opacity: 0,

                                        transform:
                                            `translateY(${offset})`
                                    },

                                    {
                                        opacity: 1,

                                        transform:
                                            'translateY(0)'
                                    }
                                ],

                                {
                                    duration:
                                        readTime(
                                            root,
                                            '--cm-nav-text-duration'
                                        ),

                                    easing:
                                        readCSS(
                                            root,
                                            '--cm-nav-text-easing',
                                            'ease'
                                        ),

                                    fill:
                                        'forwards'
                                }
                            )
                        );
                    }



                    /* NAV ARROW */

                    if (navArrow) {

                        await wait(
                            readTime(
                                root,
                                '--cm-nav-arrow-delay'
                            )
                        );


                        if (
                            token !== sequenceToken ||
                            !slideIsActive
                        ) {
                            return;
                        }


                        navArrow.style.visibility =
                            'visible';


                        navArrow.style.opacity =
                            '1';


                        removeArrowGradientOverlays();


                        const shapes =
                            navArrow.querySelectorAll(
                                `
                                svg path:not([data-context-gradient-overlay]),
                                svg polygon:not([data-context-gradient-overlay]),
                                svg polyline:not([data-context-gradient-overlay]),
                                svg rect:not([data-context-gradient-overlay]),
                                svg circle:not([data-context-gradient-overlay]),
                                svg ellipse:not([data-context-gradient-overlay])
                                `
                            );


                        const strokeColor =
                            readCSS(
                                root,
                                '--cm-nav-arrow-stroke',
                                '#6900e5'
                            );


                        const strokeWidth =
                            readCSS(
                                root,
                                '--cm-nav-arrow-stroke-width',
                                '1px'
                            );


                        const drawDuration =
                            readTime(
                                root,
                                '--cm-nav-arrow-draw-duration'
                            );


                        const drawEasing =
                            readCSS(
                                root,
                                '--cm-nav-arrow-draw-easing',
                                'ease'
                            );


                        const fillDelay =
                            readTime(
                                root,
                                '--cm-nav-arrow-fill-delay'
                            );


                        const fillDuration =
                            readTime(
                                root,
                                '--cm-nav-arrow-fill-duration'
                            );


                        const fillEasing =
                            readCSS(
                                root,
                                '--cm-nav-arrow-fill-easing',
                                'ease'
                            );


                        const gradientID =
                            navArrow
                                ._contextGradientID;


                        const innerShadowID =
                            navArrow
                                ._contextInnerShadowID;


                        shapes.forEach(
                            shape => {

                                shape.style.stroke =
                                    strokeColor;


                                shape.style.strokeWidth =
                                    strokeWidth;


                                shape.style.fill =
                                    '#000000';



                                if (
                                    typeof shape.getTotalLength ===
                                    'function'
                                ) {

                                    const length =
                                        shape.getTotalLength();


                                    shape.style.strokeDasharray =
                                        `${length} ${length}`;


                                    shape.style.strokeDashoffset =
                                        `${length}`;


                                    trackAnimation(
                                        shape.animate(

                                            [
                                                {
                                                    strokeDashoffset:
                                                        `${length}`
                                                },

                                                {
                                                    strokeDashoffset:
                                                        '0'
                                                }
                                            ],

                                            {
                                                duration:
                                                    drawDuration,

                                                easing:
                                                    drawEasing,

                                                fill:
                                                    'forwards'
                                            }
                                        )
                                    );
                                }


                                if (gradientID) {

                                    const gradientShape =
                                        shape.cloneNode(
                                            true
                                        );


                                    gradientShape.setAttribute(
                                        'data-context-gradient-overlay',
                                        'true'
                                    );


                                    gradientShape.removeAttribute(
                                        'id'
                                    );


                                    gradientShape.style.stroke =
                                        'none';


                                    gradientShape.style.fill =
                                        `url(#${gradientID})`;


                                    gradientShape.style.opacity =
                                        '0';


                                    gradientShape.style.strokeDasharray =
                                        'none';


                                    gradientShape.style.strokeDashoffset =
                                        '0';


                                    if (
                                        innerShadowID
                                    ) {

                                        gradientShape.style.filter =
                                            `url(#${innerShadowID})`;
                                    }


                                    shape.parentNode
                                        .insertBefore(
                                            gradientShape,
                                            shape.nextSibling
                                        );


                                    setTimeout(
                                        () => {

                                            if (
                                                token !== sequenceToken ||
                                                !slideIsActive
                                            ) {

                                                gradientShape.remove();

                                                return;
                                            }


                                            trackAnimation(
                                                gradientShape.animate(

                                                    [
                                                        {
                                                            opacity: 0
                                                        },

                                                        {
                                                            opacity: 1
                                                        }
                                                    ],

                                                    {
                                                        duration:
                                                            fillDuration,

                                                        easing:
                                                            fillEasing,

                                                        fill:
                                                            'forwards'
                                                    }
                                                )
                                            );

                                        },

                                        fillDelay
                                    );
                                }
                            }
                        );


                        startArrowBounce(
                            token
                        );
                    }
                };



            /* =================================================
               PLAY CONSTRUCTION CASCADE
               ================================================= */

            const playSequence =
                async token => {

                    await wait(
                        readTime(
                            root,
                            '--cm-sequence-start-delay'
                        )
                    );


                    for (
                        const className
                        of paintOrder
                    ) {

                        if (
                            token !== sequenceToken ||
                            !slideIsActive
                        ) {
                            return;
                        }


                        const element =
                            svg.querySelector(
                                `.${className}`
                            );


                        if (!element) {
                            continue;
                        }


                        const type =
                            getType(
                                className
                            );


                        const timing =
                            getTiming(
                                root,
                                type
                            );


                        if (
                            type === 'text'
                        ) {

                            animateText(
                                element,
                                timing,
                                token
                            );

                        } else {

                            animateGeometry(
                                element,
                                timing,
                                token,
                                className
                            );
                        }


                        await wait(
                            timing.advance
                        );
                    }



                    /* FINAL TEXT TAIL */

                    const lastTiming =
                        getTiming(
                            root,
                            'text'
                        );


                    const finalTail =
                        Math.max(

                            lastTiming.drawDuration,

                            lastTiming.fillDelay +
                                lastTiming.fillDuration,

                            lastTiming.darkenDelay +
                                lastTiming.darkenDuration,

                            lastTiming.shadowDelay +
                                lastTiming.shadowDuration
                        );


                    await wait(
                        finalTail
                    );


                    if (
                        token !== sequenceToken ||
                        !slideIsActive
                    ) {
                        return;
                    }


                    showNavigation(
                        token
                    );
                };



            /* =================================================
               PAGEFLOW ACTIVE SLIDE DETECTION
               ================================================= */

            const isSlideCurrent =
                () => {

                    if (!slide) {
                        return true;
                    }


                    const styles =
                        getComputedStyle(
                            slide
                        );


                    if (
                        styles.visibility ===
                            'hidden' ||

                        parseFloat(
                            styles.opacity
                        ) <= 0
                    ) {
                        return false;
                    }


                    const transform =
                        styles.transform;


                    if (
                        !transform ||
                        transform === 'none'
                    ) {
                        return true;
                    }


                    const matrixMatch =
                        transform.match(
                            /^matrix\(([^)]+)\)$/
                        );


                    if (matrixMatch) {

                        const parts =
                            matrixMatch[1]
                                .split(',')
                                .map(Number);


                        return (
                            Math.abs(
                                parts[4] || 0
                            ) < 2 &&

                            Math.abs(
                                parts[5] || 0
                            ) < 2
                        );
                    }


                    const matrix3dMatch =
                        transform.match(
                            /^matrix3d\(([^)]+)\)$/
                        );


                    if (matrix3dMatch) {

                        const parts =
                            matrix3dMatch[1]
                                .split(',')
                                .map(Number);


                        return (
                            Math.abs(
                                parts[12] || 0
                            ) < 2 &&

                            Math.abs(
                                parts[13] || 0
                            ) < 2
                        );
                    }


                    return false;
                };



            /* =================================================
               ACTIVATE / DEACTIVATE
               ================================================= */

            const activate =
                () => {

                    if (
                        slideIsActive
                    ) {
                        return;
                    }


                    slideIsActive =
                        true;


                    sequenceToken++;


                    const token =
                        sequenceToken;


                    resetMap();


                    requestAnimationFrame(
                        () => {

                            requestAnimationFrame(
                                () => {

                                    if (
                                        token !== sequenceToken ||
                                        !slideIsActive
                                    ) {
                                        return;
                                    }


                                    playSequence(
                                        token
                                    );
                                }
                            );
                        }
                    );
                };


            const deactivate =
                () => {

                    if (
                        !slideIsActive
                    ) {
                        return;
                    }


                    slideIsActive =
                        false;


                    sequenceToken++;


                    resetMap();
                };


            const syncSlideState =
                () => {

                    if (
                        isSlideCurrent()
                    ) {

                        activate();

                    } else {

                        deactivate();
                    }
                };



            /* =================================================
               PAGEFLOW OBSERVER
               ================================================= */

            if (slide) {

                const slideObserver =
                    new MutationObserver(
                        syncSlideState
                    );


                slideObserver.observe(
                    slide,
                    {
                        attributes: true,

                        attributeFilter: [
                            'style',
                            'class'
                        ]
                    }
                );


                slide.addEventListener(
                    'transitionend',
                    syncSlideState
                );


                resetMap();

                syncSlideState();

            } else {

                resetMap();


                slideIsActive =
                    true;


                sequenceToken++;


                playSequence(
                    sequenceToken
                );
            }
        }
    );
});

return componentId;})(RWElements.rw68470102_25D3_4E0E_AA37_39C045377C31);
RWElements.rw9CB44C5B_398C_4882_8219_DAD0518472DF = {};
RWElements.rw9CB44C5B_398C_4882_8219_DAD0518472DF = (function(componentId) {
    


return componentId;})(RWElements.rw9CB44C5B_398C_4882_8219_DAD0518472DF);
RWElements.rw3320C47C_C893_45E3_B116_657B58A282D9 = {};
RWElements.rw3320C47C_C893_45E3_B116_657B58A282D9 = (function(componentId) {
    
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

return componentId;})(RWElements.rw3320C47C_C893_45E3_B116_657B58A282D9);