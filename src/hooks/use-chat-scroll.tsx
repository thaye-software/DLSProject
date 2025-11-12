import { useCallback, useEffect, useRef, useState } from 'react'

export function useChatScroll() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const THRESHOLD = 200

    const onScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = el
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
      // if within threshold, enable auto-scroll, otherwise disable
      setAutoScrollEnabled(distanceFromBottom <= THRESHOLD)
    }

    // run once to initialise
    onScroll()

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef])

  return {
    containerRef,
    scrollToBottom,
    autoScrollEnabled,
    setAutoScrollEnabled,
  }
}
