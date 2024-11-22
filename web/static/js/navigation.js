document.addEventListener('DOMContentLoaded', function() {
    const header = document.getElementById('main-header');
    const activateNav = document.getElementById('activate-nav');
    const currentPath = window.location.pathname;

    function toggleNavVisibility() {
        if (currentPath === '/game') {
            header.classList.add('hidden');
            activateNav.classList.remove('hidden');
        } else {
            header.classList.remove('hidden');
            activateNav.classList.add('hidden');
        }
    }

    toggleNavVisibility();

    activateNav.addEventListener('click', function() {
        header.classList.remove('hidden');
        activateNav.classList.add('hidden');
    });

    document.addEventListener('click', function(event) {
        if (!header.contains(event.target) && !activateNav.contains(event.target) && currentPath === '/game') {
            header.classList.add('hidden');
            activateNav.classList.remove('hidden');
        }
    });
});
