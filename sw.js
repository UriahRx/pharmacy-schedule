// Service Worker for Pharmacy Schedule PWA
const CACHE_NAME = 'pharmacy-schedule-v1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/data-manager.js',
  '/js/validator.js',
  '/js/scheduler.js',
  '/js/ui-manager.js',
  '/manifest.json'
];

// 安裝Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker 安裝中...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('快取核心檔案');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker 安裝完成');
        return self.skipWaiting();
      })
  );
});

// 啟用Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker 啟用中...');
  
  // 清除舊的快取
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('清除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker 啟用完成');
      return self.clients.claim();
    })
  );
});

// 攔截請求
self.addEventListener('fetch', event => {
  // 跳過非GET請求
  if (event.request.method !== 'GET') return;
  
  // 跳過瀏覽器擴充功能請求
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果有快取，返回快取
        if (response) {
          return response;
        }
        
        // 否則從網路獲取
        return fetch(event.request)
          .then(networkResponse => {
            // 檢查是否為有效回應
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 快取新的資源
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // 網路失敗，嘗試返回離線頁面
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            // 對於其他請求，返回錯誤
            return new Response('網路離線，請檢查連線後重試', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// 後台同步（如果瀏覽器支援）
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('後台同步開始');
    event.waitUntil(syncData());
  }
});

// 推播通知（如果瀏覽器支援）
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || '排班系統通知',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'open',
        title: '開啟'
      },
      {
        action: 'close',
        title: '關閉'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || '排班通知', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('通知被點擊:', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// 後台同步函數
function syncData() {
  // 這裡可以實現資料同步邏輯
  // 例如：上傳本地變更到伺服器
  return Promise.resolve();
}

// 檢查更新
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});