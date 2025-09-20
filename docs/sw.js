const CACHE_NAME = 'zelle-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  // Add offline fallback assets
  '/offline.html'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Failed to cache resources:', error);
      })
  );
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then((fetchResponse) => {
          // Check if we received a valid response
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response
          const responseToCache = fetchResponse.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              // Don't cache API calls or external resources
              if (!event.request.url.includes('/api/') && 
                  event.request.url.startsWith(self.location.origin)) {
                cache.put(event.request, responseToCache);
              }
            });

          return fetchResponse;
        }).catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          // Return a generic offline response for other requests
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle background sync for failed transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-transaction') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Get pending transactions from IndexedDB or localStorage
    // and retry them when connection is restored
    console.log('Background sync: retrying failed transactions');
    
    // This would typically involve:
    // 1. Getting failed transactions from local storage
    // 2. Retrying API calls
    // 3. Updating local storage on success
    // 4. Showing notifications to user
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle push notifications (if implementing in the future)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'You have a new Zelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close-icon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Zelle Notification', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});