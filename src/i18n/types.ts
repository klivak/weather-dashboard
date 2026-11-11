import type { en } from './en'

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }

/** Shape every locale must match; English is the source of truth. */
export type Messages = Widen<typeof en>

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** Every dotted key, e.g. 'nav.home'. */
export type MessageKey = Paths<Messages>

export type MessageParams = Record<string, string | number>
