

var RWElements={};

RWElements.rwD6AB75C3_CA67_4F39_B9A0_76A9E2E3129D = {};
RWElements.rwD6AB75C3_CA67_4F39_B9A0_76A9E2E3129D = (function(componentId) {
    
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

return componentId;})(RWElements.rwD6AB75C3_CA67_4F39_B9A0_76A9E2E3129D);
RWElements.rw07839A62_7C7E_48D3_83C9_F0357D68B910 = {};
RWElements.rw07839A62_7C7E_48D3_83C9_F0357D68B910 = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rw07839A62_7C7E_48D3_83C9_F0357D68B910);