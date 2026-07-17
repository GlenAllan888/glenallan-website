

var RWElements={};

RWElements.rw4AA35D85_0CDB_425D_BA76_05E13E7D269C = {};
RWElements.rw4AA35D85_0CDB_425D_BA76_05E13E7D269C = (function(componentId) {
    
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

return componentId;})(RWElements.rw4AA35D85_0CDB_425D_BA76_05E13E7D269C);
RWElements.rw480BF423_EE9F_4330_B027_2569B431917A = {};
RWElements.rw480BF423_EE9F_4330_B027_2569B431917A = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rw480BF423_EE9F_4330_B027_2569B431917A);