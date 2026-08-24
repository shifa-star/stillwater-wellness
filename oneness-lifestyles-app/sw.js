/* sw.js — Oneness Lifestyles app shell service worker.
   Caches the shell on install; cache-first with network fallback.
   Offline-capable single-page app; no external network, no trackers. */

'use strict';

var CACHE_NAME = 'oneness-lifestyles-shell-v14';

// The app shell that must always be available offline.
var SHELL = [
  './',
  './index.html',
  './wellness.html',
  './app.css',
  './wellness.css',
  './medicine-wheel.js',
  './galactic-signature.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './images/welcome-tree-door.jpg',
  './images/door11-video.mp4',
  './images/water-bg.jpg',
  './images/water-bg.mp4'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle same-origin GETs; leave POSTs and cross-origin (e.g. the
  // reading gateway) to the network untouched.
  if (request.method !== 'GET') {
    return;
  }

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }

  // Pages are network-first so fresh content (word changes, new text) always
  // arrives on the next load, even while cached; the fresh copy refreshes the
  // cache. Other shell assets (css, images, video) stay cache-first so the
  // app loads fast and works offline. Offline navigation falls back to the
  // cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) {
        return cached;
      }
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        // Offline and not cached: fall back to the cached shell on navigation.
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return undefined;
      });
    })
  );
});
