

var RWElements={};

RWElements.rw5E37D4C9_AEBA_48FD_92E5_2AA6C5E734AB = {};
RWElements.rw5E37D4C9_AEBA_48FD_92E5_2AA6C5E734AB = (function(componentId) {
    
document.addEventListener('DOMContentLoaded', () => {
    let lastPointerType = 'mouse';

    // Remember whether the current interaction came from
    // a mouse/trackpad, finger, or pen.
    document.addEventListener('pointerdown', event => {
        lastPointerType = event.pointerType || 'mouse';

        // Touch somewhere outside an active PDF card:
        // return any open card to its resting state.
        if (lastPointerType === 'touch') {
            document.querySelectorAll('.pdf-card.pdf-active').forEach(card => {
                if (!card.contains(event.target)) {
                    card.classList.remove('pdf-active');
                }
            });
        }
    }, true);


    // One delegated click handler controls every PDF card on the page.
    document.addEventListener('click', event => {
        const card = event.target.closest('.pdf-card');

        if (!card) return;

        // Find the actual link inside this card.
        const link =
            event.target.closest('a') ||
            card.querySelector('a');

        if (!link) return;

        // Mouse / trackpad:
        // do nothing special. Normal click behavior continues.
        if (lastPointerType !== 'touch') return;


        // FIRST TOUCH:
        // stop navigation and activate the animated state.
        if (!card.classList.contains('pdf-active')) {
            event.preventDefault();

            // Only one PDF card stays active at a time.
            document.querySelectorAll('.pdf-card.pdf-active').forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('pdf-active');
                }
            });

            card.classList.add('pdf-active');
            return;
        }


        // SECOND TOUCH:
        // clear the temporary state, but DO NOT prevent navigation.
        // The browser now follows the PDF link normally.
        card.classList.remove('pdf-active');
    });


    // Optional convenience:
    // Escape closes any activated PDF card when a keyboard exists.
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.pdf-card.pdf-active').forEach(card => {
                card.classList.remove('pdf-active');
            });
        }
    });
});

return componentId;})(RWElements.rw5E37D4C9_AEBA_48FD_92E5_2AA6C5E734AB);
RWElements.rw7DCB845F_5DB4_4FA2_A9C5_893E6104AC66 = {};
RWElements.rw7DCB845F_5DB4_4FA2_A9C5_893E6104AC66 = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rw7DCB845F_5DB4_4FA2_A9C5_893E6104AC66);