import { Formatter, FracturedJsonError } from 'fracturedjsonjs';

self.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg) return;
  (async () => {
    try {
      if (msg.type === 'format') {
        const formatter = new Formatter();
        let output = '';
        if (msg.mode === 'minify') {
          output = formatter.Minify(msg.text) ?? '';
        } else if (msg.mode === 'near-minify') {
          formatter.Options.MaxTotalLineLength = Number.MAX_VALUE;
          formatter.Options.MaxInlineComplexity = Number.MAX_VALUE;
          formatter.Options.MaxCompactArrayComplexity = -1;
          formatter.Options.MaxPropNamePadding = -1;
          formatter.Options.MaxTableRowComplexity = -1;
          formatter.Options.AlwaysExpandDepth = 0;
          formatter.Options.IndentSpaces = 0;
          formatter.Options.UseTabToIndent = false;
          formatter.Options.CommaPadding = false;
          formatter.Options.ColonPadding = false;
          formatter.Options.SimpleBracketPadding = false;
          formatter.Options.NestedBracketPadding = false;
          formatter.Options.CommentPadding = false;
          output = formatter.Reformat(msg.text) ?? '';
        } else {
          output = formatter.Reformat(msg.text) ?? '';
        }
        // If caller requested highlighted HTML, produce it here (worker-side highlighting)
        if (msg.highlight) {
          const html = highlightJsonToHtml(output, Boolean(msg.showLineNumbers));
          (self as any).postMessage({ type: 'result', output, html });
        } else {
          (self as any).postMessage({ type: 'result', output });
        }
      }
    } catch (err: any) {
      if (err instanceof FracturedJsonError) {
        const pos = (err as FracturedJsonError).InputPosition;
        let message = err.message;
        if (pos) message += ` at row=${pos.Row+1}, col=${pos.Column+1}`;
        (self as any).postMessage({ type: 'error', message });
      } else {
        (self as any).postMessage({ type: 'error', message: (err && err.message) ? err.message : String(err) });
      }
    }
  })();
};

// Simple, fast tokenizer + line-wrapping for worker-side highlighting
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function isKeyFollow(text: string, endIndex: number) {
  let i = endIndex;
  while (i < text.length && /\s/.test(text[i])) i++;
  return text[i] === ':';
}
function highlightJsonToHtml(text: string, showLineNumbers: boolean) {
  const tokenizer = /(\"(?:\\.|[^\"\\])*\")|(\/\/.*?$|\/\*[\s\S]*?\*\/)|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/gm;
  let lastIndex = 0;
  let out = '';
  for (const m of text.matchAll(tokenizer)) {
    const idx = m.index ?? 0;
    out += escapeHtml(text.slice(lastIndex, idx));
    const token = m[0];
    if (m[1]) { // string
      const isKey = isKeyFollow(text, idx + token.length);
      out += `<span class="${isKey? 'tok-key' : 'tok-string'}">${escapeHtml(token)}</span>`;
    } else if (m[2]) { // comment
      out += `<span class="tok-comment">${escapeHtml(token)}</span>`;
    } else if (m[3]) { // boolean/null
      out += `<span class="tok-boolean">${escapeHtml(token)}</span>`;
    } else if (/^-?\d/.test(token)) {
      out += `<span class="tok-number">${escapeHtml(token)}</span>`;
    } else if (/^[{}\[\],:]$/.test(token)) {
      out += `<span class="tok-punct">${escapeHtml(token)}</span>`;
    } else {
      out += escapeHtml(token);
    }
    lastIndex = idx + token.length;
  }
  out += escapeHtml(text.slice(lastIndex));

  if (showLineNumbers) {
    return out.split('\n').map(l => `<span class="line">${l || '&nbsp;'}</span>`).join('\n');
  }
  return out;
}