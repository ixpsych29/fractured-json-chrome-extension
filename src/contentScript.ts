// Content script: detects raw JSON pages and replaces them with a pretty FracturedJson view.
declare const chrome: any;
(async function () {
  try {
    // Avoid running in iframes or non-top contexts
    if (window.top !== window.self) return;

    // Basic heuristics: page is plain text (no complex DOM) and appears to be JSON-like.
    const body = document.body;
    if (!body) return;

    // More robust JSON detection:
    // - allow pages served as application/json/text
    // - allow a single <pre> or a small DOM where the visible text starts with JSON characters
    // - handle Chrome's built-in JSON viewer (json-formatter custom element / shadow DOM)
    const contentType = (document as any).contentType || '';
    const isJsonMime = /\b(json|javascript)\b/i.test(contentType);
    const firstPre = body.querySelector('pre');

    // Chrome's native JSON viewer wraps content in a <json-formatter> or similar custom element.
    // Detect it by looking for known Chrome JSON viewer elements.
    const chromeJsonViewer =
      body.querySelector('json-formatter') ||
      body.querySelector('#json-formatter') ||
      body.querySelector('.json-formatter-container');

    // Try to extract raw text from Chrome's JSON viewer shadow DOM
    let rawTextFromViewer = '';
    if (chromeJsonViewer) {
      // Chrome JSON viewer stores the raw JSON in a <script> or as text content
      // The raw source is typically accessible via the page's original response body
      // We can get it from the <pre> inside the shadow root or from a hidden element
      try {
        const shadow = (chromeJsonViewer as any).shadowRoot;
        if (shadow) {
          const pre = shadow.querySelector('pre');
          if (pre) rawTextFromViewer = (pre as HTMLElement).innerText || '';
        }
      } catch (e) {
        /* ignore shadow DOM access errors */
      }
    }

    const bodyText = (body.innerText || '').trim();
    const startsWithJson = !!bodyText && /^[\[{\""]/.test(bodyText);
    const smallDom = body.childElementCount <= 3;

    // Also detect when Chrome has rendered a JSON viewer page: the URL path often ends with
    // a JSON-like response and contentType is set correctly even if the DOM is complex.
    const isLikelyJsonPage = isJsonMime || chromeJsonViewer != null;

    if (
      !(
        isLikelyJsonPage ||
        (firstPre && startsWithJson) ||
        (smallDom && startsWithJson)
      )
    )
      return;

    // Extract raw JSON text — prefer the pre element, then body text, then viewer extraction
    let rawText = '';
    if (firstPre) {
      rawText = (firstPre as HTMLElement).innerText || '';
    } else if (rawTextFromViewer) {
      rawText = rawTextFromViewer;
    } else {
      rawText = bodyText;
    }
    rawText = rawText.trim();

    // If we still don't have raw text (e.g., Chrome JSON viewer hides it), fetch it directly
    if (!rawText && isJsonMime) {
      try {
        const resp = await fetch(location.href);
        rawText = await resp.text();
        rawText = rawText.trim();
      } catch (fetchErr) {
        console.debug('FracturedJson: fetch fallback failed', fetchErr);
      }
    }

    if (!rawText) return;

    // Quick sanity check: must start with JSON-like characters
    if (!/^[\[{"]/.test(rawText)) return;

    // Insert extension stylesheet (declared web_accessible_resources).
    // NOTE: some API pages (strict CSP) can block external extension CSS —
    // we detect that and fall back to inline-styles for token colouring.
    const cssUrl = chrome.runtime.getURL('styles.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    (document.head || document.documentElement).appendChild(link);

    // track whether the stylesheet actually applied (CSP may block it)
    let cssLoaded = false;
    link.addEventListener('load', () => {
      cssLoaded = true;
    });
    link.addEventListener('error', () => {
      cssLoaded = false;
    });

    // Small container while formatting
    const wrapper = document.createElement('div');
    wrapper.id = 'fractured-json-page-root';
    wrapper.innerHTML = `
      <div id="fj-controls">
        <strong>Fractured JSON</strong>

        <div style="display:flex;gap:8px;align-items:center;">
          <label><input name="fj-mode" type="radio" value="reformat" checked /> Pretty‑print</label>
          <label><input name="fj-mode" type="radio" value="minify" /> Minify</label>
          <label><input name="fj-mode" type="radio" value="near-minify" /> Near‑minify</label>
        </div>

        <label style="margin-left:auto;"><input id="fj-line-toggle" type="checkbox" /> Line numbers</label>
        <label>Theme: <select id="fj-theme-select"><option value="dark">Dark</option><option value="light">Light</option><option value="cobalt">Cobalt</option></select></label>

        <button id="fj-view-raw">View raw</button>
        <button id="fj-download">Download</button>
        <span id="fj-status" style="margin-left:8px;color:#9aa4b2;font-size:12px"></span>
      </div>

      <div id="fj-browser-window">
        <div id="fj-browser-titlebar">
          <div id="fj-traffic-lights">
            <span class="fj-dot fj-dot-red"   title="Close"></span>
            <span class="fj-dot fj-dot-yellow" title="Minimise"></span>
            <span class="fj-dot fj-dot-green"  title="Maximise"></span>
          </div>
          <div id="fj-addressbar">
            <svg id="fj-lock-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="7" width="8" height="6" rx="1.2" stroke="currentColor" stroke-width="1.3"/>
              <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span id="fj-url-display"></span>
          </div>
        </div>
        <div id="fj-browser-body">
          <div id="outputFrame">
            <pre id="outputPre"></pre>
          </div>
        </div>
      </div>
      <textarea id="fj-raw-output" style="display:none"></textarea>
    `;

    // Replace/overlay document contents safely (handles Chrome JSON viewer and text-node pages)
    try {
      // remove all body children (works when body is writable, handles text-node pages)
      if (document.body) {
        while (document.body.firstChild)
          document.body.removeChild(document.body.firstChild);
      }
      // best-effort clear of the root element
      try {
        document.documentElement.innerHTML = '';
      } catch (e) {
        /* ignore */
      }
    } catch (err) {
      // if clearing fails, overlay the UI so it's still usable
      wrapper.style.position = 'fixed';
      wrapper.style.top = '8px';
      wrapper.style.left = '8px';
      wrapper.style.right = '8px';
      wrapper.style.bottom = '8px';
      wrapper.style.zIndex = '2147483647';
      wrapper.style.pointerEvents = 'auto';
    }

    // set a clear page title and append the viewer
    try {
      document.title = 'Fractured JSON — pretty view';
    } catch (e) {
      /* ignore */
    }
    (document.body || document.documentElement).appendChild(wrapper);

    // populate the browser-chrome address bar with the real page URL
    const urlDisplay = document.getElementById('fj-url-display');
    if (urlDisplay) urlDisplay.textContent = location.href;

    // fallback probe after a short delay (covers pages that silently ignore extension styles)
    setTimeout(() => {
      try {
        const probe = document.createElement('span');
        probe.className = 'tok-key';
        probe.style.display = 'none';
        wrapper.appendChild(probe);
        const computed = getComputedStyle(probe).color || '';
        wrapper.removeChild(probe);
        if (
          computed &&
          computed !== 'rgb(0, 0, 0)' &&
          computed !== 'rgba(0, 0, 0, 0)'
        )
          cssLoaded = true;
      } catch (e) {
        /* ignore */
      }
    }, 50);

    const statusEl = document.getElementById('fj-status') as HTMLElement;
    const outputPre = document.getElementById('outputPre') as HTMLElement;
    const rawArea = document.getElementById(
      'fj-raw-output',
    ) as HTMLTextAreaElement;
    const viewRawBtn = document.getElementById(
      'fj-view-raw',
    ) as HTMLButtonElement;
    const downloadBtn = document.getElementById(
      'fj-download',
    ) as HTMLButtonElement;
    const modeRadios = wrapper.querySelectorAll(
      'input[name="fj-mode"]',
    ) as NodeListOf<HTMLInputElement>;
    const lineToggle = document.getElementById(
      'fj-line-toggle',
    ) as HTMLInputElement;
    const themeSelect = document.getElementById(
      'fj-theme-select',
    ) as HTMLSelectElement;

    statusEl.textContent = 'Formatting…';

    // set up formatter + UI wiring so buttons work even if auto-format/whitelist prevents the automatic run
    let currentMode = 'reformat';

    // Helper: send message to background and return a Promise (avoids the callback-based
    // "message port closed" warning and makes error handling cleaner).
    function formatViaBackground(text: string, mode: string): Promise<any> {
      return new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(
            { type: 'format', text, mode },
            (resp: any) => {
              if (chrome.runtime.lastError) {
                reject(
                  new Error(
                    chrome.runtime.lastError.message ||
                      'background unavailable',
                  ),
                );
                return;
              }
              resolve(resp);
            },
          );
        } catch (e) {
          reject(e);
        }
      });
    }

    const doFormat = async (mode: string, showLines: boolean) => {
      console.debug('FracturedJson: doFormat', mode, { showLines });
      // immediate preview so user sees data before worker finishes
      rawArea.value = rawText;
      const PREVIEW_THRESHOLD = 200_000;
      if (rawText.length <= PREVIEW_THRESHOLD) {
        // attempt quick client-side highlight as a preview (use inline styles so CSP can't hide colours)
        try {
          renderHighlighted(rawText, outputPre, showLines, true);
        } catch (e) {
          outputPre.textContent = rawText;
        }
      } else {
        // for very large payloads, show plain text preview quickly
        outputPre.textContent = rawText;
      }

      statusEl.textContent = 'Formatting… (preview shown)';

      // Strategy: Try a direct extension-URL Worker first (works on most pages).
      // If that fails (cross-origin or CSP), skip blob-URL fallbacks entirely —
      // blob URLs inherit the page's origin and are blocked by `default-src 'none'`
      // on strict-CSP pages like api.github.com.
      // Instead, fall back directly to the background service worker.
      const workerUrl = chrome.runtime.getURL('contentWorker.js');
      let w: Worker | null = null;
      let workerFailed = false;

      try {
        // preferred: direct module worker (works on many pages)
        w = new Worker(workerUrl, { type: 'module' });
      } catch (err) {
        console.debug(
          'FracturedJson: direct Worker() failed, will use background fallback',
          err,
        );
        workerFailed = true;
      }

      if (workerFailed || !w) {
        // Skip blob-URL worker attempts — they inherit the page origin and are blocked
        // by strict CSP (e.g. `default-src 'none'` on api.github.com, api.*, etc.).
        // Go straight to the background service worker for formatting.
        console.debug(
          'FracturedJson: using background service worker for formatting',
        );
        try {
          const resp = await formatViaBackground(rawText, mode);
          if (!resp) {
            statusEl.textContent =
              'Background returned no response — showing raw';
            outputPre.textContent = rawText;
            rawArea.value = rawText;
            return;
          }
          if (resp.type === 'result') {
            rawArea.value = resp.output || rawText;
            try {
              renderHighlighted(
                resp.output || rawText,
                outputPre,
                showLines,
                !cssLoaded,
              );
            } catch (err) {
              outputPre.textContent = resp.output || rawText;
            }
            statusEl.textContent = '';
          } else if (resp.type === 'error') {
            statusEl.textContent = 'Parse error — showing raw';
            outputPre.textContent = rawText;
            rawArea.value = rawText;
          }
        } catch (bgErr) {
          console.debug('FracturedJson: background.format failed', bgErr);

          // Last-resort: attempt an *in-page* synchronous format for small files
          const INLINE_FALLBACK_LIMIT = 150_000; // characters
          if (rawText.length <= INLINE_FALLBACK_LIMIT) {
            try {
              const mod = await import('fracturedjsonjs');
              const Formatter = mod.Formatter;
              const f = new Formatter();
              let out = '';
              if (mode === 'minify') out = f.Minify(rawText) ?? '';
              else if (mode === 'near-minify') {
                f.Options.MaxTotalLineLength = Number.MAX_VALUE;
                f.Options.MaxInlineComplexity = Number.MAX_VALUE;
                f.Options.MaxCompactArrayComplexity = -1;
                f.Options.MaxPropNamePadding = -1;
                f.Options.MaxTableRowComplexity = -1;
                f.Options.AlwaysExpandDepth = 0;
                f.Options.IndentSpaces = 0;
                f.Options.UseTabToIndent = false;
                f.Options.CommaPadding = false;
                f.Options.ColonPadding = false;
                f.Options.SimpleBracketPadding = false;
                f.Options.NestedBracketPadding = false;
                f.Options.CommentPadding = false;
                out = f.Reformat(rawText) ?? '';
              } else {
                out = f.Reformat(rawText) ?? '';
              }

              rawArea.value = out;
              try {
                renderHighlighted(out, outputPre, showLines, !cssLoaded);
              } catch (err) {
                outputPre.textContent = out;
              }
              statusEl.textContent = '';
              return;
            } catch (inlineErr) {
              console.debug(
                'FracturedJson: in-page fallback failed',
                inlineErr,
              );
            }
          }

          statusEl.textContent = 'No worker + background failed — showing raw';
          outputPre.textContent = rawText;
          rawArea.value = rawText;
        }
        return;
      }

      // post-format request to worker
      w.postMessage({
        type: 'format',
        text: rawText,
        mode,
        highlight: true,
        showLineNumbers: showLines,
      });
      w.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg) return;
        if (msg.type === 'result') {
          rawArea.value = msg.output || rawText;

          // replace preview with worker-produced highlighted HTML if available
          if (msg.html) {
            if (cssLoaded) {
              outputPre.innerHTML = msg.html;
            } else {
              // worker produced HTML but page CSS is blocked — render using inline styles instead
              try {
                renderHighlighted(
                  msg.output || rawText,
                  outputPre,
                  showLines,
                  true,
                );
              } catch (err) {
                outputPre.textContent = msg.output || rawText;
              }
            }
          } else {
            // worker returned plain output — render highlighted, prefer inline styles when CSS not present
            try {
              renderHighlighted(
                msg.output || rawText,
                outputPre,
                showLines,
                !cssLoaded,
              );
            } catch (err) {
              outputPre.textContent = msg.output || rawText;
            }
          }

          statusEl.textContent = '';
        } else if (msg.type === 'error') {
          statusEl.textContent = 'Parse error — showing raw';
          outputPre.textContent = rawText;
          rawArea.value = rawText;
        }
        try {
          w!.terminate();
        } catch (e) {}
      };
      w.onerror = (err) => {
        console.debug('FracturedJson: worker runtime error', err);
        // Worker failed at runtime (e.g. CSP violation after construction) — fall back to background
        try {
          w!.terminate();
        } catch (e) {}
        statusEl.textContent = 'Worker blocked — trying background…';
        formatViaBackground(rawText, mode)
          .then((resp) => {
            if (!resp) {
              statusEl.textContent =
                'Background returned no response — showing raw';
              outputPre.textContent = rawText;
              rawArea.value = rawText;
              return;
            }
            if (resp.type === 'result') {
              rawArea.value = resp.output || rawText;
              try {
                renderHighlighted(
                  resp.output || rawText,
                  outputPre,
                  showLines,
                  !cssLoaded,
                );
              } catch (e) {
                outputPre.textContent = resp.output || rawText;
              }
              statusEl.textContent = '';
            } else {
              statusEl.textContent = 'Parse error — showing raw';
              outputPre.textContent = rawText;
              rawArea.value = rawText;
            }
          })
          .catch(() => {
            statusEl.textContent = 'Worker error — showing raw';
            outputPre.textContent = rawText;
            rawArea.value = rawText;
          });
      };
    };

    // wire UI controls immediately so they always respond to user interaction
    function handleModeChange(r: HTMLInputElement) {
      // ensure radio state is current (click fallback) and run formatter
      if (!r.checked) r.checked = true;
      currentMode = r.value;
      try {
        chrome.storage.local.set({ lastMode: currentMode });
      } catch (e) {
        /* ignore */
      }
      console.debug('FracturedJson: mode change ->', currentMode);
      doFormat(currentMode, lineToggle.checked);
    }

    modeRadios.forEach((r) => {
      r.addEventListener('change', () => handleModeChange(r));
      r.addEventListener('click', () => handleModeChange(r));
    });

    lineToggle.addEventListener('change', () => {
      try {
        chrome.storage.local.set({ showLineNumbers: lineToggle.checked });
      } catch (e) {}
      doFormat(currentMode, lineToggle.checked);
    });
    themeSelect.addEventListener('change', () => {
      const t = themeSelect.value;
      try {
        chrome.storage.local.set({ theme: t });
      } catch (e) {}
      wrapper.classList.toggle('theme-light', t === 'light');
      wrapper.classList.toggle('theme-cobalt', t === 'cobalt');
    });

    // consult user settings (auto-format, domain whitelist, theme, line numbers)
    chrome.storage.local.get(
      {
        autoFormatEnabled: true,
        allowedDomains: '',
        theme: 'dark',
        showLineNumbers: true,
        lastMode: 'reformat',
      },
      (items: {
        autoFormatEnabled?: boolean;
        allowedDomains?: string;
        theme?: string;
        showLineNumbers?: boolean;
        lastMode?: string;
      }) => {
        const host = location.hostname;
        const allowed = (items.allowedDomains || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);

        // apply stored UI prefs
        wrapper.classList.toggle('theme-light', items.theme === 'light');
        wrapper.classList.toggle('theme-cobalt', items.theme === 'cobalt');
        themeSelect.value = items.theme ?? 'dark';
        lineToggle.checked = Boolean(items.showLineNumbers);

        // default mode selection (restore last mode if present)
        const preferredMode = items.lastMode || 'reformat';
        const defaultRadio = wrapper.querySelector(
          `input[name="fj-mode"][value="${preferredMode}"]`,
        ) as HTMLInputElement;
        if (defaultRadio) defaultRadio.checked = true;
        currentMode = preferredMode;

        if (!items.autoFormatEnabled) {
          outputPre.textContent = rawText;
          rawArea.value = rawText;
          statusEl.textContent =
            'Auto-format disabled — use the controls to format manually';
          return;
        }
        if (
          allowed.length > 0 &&
          !allowed.some((d: string) => host === d || host.endsWith('.' + d))
        ) {
          outputPre.textContent = rawText;
          rawArea.value = rawText;
          statusEl.textContent =
            'Domain not whitelisted — use the controls to format manually';
          return;
        }

        // initial render
        doFormat(currentMode, lineToggle.checked);
      },
    );

    viewRawBtn.addEventListener('click', () => {
      // toggle raw / pretty
      if (rawArea.style.display === 'none') {
        rawArea.style.display = 'block';
        rawArea.style.width = 'calc(100% - 28px)';
        rawArea.style.height = '500px';
        outputPre.style.display = 'none';
        viewRawBtn.textContent = 'Pretty';
      } else {
        rawArea.style.display = 'none';
        outputPre.style.display = 'block';
        viewRawBtn.textContent = 'View raw';
      }
    });

    downloadBtn.addEventListener('click', () => {
      const text = rawArea.value || rawText;
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        (location.pathname.split('/').pop() || 'fractured') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // --- simple syntax highlight (copied & adapted from popup) ---
    function escapeHtml(s: string) {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    function isKeyFollow(text: string, endIndex: number) {
      let i = endIndex;
      while (i < text.length && /\s/.test(text[i])) i++;
      return text[i] === ':';
    }

    // Inline-style mappings for token colours (used when page CSP blocks extension CSS)
    const TOKEN_INLINE_STYLES: Record<string, Record<string, string>> = {
      dark: {
        'tok-key': 'color:#ffb86b;font-weight:600',
        'tok-string': 'color:#98c379',
        'tok-number': 'color:#ff79c6',
        'tok-boolean': 'color:#56b6c2;font-weight:600',
        'tok-comment': 'color:#7a828f;font-style:italic',
        'tok-punct': 'color:#c8ccd4',
      },
      light: {
        'tok-key': 'color:#b7791f;font-weight:600',
        'tok-string': 'color:#2f855a',
        'tok-number': 'color:#b83280',
        'tok-boolean': 'color:#117a8b;font-weight:600',
        'tok-comment': 'color:#6b7280',
        'tok-punct': 'color:#374151',
      },
      cobalt: {
        'tok-key': 'color:#ffd580;font-weight:600',
        'tok-string': 'color:#95e454',
        'tok-number': 'color:#fd8bff',
        'tok-boolean': 'color:#4fd6ff;font-weight:600',
        'tok-comment': 'color:#7790a0',
        'tok-punct': 'color:#cfeefb',
      },
    };

    function highlightJsonToHtml(
      text: string,
      showLineNumbers = false,
      useInlineStyles = false,
    ) {
      const tokenizer =
        /(\"(?:\\.|[^"\\])*\")|(\/\/.*?$|\/\*[\s\S]*?\*\/)|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/gm;
      let lastIndex = 0;
      let out = '';

      const theme = wrapper.classList.contains('theme-cobalt')
        ? 'cobalt'
        : wrapper.classList.contains('theme-light')
          ? 'light'
          : 'dark';
      const inlineMap = TOKEN_INLINE_STYLES[theme] || TOKEN_INLINE_STYLES.dark;

      for (const m of text.matchAll(tokenizer)) {
        const idx = m.index ?? 0;
        out += escapeHtml(text.slice(lastIndex, idx));
        const token = m[0];
        if (m[1]) {
          // string
          const isKey = isKeyFollow(text, idx + token.length);
          if (useInlineStyles) {
            const style = inlineMap[isKey ? 'tok-key' : 'tok-string'];
            out += `<span style="${style}">${escapeHtml(token)}</span>`;
          } else {
            out += `<span class="${isKey ? 'tok-key' : 'tok-string'}">${escapeHtml(token)}</span>`;
          }
        } else if (m[2]) {
          // comment
          if (useInlineStyles)
            out += `<span style="${inlineMap['tok-comment']}">${escapeHtml(token)}</span>`;
          else out += `<span class="tok-comment">${escapeHtml(token)}</span>`;
        } else if (m[3]) {
          // boolean/null
          if (useInlineStyles)
            out += `<span style="${inlineMap['tok-boolean']}">${escapeHtml(token)}</span>`;
          else out += `<span class="tok-boolean">${escapeHtml(token)}</span>`;
        } else if (/^-?\d/.test(token)) {
          if (useInlineStyles)
            out += `<span style="${inlineMap['tok-number']}">${escapeHtml(token)}</span>`;
          else out += `<span class="tok-number">${escapeHtml(token)}</span>`;
        } else if (/^[{}\[\],:]$/.test(token)) {
          if (useInlineStyles)
            out += `<span style="${inlineMap['tok-punct']}">${escapeHtml(token)}</span>`;
          else out += `<span class="tok-punct">${escapeHtml(token)}</span>`;
        } else {
          out += escapeHtml(token);
        }
        lastIndex = idx + token.length;
      }
      out += escapeHtml(text.slice(lastIndex));

      if (showLineNumbers) {
        const lines = out.split('\n');
        if (useInlineStyles) {
          // inline fallback — gutter simulated with padding + absolute positioned numbers
          return lines
            .map(
              (l, i) =>
                `<span style="display:block;padding-left:60px;position:relative;line-height:1.45"><span style="position:absolute;left:0;width:52px;text-align:right;padding-right:8px;box-sizing:border-box;color:rgba(255,255,255,0.2);font-size:11px;font-family:ui-monospace,monospace;user-select:none">${i + 1}</span>${l || '&nbsp;'}</span>`,
            )
            .join('');
        }
        return lines
          .map(
            (l, i) =>
              `<span class="line" data-ln="${i + 1}">${l || '&nbsp;'}</span>`,
          )
          .join('');
      }
      return out;
    }

    function renderHighlighted(
      text: string,
      container: HTMLElement,
      showLineNumbers = false,
      useInlineStyles = false,
    ) {
      container.innerHTML = highlightJsonToHtml(
        text,
        showLineNumbers,
        useInlineStyles,
      );
    }
  } catch (err) {
    // silently fail — don't break regular pages
    console.debug('FracturedJson content script skip:', err);
  }
})();
