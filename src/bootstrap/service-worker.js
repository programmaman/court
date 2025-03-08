import log from "/../helpers/logger"; // Import logger

// Detect if the app is running on localhost
const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" || // IPv6 localhost
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/) // IPv4 localhost
);

log.debug(`Service Worker: Running in ${isLocalhost ? "localhost" : "production"} mode.`);

export const register = (config) => {
  if ("serviceWorker" in navigator) {
    log.debug("Service Worker: Checking registration support.");

    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      log.warn(
        "Service Worker: PUBLIC_URL is on a different origin, skipping registration."
      );
      return;
    }

    window.addEventListener("load", () => {
      const swUrl = `${process.env.PUBLIC_URL}/sw.js`;
      log.debug(`Service Worker: Registering from URL: ${swUrl}`);

      if (isLocalhost) {
        log.debug("Service Worker: Running in localhost, verifying existing registration.");
        checkValidServiceWorker(swUrl, config);

        navigator.serviceWorker.ready.then(() => {
          log.debug(
            "Service Worker: App is being served cache-first. For more info, visit http://bit.ly/CRA-PWA"
          );
        });
      } else {
        log.debug("Service Worker: Registering in production mode.");
        registerValidSW(swUrl, config);
      }
    });
  } else {
    log.warn("Service Worker: Not supported in this browser.");
  }
};

const registerValidSW = (swUrl, config) => {
  log.debug(`registerValidSW called with swUrl: ${swUrl}`);

  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      log.debug("Service worker registered successfully.", { swUrl });

      registration.onupdatefound = () => {
        log.debug("Service worker update found.");

        const installingWorker = registration.installing;
        if (installingWorker == null) {
          log.warn("No installing worker found.");
          return;
        }

        installingWorker.onstatechange = () => {
          log.debug(`Service worker state changed: ${installingWorker.state}`);

          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              log.debug(
                "New content is available and will be used when all tabs are closed. See http://bit.ly/CRA-PWA."
              );

              // Execute callback
              if (config && config.onUpdate) {
                log.debug("Executing onUpdate callback.");
                config.onUpdate(registration);
              }
            } else {
              log.debug("Content is cached for offline use.");

              // Execute callback
              if (config && config.onSuccess) {
                log.debug("Executing onSuccess callback.");
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((err) => {
      log.error("Error during service worker registration:", err.message);
    });
};

const checkValidServiceWorker = (swUrl, config) => {
  log.debug(`checkValidServiceWorker called with swUrl: ${swUrl}`);

  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl)
    .then((response) => {
      log.debug("Service worker fetch response received.", {
        status: response.status,
        contentType: response.headers.get("content-type"),
      });

      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get("content-type");
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf("javascript") === -1)
      ) {
        log.warn("No valid service worker found. Unregistering and reloading the page.");

        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        log.debug("Valid service worker found. Proceeding with normal registration.");
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      log.warn("No internet connection found. App is running in offline mode.");
    });
};

export const unregister = () => {
  if ("serviceWorker" in navigator) {
    log.debug("Service Worker: Unregistration requested.");

    navigator.serviceWorker.ready
      .then((registration) => {
        log.debug("Service Worker: Unregistering...");
        return registration.unregister();
      })
      .then(() => {
        log.debug("Service Worker: Successfully unregistered.");
      })
      .catch((err) => {
        log.error("Service Worker: Unregistration failed.", err.message);
      });
  } else {
    log.warn("Service Worker: Not supported in this browser.");
  }
};

export const askPermission = () => {
  log.debug("Requesting Notification permission...");

  return new Promise(function (resolve, reject) {
    const permissionResult = Notification.requestPermission(function (result) {
      log.debug(`Notification permission request result (callback): ${result}`);
      resolve(result);
    });

    if (permissionResult) {
      permissionResult.then((result) => {
        log.debug(`Notification permission result (Promise): ${result}`);
        resolve(result);
      }, reject);
    }
  }).then(function (permissionResult) {
    if (permissionResult !== "granted") {
      log.warn("Notification permission was denied.");
      throw new Error("We weren't granted permission.");
    }
    log.debug("Notification permission granted.");
  });
};

export const subscribeUserToPush = async () => {
  const swUrl = `${process.env.PUBLIC_URL}/sw.js`;
  log.debug(`Attempting to register service worker for push notifications: ${swUrl}`);

  return new Promise((resolve, reject) => {
    navigator.serviceWorker.register(swUrl).then((registration) => {
      log.debug("Service Worker registered for push notifications.");

      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          "BPRV92GzWwsZcr3PX6pz_RZRCOStsM68JcqkCJJbfdZqKm1resLwElm7MgiU4_gNGXtzZv0gN4pkKVRnnF8KQPk"
        ),
      };

      log.debug("Requesting push subscription...");

      registration.pushManager
        .subscribe(subscribeOptions)
        .then(function (pushSubscription) {
          log.debug("Push subscription successful.", pushSubscription);
          resolve(pushSubscription);
        })
        .catch((err) => {
          log.error("Push subscription failed.", err.message);
          reject(err);
        });
    }).catch((err) => {
      log.error("Service Worker registration failed for push notifications.", err.message);
      reject(err);
    });
  });
};

const urlBase64ToUint8Array = (base64String) => {
  log.debug("Converting Base64 string to Uint8Array.");

  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  log.debug("Base64 conversion complete.");
  return outputArray;
};