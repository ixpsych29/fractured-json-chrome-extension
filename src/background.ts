import { Formatter, FracturedJsonError } from 'fracturedjsonjs';

// Background service worker fallback for pages that block extension workers (strict CSP).
// Listens for runtime messages of type 'format' and returns a `{ type: 'result'|'error', output?, message? }`.

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (!msg || msg.type !== 'format') return false;
  try {
    const formatter = new Formatter();
    let output = '';
    if (msg.mode === 'minify') {
      output = formatter.Minify(msg.text) ?? '';
    } else if (msg.mode === 'near-minify') {
      // mirror the same options used in the content worker
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

    sendResponse({ type: 'result', output });
  } catch (err: any) {
    if (err instanceof FracturedJsonError) {
      const pos = (err as FracturedJsonError).InputPosition;
      let message = err.message;
      if (pos) message += ` at row=${pos.Row+1}, col=${pos.Column+1}`;
      sendResponse({ type: 'error', message });
    } else {
      sendResponse({ type: 'error', message: (err && err.message) ? err.message : String(err) });
    }
  }
  // response sent synchronously
  return false;
});
