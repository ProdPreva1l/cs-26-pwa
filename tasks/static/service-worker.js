// Cache essential assets for offline use
self.addEventListener('install', function(event) {
    console.log('Service Worker installing...');
    const urlsToCache = [
        '/tasks/',                          // Add task URL
        '/static/tasks/style.css',          // CSS file
        '/static/tasks/manifest.json',      // Manifest file
        '/static/tasks/tasks.js',           // JavaScript for task management
        '/static/tasks/tasks-db.js',        // IndexedDB management file
        '/static/tasks/icon.png',   // Icon for offline use
    ];
    event.waitUntil(
        caches.open('task-list-cache').then(function(cache) {
            console.log('Caching assets...');
            return Promise.all(
                urlsToCache.map(url => {
                    return cache.add(url).catch(error => {
                        console.error(`Failed to cache ${url}:`, error);
                    });
                })
            );
        }).then(() => console.log('All assets cached successfully!'))
          .catch(error => console.error('Error during caching process:', error))
    );
});

// Clean up old caches
self.addEventListener('activate', function(event) {
    const cacheWhitelist = ['task-list-cache'];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

//  Intercepts network requests and serves the cached version
self.addEventListener('fetch', function(event) {
    if (event.request.method === 'GET') {  // Only cache GET requests
        event.respondWith(
            caches.match(event.request).then(function(response) {
                // Return from cache if available, otherwise fetch from network
                return response || fetch(event.request).then(function(networkResponse) {
                    // Clone the network response for caching
                    const clonedResponse = networkResponse.clone();
                    // Cache the response if it’s for `/api/tasks/`
                    if (event.request.url.includes('/api/tasks/')) {
                        caches.open('task-list-cache').then(function(cache) {
                            cache.put(event.request, clonedResponse);
                            console.log('/api/tasks/ has been cached');
                        });
                    }
                    // Dynamically cache `/tasks/add` when accessed online
                    if (event.request.url.includes('/tasks/add')) {
                        caches.open('task-list-cache').then(function(cache) {
                            cache.put(event.request, clonedResponse);
                            console.log('/tasks/add has been added to cache');
                        });
                    }
                    // Cache the manifest and icon files when accessed online
                    if (event.request.url.includes('/manifest.json') ||
                        event.request.url.includes('/icon.png')) {
                        caches.open('task-list-cache').then(function(cache) {
                            cache.put(event.request, clonedResponse);
                            console.log(event.request.url + ' has been added to cache');
                        });
                    }
                    // Return the original network response to the browser
                    return networkResponse;
                });
            }).catch(() => {
                // If offline and the request is for `/api/tasks/`, return the cached version
                if (event.request.url.includes('api/tasks/')) {
                    return caches.match(event.request).then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return new Response(
                            JSON.stringify({ error: "No cached data available." }),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                }

                // Fallback response for offline navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
                // Serve a fallback icon for offline mode if requested
                if (event.request.url.includes('/icon.png')) {
                    return caches.match('/static/tasks/icon.png');
                }
                // General fallback for other requests
                return new Response(
                    '<h1>Offline</h1><p>The requested content is unavailable offline.</p>',
                    { headers: { 'Content-Type': 'text/html' } }
                );
            }) // Closing parentheses for catch block
        );
    }
});

// Sync tasks to the server when back online
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-tasks') {
        event.waitUntil(syncTasksToServer());
    }
});

// Function to get tasks from IndexedDB and send them to the server
function syncTasksToServer() {
    return new Promise((resolve, reject) => {
        // Open the tasksDB IndexedDB database
        const request = indexedDB.open("tasksDB", 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            const tasks = [];
            objectStore.openCursor().onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    tasks.push(cursor.value);
                    cursor.continue();
                } else {
                    tasks.forEach(task => {
                        fetch('api/tasks/create/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCSRFToken()  // Add CSRF token here
                            },
                            body: JSON.stringify(task)
                        }).then(response => {
                            if (response.ok) {
                                // Remove task from IndexedDB after successful sync
                                const deleteTransaction = db.transaction(["tasks"], "readwrite");
                                const deleteStore = deleteTransaction.objectStore("tasks");
                                deleteStore.delete(task.id);
                            }
                        }).catch(error => console.error("Failed to sync task:", error));
                    });
                    resolve();
                }
            };
        };
        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.errorCode);
            reject();
        };
    });
}