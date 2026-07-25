import { useEffect, useRef } from 'react'

/** Debounced callback for auto-save fields (overview, notes). */
export function useDebouncedSave<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  delay = 600,
) {
  const isFirst = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      saveFn(value).catch(console.error)
    }, delay)
    return () => clearTimeout(timer.current)
  }, [value, saveFn, delay])
}
