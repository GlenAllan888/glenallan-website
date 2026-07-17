

var RWElements={};

RWElements.rw51D47120_A363_444A_A4EF_23E532E842EE = {};
RWElements.rw51D47120_A363_444A_A4EF_23E532E842EE = (function(componentId) {
    
// Fade-In Body - Free

const FADE_EFFECT_ENABLED = true;
const MIN_SCREEN_WIDTH = 100;
const BODY_DURATION = 2500;
const BODY_DELAY = 150;
const BODY_EASING = 'ease';

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;

    // fallback safety
    if (!body) return;

    // no effect
    if (!FADE_EFFECT_ENABLED || window.innerWidth < MIN_SCREEN_WIDTH) {
        body.style.opacity = '1';
        body.style.willChange = 'auto';
        return;
    }

    // prepare transition once
    body.style.transition = `opacity ${BODY_DURATION}ms ${BODY_EASING}`;

    // reveal
    window.requestAnimationFrame(() => {
        setTimeout(() => {
            body.style.opacity = '1';

            // cleanup after animation
            setTimeout(() => {
                body.style.willChange = 'auto';
            }, BODY_DURATION);
        }, BODY_DELAY);
    });
});
// Copyright ®Multithemes Proprietary code, reuse to create competing products (e.g. Elements App martket) is prohibited.

return componentId;})(RWElements.rw51D47120_A363_444A_A4EF_23E532E842EE);
RWElements.rw24F3E3D4_32B2_4EEF_B1C9_380A7B182D08 = {};
RWElements.rw24F3E3D4_32B2_4EEF_B1C9_380A7B182D08 = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rw24F3E3D4_32B2_4EEF_B1C9_380A7B182D08);