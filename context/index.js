

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