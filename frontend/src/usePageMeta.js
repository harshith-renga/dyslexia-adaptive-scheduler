import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'https://dyslexia-adaptive-scheduler.vercel.app'
const NAME = 'DysLexi Scheduler'

/** Title, description and indexing rules per route. Private pages are noindex. */
const PAGES = {
  '/': {
    title: `${NAME} | Revision planner for dyslexic students`,
    description:
      'An adaptive revision planner for dyslexic students. It builds study and break timelines around sleep and fatigue, and predicts when to revise each topic.',
  },
  '/login': {
    title: `Sign in or create an account | ${NAME}`,
    description: 'Sign in to DysLexi Scheduler or create an account to save your study sessions.',
  },
  '/settings': {
    title: `Accessibility settings | ${NAME}`,
    description:
      'Change text size, reading font, colour theme and the reading guide, or have text read aloud.',
  },
  '/dashboard': { title: `Dashboard | ${NAME}`, description: 'Your study health at a glance.', noindex: true },
  '/planner': { title: `Study planner | ${NAME}`, description: 'Build a study and break timeline.', noindex: true },
  '/analytics': { title: `Analytics | ${NAME}`, description: 'Your retention and study time over the weeks.', noindex: true },
}

function setMeta(selector, create, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', value)
}

const meta = (attr, key) => () => {
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  return el
}

/** Keeps the document head in step with the current route. */
export default function usePageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = PAGES[pathname] || PAGES['/']
    const url = `${SITE}${pathname === '/' || !PAGES[pathname] ? '/' : pathname}`

    document.title = page.title
    setMeta('meta[name="description"]', meta('name', 'description'), page.description)
    setMeta('meta[property="og:title"]', meta('property', 'og:title'), page.title)
    setMeta('meta[property="og:description"]', meta('property', 'og:description'), page.description)
    setMeta('meta[property="og:url"]', meta('property', 'og:url'), url)
    setMeta('meta[name="twitter:title"]', meta('name', 'twitter:title'), page.title)
    setMeta(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      url,
    )
    setMeta('meta[name="robots"]', meta('name', 'robots'), page.noindex ? 'noindex, nofollow' : 'index, follow')
  }, [pathname])
}
