

var RWElements={};

RWElements.rw7FB5C05C_F8E4_4041_BAB2_89723969B7F4 = {};
RWElements.rw7FB5C05C_F8E4_4041_BAB2_89723969B7F4 = (function(componentId) {
    
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

return componentId;})(RWElements.rw7FB5C05C_F8E4_4041_BAB2_89723969B7F4);
RWElements.rw7DCB845F_5DB4_4FA2_A9C5_893E6104AC66 = {};
RWElements.rw7DCB845F_5DB4_4FA2_A9C5_893E6104AC66 = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rw7DCB845F_5DB4_4FA2_A9C5_893E6104AC66);