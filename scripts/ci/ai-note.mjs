// The AI note check: CI's `ai-note` job runs this on every pull request.
//
// The pull request template (.github/pull_request_template.md) ends with the heading
// "## AI note: what I asked AI, and what I checked". Under it, the author writes what they asked an AI
// tool and how they checked its answer, or "No AI used." when they used none. Both are fine: the check
// only fails when that part is missing, empty, or still holds nothing but the template's hint.
//
// WHY the description arrives in the PR_BODY setting: the workflow passes it through an environment
// variable and never pastes it into a shell command, so nothing anyone types in a description can run
// as a command on the CI machine.
//
// Run it yourself: PR_BODY="$(cat description.md)" node scripts/ci/ai-note.mjs
import { pathToFileURL } from 'node:url'
import { sectionText, visibleText } from './prBody.mjs'

export const AI_NOTE_TITLE = 'AI note: what I asked AI, and what I checked'

// The template's hint, also when someone removed the <!-- --> around it but kept its words.
const HINT = /Write what you asked an AI tool and how you checked its answer\.\s*If you used no AI, write: No AI used\./g

/**
 * @param {string | null | undefined} prBody the pull request's description
 * @returns {{ ok: boolean, message: string }}
 */
export function checkAiNote(prBody) {
  const section = sectionText(prBody, AI_NOTE_TITLE)
  if (section === null) {
    return {
      ok: false,
      message: `AI note: missing. Your pull request's description has no heading "## ${AI_NOTE_TITLE}". Edit the description on GitHub: add that heading exactly as written (the pull request template has it), and under it write what you asked an AI tool and how you checked its answer. If you used no AI, write: No AI used. When you save the edited description, CI runs its checks again by itself.`,
    }
  }
  if (visibleText(section).replace(HINT, '').trim() === '') {
    return {
      ok: false,
      message: `AI note: empty. Under "## ${AI_NOTE_TITLE}" in your pull request's description, write what you asked an AI tool and how you checked its answer. If you used no AI, write: No AI used. When you save the edited description on GitHub, CI runs its checks again by itself.`,
    }
  }
  return { ok: true, message: 'AI note: filled in. Thank you.' }
}

// Only when run directly (node scripts/ci/ai-note.mjs), never when a test imports this file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkAiNote(process.env.PR_BODY)
  // "::error::" puts the message at the top of the CI run's summary page on GitHub.
  console.log(result.ok || !process.env.GITHUB_ACTIONS ? result.message : `::error title=AI note::${result.message}`)
  process.exit(result.ok ? 0 : 1)
}
