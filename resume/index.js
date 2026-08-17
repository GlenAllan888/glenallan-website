

var RWElements={};

RWElements.rw57A987F1_6C32_478A_9349_162F04E780A6 = {};
RWElements.rw57A987F1_6C32_478A_9349_162F04E780A6 = (function(componentId) {
    
document.addEventListener('DOMContentLoaded', () => {
    let lastPointerType = 'mouse';

    // Remember whether the current interaction came from
    // a mouse/trackpad, finger, or pen.
    document.addEventListener('pointerdown', event => {
        lastPointerType = event.pointerType || 'mouse';

        // Touch somewhere outside an active PDF card:
        // return any open card to its resting state.
        if (lastPointerType === 'touch') {
            document.querySelectorAll('.resume-pdf-card.resume-pdf-active').forEach(card => {
                if (!card.contains(event.target)) {
                    card.classList.remove('resume-pdf-active');
                }
            });
        }
    }, true);


    // One delegated click handler controls every PDF card on the page.
    document.addEventListener('click', event => {
        const card = event.target.closest('.resume-pdf-card');

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
        if (!card.classList.contains('resume-pdf-active')) {
            event.preventDefault();

            // Only one PDF card stays active at a time.
            document.querySelectorAll('.resume-pdf-card.resume-pdf-active').forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('resume-pdf-active');
                }
            });

            card.classList.add('resume-pdf-active');
            return;
        }


        // SECOND TOUCH:
        // clear the temporary state, but DO NOT prevent navigation.
        // The browser now follows the PDF link normally.
        card.classList.remove('resume-pdf-active');
    });


    // Optional convenience:
    // Escape closes any activated PDF card when a keyboard exists.
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.resume-pdf-card.resume-pdf-active').forEach(card => {
                card.classList.remove('resume-pdf-active');
            });
        }
    });
});

return componentId;})(RWElements.rw57A987F1_6C32_478A_9349_162F04E780A6);
RWElements.rw8F13CEF3_7BD8_4F50_A134_304EEDB8BA56 = {};
RWElements.rw8F13CEF3_7BD8_4F50_A134_304EEDB8BA56 = (function(componentId) {
    
console.log(`Running JS for element with id: `)

return componentId;})(RWElements.rw8F13CEF3_7BD8_4F50_A134_304EEDB8BA56);