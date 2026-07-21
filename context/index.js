

var RWElements={};

RWElements.rwCA2E8744_1125_4A14_B10C_20BE47B83BB6 = {};
RWElements.rwCA2E8744_1125_4A14_B10C_20BE47B83BB6 = (function(componentId) {
    
// Fade-In Body - Free

const FADE_EFFECT_ENABLED = true;
const MIN_SCREEN_WIDTH = 100;
const BODY_DURATION = 1512;
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

return componentId;})(RWElements.rwCA2E8744_1125_4A14_B10C_20BE47B83BB6);
RWElements.rwA494829A_A197_4714_B89B_8EF13FE80DD9 = {};
RWElements.rwA494829A_A197_4714_B89B_8EF13FE80DD9 = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rwA494829A_A197_4714_B89B_8EF13FE80DD9);