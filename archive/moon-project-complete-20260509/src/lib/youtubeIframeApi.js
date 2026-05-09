let apiPromise = null

/**
 * Resolves once `window.YT.Player` exists (loads iframe_api once).
 */
export function ensureYoutubeIframeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'))
  }
  if (window.YT?.Player) return Promise.resolve()

  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled || !window.YT?.Player) return
        settled = true
        resolve()
      }

      const prior = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
        if (typeof prior === 'function') prior()
        finish()
      }

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement('script')
        s.async = true
        s.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(s)
      }

      const id = window.setInterval(() => {
        finish()
        if (settled) window.clearInterval(id)
      }, 50)

      window.setTimeout(() => window.clearInterval(id), 15_000)
    })
  }

  return apiPromise
}
