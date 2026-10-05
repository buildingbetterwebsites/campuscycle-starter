// Finds the analytics steps (TrackStep) a server page puts on the page. TrackStep runs in the browser
// and shows nothing, so the page's HTML cannot tell whether it is there: these tests look at the React
// elements the page returns instead.
import { isValidElement, type ReactNode } from 'react'
import { TrackStep } from '../../src/components/site/TrackStep'

type Step = { event: string; props?: Record<string, string>; once?: string }

export function trackSteps(node: ReactNode): Step[] {
  const found: Step[] = []
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) return current.forEach(visit)
    if (!isValidElement(current)) return
    const props = current.props as Step & { children?: ReactNode }
    if (current.type === TrackStep) {
      found.push({ event: props.event, ...(props.props ? { props: props.props } : {}), ...(props.once ? { once: props.once } : {}) })
    }
    visit(props.children)
  }
  visit(node)
  return found
}
