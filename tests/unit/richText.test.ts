import { describe, expect, it } from 'vitest'
import { createHeadlessEditor } from '@payloadcms/richtext-lexical/lexical/headless'
import { HeadingNode } from '@payloadcms/richtext-lexical/lexical/rich-text'
import { ListItemNode, ListNode } from '@payloadcms/richtext-lexical/lexical/list'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { LinkNode } from '@payloadcms/richtext-lexical'
import { richText } from '../../src/seed/richText'

const text = (value: string) => ({ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: value, version: 1 })
const block = { direction: 'ltr', format: '', indent: 0, version: 1 }

describe('richText (the seed\'s helper for rich-text fields)', () => {
  it('builds the editor state the rich-text editor saves: a heading, a paragraph and a bulleted list', () => {
    expect(richText([{ heading: 'Photo credits' }, { paragraph: 'Hello.' }, { list: ['One', 'Two'] }])).toEqual({
      root: {
        type: 'root',
        ...block,
        children: [
          { type: 'heading', tag: 'h2', ...block, children: [text('Photo credits')] },
          { type: 'paragraph', textFormat: 0, textStyle: '', ...block, children: [text('Hello.')] },
          {
            type: 'list',
            listType: 'bullet',
            start: 1,
            tag: 'ul',
            ...block,
            children: [
              { type: 'listitem', value: 1, ...block, children: [text('One')] },
              { type: 'listitem', value: 2, ...block, children: [text('Two')] },
            ],
          },
        ],
      },
    })
  })

  it('is read back unchanged by the same Lexical editor the rich-text field uses', () => {
    const state = richText([{ heading: 'A heading' }, { paragraph: 'A paragraph.' }, { list: ['First', 'Second'] }])
    const editor = createHeadlessEditor({
      nodes: [HeadingNode, ListNode, ListItemNode],
      onError: (error) => {
        throw error
      },
    })
    editor.setEditorState(editor.parseEditorState(JSON.stringify(state)))
    const roundTrip = JSON.parse(JSON.stringify(editor.getEditorState().toJSON()))
    // Without a browser window, Lexical cannot work out the writing direction and saves null there;
    // the editor in /admin saves "ltr". Everything else must come back exactly as it went in.
    const withoutDirection = (value: unknown) => JSON.parse(JSON.stringify(value).replace(/"direction":(null|"ltr")/g, '"direction":"?"'))
    expect(withoutDirection(roundTrip)).toEqual(withoutDirection(state))
  })

  it('renders to HTML with Payload\'s own converter', () => {
    const html = convertLexicalToHTML({
      data: richText([{ heading: 'Where' }, { paragraph: 'Workshop B, Student Centre.' }, { list: ['Tools', 'A tutor'] }]),
      disableContainer: true,
    })
    expect(html).toContain('<h2>Where</h2>')
    expect(html).toContain('<p>Workshop B, Student Centre.</p>')
    expect(html).toMatch(/<ul[^>]*>.*<li[^>]*>Tools<\/li>.*<li[^>]*>A tutor<\/li>.*<\/ul>/)
  })

  it('makes links: a link node the editor reads back unchanged, rendered as <a href>', () => {
    const state = richText([
      { paragraph: ['Read ', { text: 'the licence', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }, '.'] },
      { list: [[{ text: 'A photo', url: 'https://commons.wikimedia.org/wiki/File:A.jpg' }, ' by Someone'], 'Plain item'] },
    ])
    // The shape the link feature of the editor in /admin saves (version 3, a "custom" link to a URL).
    expect(state.root.children[0].children[1]).toEqual({
      type: 'link',
      ...block,
      version: 3,
      fields: { linkType: 'custom', newTab: false, url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      children: [text('the licence')],
    })
    const editor = createHeadlessEditor({
      nodes: [HeadingNode, ListNode, ListItemNode, LinkNode],
      onError: (error) => {
        throw error
      },
    })
    editor.setEditorState(editor.parseEditorState(JSON.stringify(state)))
    const roundTrip = JSON.parse(JSON.stringify(editor.getEditorState().toJSON()))
    const withoutDirection = (value: unknown) => JSON.parse(JSON.stringify(value).replace(/"direction":(null|"ltr")/g, '"direction":"?"'))
    expect(withoutDirection(roundTrip)).toEqual(withoutDirection(state))

    const html = convertLexicalToHTML({ data: state, disableContainer: true })
    expect(html).toContain('<p>Read <a href="https://creativecommons.org/licenses/by-sa/4.0/">the licence</a>.</p>')
    expect(html).toMatch(/<li[^>]*><a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:A\.jpg">A photo<\/a> by Someone<\/li>/)
    expect(html).toMatch(/<li[^>]*>Plain item<\/li>/)
  })
})
