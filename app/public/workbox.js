
if ('serviceWorker' in navigator) {
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';

  if (isLocalhost) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          registration.unregister();
        });
      });
    });
  } else {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service.js').then(function (registration) {
        console.debug(`[service] service worker registered with scope: ${registration.scope}`);
      }, function (err) {
        console.debug(`[service] service worker registration failed: ${err}`);
      });
    });
  }
}
