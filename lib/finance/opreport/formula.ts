// Tiny arithmetic expression evaluator for DERIVED rows.
// Grammar: expr = term (('+'|'-') term)*
//          term = factor (('*'|'/') factor)*
//          factor = '(' expr ')' | identifier | number | '-' factor
//
// Operand values come from `values`. Missing keys or null/undefined/NaN
// values propagate: any null operand => null result. Division by zero => null.

type Token =
  | { type: 'num'; value: number }
  | { type: 'id';  value: string }
  | { type: 'op';  value: '+' | '-' | '*' | '/' }
  | { type: 'lp' }
  | { type: 'rp' }

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue }
    if (ch === '(') { out.push({ type: 'lp' }); i++; continue }
    if (ch === ')') { out.push({ type: 'rp' }); i++; continue }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      out.push({ type: 'op', value: ch }); i++; continue
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i
      while (j < src.length && (src[j] === '.' || (src[j] >= '0' && src[j] <= '9'))) j++
      out.push({ type: 'num', value: parseFloat(src.slice(i, j)) })
      i = j; continue
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      out.push({ type: 'id', value: src.slice(i, j) })
      i = j; continue
    }
    throw new Error(`Unexpected character '${ch}' at position ${i} in formula: ${src}`)
  }
  return out
}

export function evaluateFormula(
  formula: string,
  values: Record<string, number | null | undefined>,
): number | null {
  const tokens = tokenize(formula)
  let pos = 0

  const peek = () => tokens[pos]
  const eat = () => tokens[pos++]

  const isOp = (ch: '+' | '-' | '*' | '/') => {
    const t = peek()
    return t?.type === 'op' && t.value === ch
  }

  const parseExpr = (): number | null => {
    let left = parseTerm()
    while (isOp('+') || isOp('-')) {
      const op = (eat() as { type: 'op'; value: '+' | '-' }).value
      const right = parseTerm()
      if (left === null || right === null) left = null
      else left = op === '+' ? left + right : left - right
    }
    return left
  }

  const parseTerm = (): number | null => {
    let left = parseFactor()
    while (isOp('*') || isOp('/')) {
      const op = (eat() as { type: 'op'; value: '*' | '/' }).value
      const right = parseFactor()
      if (left === null || right === null) left = null
      else if (op === '*') left = left * right
      else {
        if (right === 0) left = null
        else left = left / right
      }
    }
    return left
  }

  const parseFactor = (): number | null => {
    const tok = peek()
    if (!tok) throw new Error(`Unexpected end of formula: ${formula}`)
    if (tok.type === 'lp') {
      eat()
      const v = parseExpr()
      const closing = eat()
      if (!closing || closing.type !== 'rp') throw new Error(`Missing ) in formula: ${formula}`)
      return v
    }
    if (tok.type === 'num') { eat(); return tok.value }
    if (tok.type === 'id') {
      eat()
      const raw = values[tok.value]
      if (raw === null || raw === undefined || Number.isNaN(raw)) return null
      return raw
    }
    if (tok.type === 'op' && tok.value === '-') {
      eat()
      const v = parseFactor()
      return v === null ? null : -v
    }
    throw new Error(`Unexpected token '${JSON.stringify(tok)}' in formula: ${formula}`)
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error(`Unparsed trailing tokens in formula: ${formula}`)
  return result
}

// Topologically order rows by formula dependencies so evaluation respects data flow.
// Non-DERIVED rows are independent; DERIVED rows must come after every key they reference.
// Throws on circular dependencies.
export function topologicalOrder(rows: Array<{ row_key: string; formula: string | null }>): string[] {
  const byKey = new Map(rows.map(r => [r.row_key, r]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: string[] = []

  const deps = (formula: string): string[] => {
    const ids = new Set<string>()
    for (const tok of tokenize(formula)) if (tok.type === 'id') ids.add(tok.value)
    return Array.from(ids)
  }

  const visit = (key: string) => {
    if (visited.has(key)) return
    if (visiting.has(key)) throw new Error(`Circular dependency involving ${key}`)
    visiting.add(key)
    const row = byKey.get(key)
    if (row?.formula) {
      for (const d of deps(row.formula)) {
        if (byKey.has(d)) visit(d)
      }
    }
    visiting.delete(key)
    visited.add(key)
    ordered.push(key)
  }

  for (const r of rows) visit(r.row_key)
  return ordered
}
