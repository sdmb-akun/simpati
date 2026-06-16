// ============================================
// SW.JS - SERVICE WORKER
// SIMPATI - Sistem Informasi Pembayaran Terintegrasi
// SD Muhammadiyah Bekonang
// ============================================

const CACHE_NAME = "simpatic-v1.0.0";
const RUNTIME_CACHE = "simpatic-runtime-v1.0.0";

// ==================== RESOURCES TO CACHE ====================
const PRECACHE_RESOURCES = [
    "/",
    "/index.html",
    "/app.css",
    "/app.js",
    "/manifest.json",
    "/assets/logo.png",
    "/assets/favicon.png",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
];

// ==================== INSTALL EVENT ====================
self.addEventListener("install", function(event) {
    console.log("[ServiceWorker] Installing...");
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log("[ServiceWorker] Caching app shell");
                return cache.addAll(PRECACHE_RESOURCES).catch(function(error) {
                    console.warn("[ServiceWorker] Failed to cache some resources:", error);
                    // Lanjutkan meskipun ada resource yang gagal di-cache
                    return Promise.resolve();
                });
            })
            .then(function() {
                console.log("[ServiceWorker] Skip waiting");
                return self.skipWaiting();
            })
    );
});

// ==================== ACTIVATE EVENT ====================
self.addEventListener("activate", function(event) {
    console.log("[ServiceWorker] Activating...");
    
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        // Hapus cache versi lama
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log("[ServiceWorker] Deleting old cache:", cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(function() {
                console.log("[ServiceWorker] Claiming clients");
                return self.clients.claim();
            })
    );
});

// ==================== FETCH EVENT ====================
self.addEventListener("fetch", function(event) {
    const requestUrl = new URL(event.request.url);
    
    // ==================== STRATEGI: NETWORK FIRST (API CALL) ====================
    // Untuk request ke Google Apps Script API
    if (requestUrl.href.includes("googleapis.com") || 
        requestUrl.href.includes("script.google.com") ||
        requestUrl.href.includes("macros")) {
        
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }
    
    // ==================== STRATEGI: CACHE FIRST (STATIC ASSETS) ====================
    // Untuk CSS, JS, images, fonts
    if (event.request.destination === "style" ||
        event.request.destination === "script" ||
        event.request.destination === "image" ||
        event.request.destination === "font" ||
        event.request.destination === "manifest") {
        
        event.respondWith(cacheFirstStrategy(event.request));
        return;
    }
    
    // ==================== STRATEGI: NETWORK FIRST (HTML NAVIGATION) ====================
    // Untuk navigasi halaman
    if (event.request.mode === "navigate") {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }
    
    // ==================== DEFAULT: STALE WHILE REVALIDATE ====================
    event.respondWith(staleWhileRevalidateStrategy(event.request));
});

// ==================== CACHE STRATEGIES ====================

/**
 * Cache First Strategy
 * Ambil dari cache dulu, fallback ke network
 */
function cacheFirstStrategy(request) {
    return caches.match(request)
        .then(function(cachedResponse) {
            if (cachedResponse) {
                // Return cached response
                return cachedResponse;
            }
            
            // Fetch from network
            return fetch(request)
                .then(function(networkResponse) {
                    // Cache valid response
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(RUNTIME_CACHE)
                            .then(function(cache) {
                                cache.put(request, responseClone);
                            });
                    }
                    return networkResponse;
                })
                .catch(function() {
                    // Jika fetch gagal dan request adalah image, return placeholder
                    if (request.destination === "image") {
                        return new Response(
                            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23E5E7EB"><rect width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="16">No Image</text></svg>',
                            { 
                                status: 200, 
                                headers: { "Content-Type": "image/svg+xml" }
                            }
                        );
                    }
                    
                    // Return offline fallback untuk HTML
                    return new Response(
                        "<html><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:%23F5F7FA;color:%23374151;text-align:center'><div><h2>📡 Tidak Ada Koneksi</h2><p>Silakan periksa koneksi internet Anda</p><button onclick='location.reload()' style='background:%2300843D;color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:12px'>Coba Lagi</button></div></body></html>",
                        { 
                            status: 200, 
                            headers: { "Content-Type": "text/html" }
                        }
                    );
                });
        });
}

/**
 * Network First Strategy
 * Ambil dari network dulu, fallback ke cache
 */
function networkFirstStrategy(request) {
    return fetch(request)
        .then(function(networkResponse) {
            // Cache valid response
            if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(RUNTIME_CACHE)
                    .then(function(cache) {
                        cache.put(request, responseClone);
                    });
            }
            return networkResponse;
        })
        .catch(function() {
            // Fallback ke cache
            return caches.match(request)
                .then(function(cachedResponse) {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // Jika API call gagal, return JSON error
                    if (request.headers.get("Accept") && 
                        request.headers.get("Accept").includes("application/json")) {
                        return new Response(
                            JSON.stringify({
                                success: false,
                                message: "Tidak ada koneksi internet"
                            }),
                            { 
                                status: 503, 
                                headers: { "Content-Type": "application/json" }
                            }
                        );
                    }
                    
                    // Return offline page
                    return new Response(
                        "<html><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:%23F5F7FA;color:%23374151;text-align:center'><div><h2>📡 Tidak Ada Koneksi</h2><p>Silakan periksa koneksi internet Anda</p><button onclick='location.reload()' style='background:%2300843D;color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:12px'>Coba Lagi</button></div></body></html>",
                        { 
                            status: 200, 
                            headers: { "Content-Type": "text/html" }
                        }
                    );
                });
        });
}

