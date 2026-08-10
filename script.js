(function () {
  'use strict';

  function revealAll() {
    var items = document.querySelectorAll('.reveal');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.add('is-visible');
    }
  }

  function init() {
    try {
      document.documentElement.classList.add('js-enabled');

      var items = document.querySelectorAll('.reveal');
      if (!items.length) return;

      if (!('IntersectionObserver' in window)) {
        revealAll();
        return;
      }

      var observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      for (var j = 0; j < items.length; j++) {
        observer.observe(items[j]);
      }
    } catch (err) {
      revealAll();
    }

    var yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
