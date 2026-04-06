import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
})

export function renderMarkdown(text: string): string {
  if (!text) return ''
  return md.render(text)
}

export default md
