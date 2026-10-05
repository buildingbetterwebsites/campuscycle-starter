// A small helper for the seed: it turns a short list of headings, paragraphs and bulleted lists into
// the JSON that a rich-text field stores.
//
// WHY: Payload's rich-text editor (Lexical) does not save HTML. It saves a tree of "nodes": a root,
// with paragraphs, headings and lists inside it, and the text inside those. Writing that tree by hand
// for every page would bury the seed's actual words in brackets. With this helper the seed reads like
// the page:
//
//   richText([
//     { heading: 'Where' },
//     { paragraph: 'Workshop B, Student Centre.' },
//     { list: ['Tools', 'A tutor'] },
//     { paragraph: ['Read ', { text: 'the licence', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }, '.'] },
//   ])
//
// A paragraph or a list item is either plain text, or a list of pieces: plain text and links
// ({ text, url }).
//
// The shape below is exactly what the editor in /admin saves (checked in tests/unit/richText.test.ts),
// so an editor can open and change seeded text like any other.

/** A piece of a line: plain text, or a link with its text and the address it opens. */
export type Inline = string | { text: string; url: string }
/** One line of text: plain text, or pieces of text and links. */
export type Line = string | Inline[]
export type RichTextBlock = { heading: string } | { paragraph: Line } | { list: Line[] }

// Every block-level node carries these settings. "ltr": text runs left to right.
const BLOCK = { direction: 'ltr', format: '', indent: 0, version: 1 } as const

function textNode(text: string) {
  // format 0 is plain text (no bold or italic); "normal" mode is ordinary editable text.
  return { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }
}

function inlineNode(piece: Inline) {
  if (typeof piece === 'string') return textNode(piece)
  return {
    type: 'link',
    ...BLOCK,
    // Version 3 is the link node of @payloadcms/richtext-lexical 3.x.
    version: 3,
    // "custom": a link to an address on the web (an "internal" link would point at another record).
    // newTab false: the link opens in the same tab, like every other link on the site.
    fields: { linkType: 'custom', newTab: false, url: piece.url },
    children: [textNode(piece.text)],
  }
}

function lineNodes(line: Line) {
  return typeof line === 'string' ? [textNode(line)] : line.map(inlineNode)
}

function blockNode(block: RichTextBlock) {
  if ('heading' in block) {
    // h2: the page's own title is the h1, so headings inside the text start one level lower.
    return { type: 'heading', tag: 'h2', ...BLOCK, children: [textNode(block.heading)] }
  }
  if ('list' in block) {
    return {
      type: 'list',
      listType: 'bullet',
      start: 1,
      tag: 'ul',
      ...BLOCK,
      // value: each item's number in the list, counting from 1 (also stored for bulleted lists).
      children: block.list.map((item, index) => ({
        type: 'listitem',
        value: index + 1,
        ...BLOCK,
        children: lineNodes(item),
      })),
    }
  }
  return {
    type: 'paragraph',
    textFormat: 0,
    textStyle: '',
    ...BLOCK,
    children: lineNodes(block.paragraph),
  }
}

/** The value to save in a rich-text field, built from headings, paragraphs and lists. */
export function richText(blocks: RichTextBlock[]) {
  return {
    root: {
      type: 'root',
      ...BLOCK,
      children: blocks.map(blockNode),
    },
  }
}
