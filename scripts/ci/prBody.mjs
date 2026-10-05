// Reads one section of a pull request's description (its "body"), the way the pull request template
// lays it out: a "## " heading, then the text under it, up to the next heading. Used by the CI checks
// that read the description: the AI note (ai-note.mjs) and the removals check (removals.mjs).

/**
 * The text under the heading `## <title>`, or null when the description has no such heading.
 *
 * @param {string | null | undefined} body the pull request's description (GitHub sends null when it is empty)
 * @param {string} title the heading's text, without the "## "
 * @returns {string | null}
 */
export function sectionText(body, title) {
  const lines = String(body ?? '').split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${title}`)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  // The section ends at the next heading of the same or a higher level ("# " or "## ").
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n')
}

/**
 * What a reader would actually see in a section: the template's hidden <!-- comments --> and the
 * spaces around them taken out. An empty string means the section was left empty.
 *
 * @param {string} text
 * @returns {string}
 */
export function visibleText(text) {
  return text.replace(/<!--[\s\S]*?(-->|$)/g, '').trim()
}
