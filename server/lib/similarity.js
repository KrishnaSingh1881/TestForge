// ── Token-based code similarity ───────────────────────────────
// Strips identifiers/strings, keeps structural tokens, then
// computes Jaccard similarity on token multisets (bags).

const PYTHON_KEYWORDS = new Set([
  'False','None','True','and','as','assert','async','await',
  'break','class','continue','def','del','elif','else','except',
  'finally','for','from','global','if','import','in','is',
  'lambda','nonlocal','not','or','pass','raise','return',
  'try','while','with','yield',
]);

const CPP_KEYWORDS = new Set([
  'auto','break','case','catch','class','const','continue',
  'default','delete','do','double','else','enum','explicit',
  'extern','false','float','for','friend','goto','if','inline',
  'int','long','namespace','new','nullptr','operator','private',
  'protected','public','return','short','signed','sizeof',
  'static','struct','switch','template','this','throw','true',
  'try','typedef','typename','union','unsigned','using',
  'virtual','void','volatile','while',
]);

// Structural tokens we keep as-is
const STRUCTURAL = /^(\+|-|\*|\/|%|==|!=|<=|>=|<|>|&&|\|\||!|=|\(|\)|\[|\]|\{|\}|;|:|,|\.|->|::|<<|>>|\+\+|--)$/;

/**
 * Tokenise source code into a normalised token list.
 * - Keywords → kept as-is
 * - Operators / punctuation → kept as-is
 * - Identifiers → replaced with "ID"
 * - String/char literals → replaced with "STR"
 * - Numeric literals → replaced with "NUM"
 * - Comments stripped
 */
export function tokenise(code, language = 'python') {
  const keywords = language === 'cpp' ? CPP_KEYWORDS : PYTHON_KEYWORDS;
  const tokens   = [];

  // Strip single-line comments
  let src = code
    .replace(/\/\/[^\n]*/g, ' ')   // C++ //
    .replace(/#[^\n]*/g, ' ')      // Python #
    .replace(/\/\*[\s\S]*?\*\//g, ' '); // /* */

  // Strip string literals
  src = src
    .replace(/"""[\s\S]*?"""/g, 'STR')
    .replace(/'''[\s\S]*?'''/g, 'STR')
    .replace(/"(?:[^"\\]|\\.)*"/g, 'STR')
    .replace(/'(?:[^'\\]|\\.)*'/g, 'STR');

  // Tokenise with a simple regex
  const tokenRe = /[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|<<|>>|&&|\|\||->|::|[+\-*/%<>=!&|^~()[\]{};:,.\n]/g;
  let m;
  while ((m = tokenRe.exec(src)) !== null) {
    const t = m[0];
    if (t === '\n' || t === ' ') continue;
    if (keywords.has(t))         tokens.push(t);
    else if (STRUCTURAL.test(t)) tokens.push(t);
    else if (/^\d/.test(t))      tokens.push('NUM');
    else                         tokens.push('ID');
  }

  return tokens;
}

/**
 * Build a token frequency map (bag-of-tokens).
 */
function bag(tokens) {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/**
 * Jaccard similarity on token bags.
 * |intersection| / |union|  where counts are min/max respectively.
 */
export function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length && !tokensB.length) return 1;
  if (!tokensA.length || !tokensB.length) return 0;

  const bagA = bag(tokensA);
  const bagB = bag(tokensB);
  const allKeys = new Set([...bagA.keys(), ...bagB.keys()]);

  let intersection = 0;
  let union        = 0;

  for (const k of allKeys) {
    const a = bagA.get(k) ?? 0;
    const b = bagB.get(k) ?? 0;
    intersection += Math.min(a, b);
    union        += Math.max(a, b);
  }

  return union === 0 ? 0 : intersection / union;
}