/**
 * Stale While Revalidate Strategy
 * Return cache dulu, update cache di background
 */
function staleWhileRevalidateStrategy(request) {
    return caches.match(request)
        .then(function(cachedResponse) {
            const fetchPromise = fetch(request)
                .then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(RUNTIME_CACHE)
                            .then(function(cache) {
                                cache.put(request, networkResponse.clone());
                            });
                    }
                    return networkResponse;
                })
                .catch(function() {
                    // Gagal update, tidak masalah
                });
            
            // Return cached response dulu, atau tunggu network
            return cachedResponse || fetchPromise;
        });
}

// ==================== BACKGROUND SYNC ====================
self.addEventListener("sync", function(event) {
    if (event.tag === "sync-transaksi") {
        event.waitUntil(syncPendingTransactions());
    }
});

async function syncPendingTransactions() {
    try {
        const cache = await caches.open(RUNTIME_CACHE);
        const pendingRequests = await cache.keys();
        
        for (const request of pendingRequests) {
            if (request.url.includes("savePayment") || 
                request.url.includes("uploadBukti")) {
                try {
                    await fetch(request);
                    await cache.delete(request);
                } catch (error) {
                    console.log("Sync failed for:", request.url);
                }
            }
        }
    } catch (error) {
        console.error("Background sync error:", error);
    }
}

// ==================== PUSH NOTIFICATION ====================
self.addEventListener("push", function(event) {
    let data = {
        title: "SIMPATI",
        body: "Ada notifikasi baru",
        icon: "/assets/logo.png",
        badge: "/assets/logo.png",
        tag: "simpatic-notification",
        vibrate: [200, 100, 200],
        data: {
            url: "/"
        }
    };
    
    if (event.data) {
        try {
            const pushData = event.data.json();
            data.title = pushData.title || data.title;
            data.body = pushData.body || data.body;
            data.data.url = pushData.url || data.data.url;
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            vibrate: data.vibrate,
            data: data.data,
            actions: [
                {
                    action: "open",
                    title: "Buka"
                },
                {
                    action: "close",
                    title: "Tutup"
                }
            ]
        })
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener("notificationclick", function(event) {
    event.notification.close();
    
    if (event.action === "close") {
        return;
    }
    
    const urlToOpen = event.notification.data?.url || "/";
    
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true })
            .then(function(clientList) {
                // Cari tab yang sudah terbuka
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && "focus" in client) {
                        return client.focus();
                    }
                }
                // Buka tab baru
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ==================== MESSAGE FROM APP ====================
self.addEventListener("message", function(event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === "CACHE_NOW") {
        const urls = event.data.urls || [];
        event.waitUntil(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.addAll(urls);
            })
        );
    }
    
    if (event.data && event.data.type === "CLEAR_CACHE") {
        event.waitUntil(
            caches.keys().then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        return caches.delete(cacheName);
                    })
                );
            })
        );
    }
});

// ==================== PERIODIC BACKGROUND SYNC ====================
self.addEventListener("periodicsync", function(event) {
    if (event.tag === "check-tagihan") {
        event.waitUntil(checkNewBilling());
    }
});

async function checkNewBilling() {
    try {
        const cache = await caches.open(RUNTIME_CACHE);
        const apiUrl = await getApiUrl();
        
        if (apiUrl) {
            const response = await fetch(apiUrl + "?action=getDashboardWali&token=");
            const data = await response.json();
            
            if (data.success && data.data.tunggakan.length > 0) {
                // Ada tunggakan, kirim notifikasi
                await self.registration.showNotification("SIMPATI - Pengingat", {
                    body: "Anda memiliki " + data.data.tunggakan.length + " tunggakan pembayaran",
                    icon: "/assets/logo.png",
                    badge: "/assets/logo.png",
                    tag: "tunggakan",
                    vibrate: [200, 100, 200]
                });
            }
        }
    } catch (error) {
        console.error("Periodic sync error:", error);
    }
}

async function getApiUrl() {
    try {
        const cache = await caches.open(RUNTIME_CACHE);
        const response = await cache.match("/app.js");
        if (response) {
            const text = await response.text();
            const match = text.match(/API_URL:\s*["']([^"']+)["']/);
            if (match) {
                return match[1];
            }
        }
    } catch (error) {
        console.error("Failed to get API URL:", error);
    }
    return null;
}

console.log("[ServiceWorker] SIMPATI Service Worker loaded.");