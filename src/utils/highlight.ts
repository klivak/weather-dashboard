export interface TextPart {
  text: string
  match: boolean
}

/** Split `text` around the first case-insensitive occurrence of `query` so the match can be highlighted. */
export function highlightParts(text: string, query: string): TextPart[] {
  const needle = query.trim().toLocaleLowerCase()
  const index = needle ? text.toLocaleLowerCase().indexOf(needle) : -1
  if (index < 0) return [{ text, match: false }]
  return [
    { text: text.slice(0, index), match: false },
    { text: text.slice(index, index + needle.length), match: true },
    { text: text.slice(index + needle.length), match: false },
  ].filter((part) => part.text !== '')
}
