export interface ParsedAnnotation {
  startIndex: number
  endIndex: number
  text: string
  content: string
}

export interface ParsedArticle {
  title: string
  plainContent: string
  annotations: ParsedAnnotation[]
}

const ANNOTATION_REGEX = /\[ann="([^"]*)"\]([\s\S]*?)\[\/ann\]/g

export function parseMarkup(markup: string, title: string = '未命名文章'): ParsedArticle {
  const annotations: ParsedAnnotation[] = []
  let plainContent = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  const regex = new RegExp(ANNOTATION_REGEX.source, ANNOTATION_REGEX.flags)

  while ((match = regex.exec(markup)) !== null) {
    const [fullMatch, annotationContent, annotatedText] = match
    const matchStart = match.index
    const matchEnd = matchStart + fullMatch.length

    plainContent += markup.substring(lastIndex, matchStart)

    const startIndex = plainContent.length
    plainContent += annotatedText
    const endIndex = plainContent.length

    annotations.push({
      startIndex,
      endIndex,
      text: annotatedText,
      content: annotationContent
    })

    lastIndex = matchEnd
  }

  plainContent += markup.substring(lastIndex)

  return {
    title,
    plainContent,
    annotations
  }
}

export interface ArticleJsonFormat {
  version: string
  type: 'single-article'
  article: {
    title: string
    content: string
    annotations: {
      startIndex: number
      endIndex: number
      text: string
      content: string
    }[]
  }
}

export function markupToJson(markup: string, title: string = '未命名文章'): ArticleJsonFormat {
  const parsed = parseMarkup(markup, title)
  
  return {
    version: '1.0',
    type: 'single-article',
    article: {
      title: parsed.title,
      content: parsed.plainContent,
      annotations: parsed.annotations
    }
  }
}

export function jsonToMarkup(json: ArticleJsonFormat): string {
  let markup = json.article.content
  const annotations = [...json.article.annotations].sort((a, b) => b.startIndex - a.startIndex)

  for (const ann of annotations) {
    const before = markup.substring(0, ann.startIndex)
    const text = markup.substring(ann.startIndex, ann.endIndex)
    const after = markup.substring(ann.endIndex)
    markup = before + `[ann="${ann.content}"]${text}[/ann]` + after
  }

  return markup
}

export function isValidMarkup(markup: string): { valid: boolean; error?: string } {
  const stack: string[] = []
  const regex = /\[ann="[^"]*"\]|\[\/ann\]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(markup)) !== null) {
    const tag = match[0]
    if (tag.startsWith('[ann="')) {
      stack.push('open')
    } else if (tag === '[/ann]') {
      if (stack.length === 0) {
        return { valid: false, error: '多余的关闭标签 [/ann]' }
      }
      stack.pop()
    }
  }

  if (stack.length > 0) {
    return { valid: false, error: '存在未关闭的注释标签' }
  }

  return { valid: true }
}
