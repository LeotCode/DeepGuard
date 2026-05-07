/**
 * mediaCache.js
 *
 * Stores binary media (video / audio blobs) in IndexedDB so previews survive
 * page reloads.  Images are small enough to live in localStorage as base64,
 * but videos / audio can be many MB — IndexedDB handles that comfortably.
 *
 * Public API
 * ----------
 *  saveMedia(scanId, file)           → Promise<string>   (blob URL ready to use)
 *  loadMedia(scanId)                 → Promise<string|null>
 *  deleteMedia(scanId)               → Promise<void>
 *  clearAllMedia()                   → Promise<void>
 */

const DB_NAME    = 'deepguard_media'
const STORE_NAME = 'blobs'
const DB_VERSION = 2

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      // Delete old store if it exists under a different name (migration safety)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      db.createObjectStore(STORE_NAME)
    }
    req.onsuccess  = (e) => resolve(e.target.result)
    req.onerror    = (e) => reject(e.target.error)
  })
}

/**
 * Save a File / Blob for a given scanId.
 * Returns a fresh blob URL pointing at the stored data.
 */
export async function saveMedia(scanId, fileOrBlob) {
  try {
    const db    = await openDB()
    const clone = fileOrBlob instanceof Blob ? fileOrBlob : null
    if (!clone) return null

    await new Promise((res, rej) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(clone, String(scanId))
      req.onsuccess = () => res()
      req.onerror   = (e) => rej(e.target.error)
    })

    return URL.createObjectURL(clone)
  } catch (err) {
    console.warn('[mediaCache] saveMedia failed:', err)
    return null
  }
}

/**
 * Load the stored Blob for a scanId and return a fresh blob URL.
 * Returns null if nothing is cached.
 */
export async function loadMedia(scanId) {
  try {
    const db   = await openDB()
    const blob = await new Promise((res, rej) => {
      const tx  = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(String(scanId))
      req.onsuccess = (e) => res(e.target.result)
      req.onerror   = (e) => rej(e.target.error)
    })
    if (!blob) return null
    return URL.createObjectURL(blob)
  } catch (err) {
    console.warn('[mediaCache] loadMedia failed:', err)
    return null
  }
}

/**
 * Remove a single entry from the cache.
 */
export async function deleteMedia(scanId) {
  try {
    const db = await openDB()
    await new Promise((res, rej) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(String(scanId))
      req.onsuccess = () => res()
      req.onerror   = (e) => rej(e.target.error)
    })
  } catch (err) {
    console.warn('[mediaCache] deleteMedia failed:', err)
  }
}

/**
 * Wipe the entire media store.
 */
export async function clearAllMedia() {
  try {
    const db = await openDB()
    await new Promise((res, rej) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).clear()
      req.onsuccess = () => res()
      req.onerror   = (e) => rej(e.target.error)
    })
  } catch (err) {
    console.warn('[mediaCache] clearAllMedia failed:', err)
  }
}
