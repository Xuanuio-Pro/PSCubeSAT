import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { authorizedFetch } from '../../contexts/auth-api';
import {
  formatCodeLanguageLabel,
  normalizeCodeLanguage,
  tokenizeCodeLines,
} from './code-highlight.js';
import { isImageOnlyParagraph } from './markdown-figure.js';
import { normalizeDisplayMath } from './markdown-math.js';
import { clampZoom, computeFitZoom, computeInlineMermaidLayout, parseSvgDimensions } from './mermaid-svg.js';
import './doc-viewer.css';

const CALLOUT_TITLES = {
  note: 'Ghi chú',
  tip: 'Mẹo kỹ thuật',
  important: 'Lưu ý quan trọng',
  warning: 'Cảnh báo',
  caution: 'Thận trọng',
};

const MERMAID_FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

let mermaidInitialized = false;
let mermaidSeq = 0;

function extractText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) {
    const props = /** @type {{ children?: import('react').ReactNode }} */ (node.props);
    return extractText(props.children);
  }
  return '';
}

function parseCallout(children) {
  const items = Children.toArray(children);
  const firstIdx = items.findIndex(child => isValidElement(child) && child.type === 'p');
  if (firstIdx === -1) return null;

  const firstP = /** @type {import('react').ReactElement<{ children?: import('react').ReactNode }>} */ (items[firstIdx]);
  const pChildren = Children.toArray(firstP.props.children);
  if (!pChildren.length || typeof pChildren[0] !== 'string') return null;

  const match = pChildren[0].match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*\n|\s+|$)/i);
  if (!match) return null;

  const kind = match[1].toLowerCase();
  const remainder = pChildren[0].slice(match[0].length);
  const nextPChildren = remainder ? [remainder, ...pChildren.slice(1)] : pChildren.slice(1);
  const cleanedFirstP = nextPChildren.length > 0 ? cloneElement(firstP, {}, ...nextPChildren) : null;
  const body = [
    ...items.slice(0, firstIdx),
    ...(cleanedFirstP ? [cleanedFirstP] : []),
    ...items.slice(firstIdx + 1),
  ];
  return { kind, body };
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 2h4v4M14 2l-4.5 4.5M6 14H2v-4M2 14l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full-screen viewer shared by Mermaid diagrams and doc images: zoom buttons,
 * Ctrl + wheel, drag-to-pan and Escape to close.
 *
 * @param {{
 *   title: string,
 *   dims: { width: number, height: number } | null,
 *   initialFit?: boolean,
 *   onClose: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
function ZoomModal({ title, dims, initialFit = false, onClose, children }) {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const dragRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const fitZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dims) return 1;
    // The canvas padding (24px each side) is not usable drawing area.
    return computeFitZoom(dims, canvas.clientWidth - 48, canvas.clientHeight - 48);
  }, [dims]);

  useEffect(() => {
    // Large figures open fitted to the screen; small ones are never upscaled on open.
    if (initialFit) setZoom(Math.min(1, fitZoom()));
  }, [initialFit, fitZoom]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /** @param {KeyboardEvent} event */
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  /** @param {import('react').WheelEvent<HTMLDivElement>} event */
  const handleWheel = useCallback(event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setZoom(z => clampZoom(z + delta));
  }, []);

  /** @param {import('react').MouseEvent<HTMLDivElement>} event */
  const startDrag = useCallback(event => {
    const canvas = canvasRef.current;
    if (event.button !== 0 || !canvas) return;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    };
    setIsDragging(true);
  }, []);

  /** @param {import('react').MouseEvent<HTMLDivElement>} event */
  const moveDrag = useCallback(event => {
    const state = dragRef.current;
    const canvas = canvasRef.current;
    if (!state.active || !canvas) return;
    event.preventDefault();
    canvas.scrollLeft = state.scrollLeft - (event.clientX - state.startX);
    canvas.scrollTop = state.scrollTop - (event.clientY - state.startY);
  }, []);

  const endDrag = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);
  }, []);

  if (typeof document === 'undefined') return null;

  const stageStyle = dims
    ? { width: `${Math.round(dims.width * zoom)}px`, minWidth: `${Math.round(dims.width * zoom)}px` }
    : { width: `${Math.round(zoom * 100)}%` };

  return createPortal(
    <div
      className="doc-mermaid-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="doc-mermaid-modal">
        <div className="doc-mermaid-modal-header">
          <div className="doc-mermaid-modal-title">
            <strong>{title}</strong>
            <span>Kéo chuột để di chuyển · Ctrl + cuộn để thu phóng</span>
          </div>
          <div className="doc-mermaid-modal-controls">
            <button type="button" className="doc-mermaid-btn" onClick={() => setZoom(z => clampZoom(z - 0.25))} aria-label="Thu nhỏ">
              −
            </button>
            <span className="doc-mermaid-zoom-value">{Math.round(zoom * 100)}%</span>
            <button type="button" className="doc-mermaid-btn" onClick={() => setZoom(z => clampZoom(z + 0.25))} aria-label="Phóng to">
              +
            </button>
            <button type="button" className="doc-mermaid-btn" onClick={() => setZoom(1)}>
              100%
            </button>
            <button type="button" className="doc-mermaid-btn" onClick={() => setZoom(fitZoom())}>
              Vừa màn hình
            </button>
            <button
              type="button"
              className="doc-mermaid-btn doc-mermaid-btn--close"
              aria-label="Đóng cửa sổ phóng to"
              onClick={onClose}
            >
              ✕ Đóng
            </button>
          </div>
        </div>
        <div
          ref={canvasRef}
          className={`doc-mermaid-modal-canvas ${isDragging ? 'is-dragging' : ''}`}
          onWheel={handleWheel}
          onMouseDown={startDrag}
          onMouseMove={moveDrag}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          <div className="doc-mermaid-modal-stage" style={stageStyle}>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MermaidDiagram({ code }) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const [inlineMode, setInlineMode] = useState(/** @type {'readable' | 'actual' | 'fit'} */ ('fit'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDraggingInline, setIsDraggingInline] = useState(false);

  const inlineViewportRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const dragStateRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSvg('');
    setInlineMode('fit');
    setIsModalOpen(false);
    import('mermaid')
      .then(async mod => {
        if (typeof document !== 'undefined' && document.fonts?.ready) {
          await document.fonts.ready.catch(() => {});
        }
        const mermaid = mod.default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: 'default',
            fontFamily: MERMAID_FONT_FAMILY,
            flowchart: {
              htmlLabels: true,
              useMaxWidth: false,
              padding: 18,
              wrappingWidth: 260,
              nodeSpacing: 45,
              rankSpacing: 55,
            },
            sequence: { useMaxWidth: false },
            state: { useMaxWidth: false },
            themeVariables: {
              fontFamily: MERMAID_FONT_FAMILY,
              fontSize: '14px',
            },
          });
          mermaidInitialized = true;
        }
        mermaidSeq += 1;
        const id = `doc-mermaid-${reactId}-${mermaidSeq}`;
        const trimmed = code.trim();
        await mermaid.parse(trimmed);
        let rendered;
        try {
          rendered = await mermaid.render(id, trimmed);
        } finally {
          if (typeof document !== 'undefined') {
            document.getElementById(id)?.remove();
            document.getElementById(`d${id}`)?.remove();
          }
        }
        if (!cancelled) setSvg(rendered.svg);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  const dims = useMemo(() => parseSvgDimensions(svg), [svg]);
  const layout = useMemo(() => computeInlineMermaidLayout(dims, inlineMode), [dims, inlineMode]);
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  /** @param {import('react').MouseEvent<HTMLDivElement>} event */
  const startDrag = useCallback(event => {
    const container = inlineViewportRef.current;
    if (event.button !== 0 || !container) return;
    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    setIsDraggingInline(true);
  }, []);

  /** @param {import('react').MouseEvent<HTMLDivElement>} event */
  const moveDrag = useCallback(event => {
    const state = dragStateRef.current;
    const container = inlineViewportRef.current;
    if (!state.active || !container) return;
    event.preventDefault();
    container.scrollLeft = state.scrollLeft - (event.clientX - state.startX);
    container.scrollTop = state.scrollTop - (event.clientY - state.startY);
  }, []);

  const endDrag = useCallback(() => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setIsDraggingInline(false);
  }, []);

  if (failed || !svg) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }

  const inlineStageStyle = layout.fitContainer
    ? { width: '100%', maxWidth: dims ? `${Math.round(dims.width)}px` : '100%' }
    : { width: `${layout.displayWidthPx}px`, minWidth: `${layout.displayWidthPx}px` };

  return (
    <div className="doc-mermaid-card">
      <div className="doc-mermaid-toolbar">
        <span className="doc-mermaid-hint">
          {layout.isWide
            ? (layout.fitContainer
              ? 'Sơ đồ rộng · bấm Phóng to hoặc chọn 80%/100% để xem rõ'
              : 'Sơ đồ rộng · kéo ngang hoặc bấm Phóng to')
            : 'Sơ đồ minh họa'}
        </span>
        <div className="doc-mermaid-actions">
          {layout.isWide && (
            <>
              <button
                type="button"
                className={`doc-mermaid-btn ${inlineMode === 'fit' ? 'is-active' : ''}`}
                aria-pressed={inlineMode === 'fit'}
                onClick={() => setInlineMode('fit')}
              >
                Vừa khung
              </button>
              <button
                type="button"
                className={`doc-mermaid-btn ${inlineMode === 'readable' ? 'is-active' : ''}`}
                aria-pressed={inlineMode === 'readable'}
                onClick={() => setInlineMode('readable')}
              >
                80%
              </button>
              <button
                type="button"
                className={`doc-mermaid-btn ${inlineMode === 'actual' ? 'is-active' : ''}`}
                aria-pressed={inlineMode === 'actual'}
                onClick={() => setInlineMode('actual')}
              >
                100%
              </button>
            </>
          )}
          <button type="button" className="doc-mermaid-btn doc-mermaid-btn--primary" onClick={openModal}>
            <ExpandIcon />
            <span>Phóng to</span>
          </button>
        </div>
      </div>

      <div
        ref={inlineViewportRef}
        className={`doc-mermaid-viewport ${!layout.fitContainer ? 'is-scrollable' : ''} ${isDraggingInline ? 'is-dragging' : ''}`}
        onMouseDown={layout.fitContainer ? undefined : startDrag}
        onMouseMove={layout.fitContainer ? undefined : moveDrag}
        onMouseUp={layout.fitContainer ? undefined : endDrag}
        onMouseLeave={layout.fitContainer ? undefined : endDrag}
      >
        {isModalOpen ? (
          <div className="doc-mermaid-placeholder">Đang xem sơ đồ ở chế độ toàn màn hình…</div>
        ) : (
          <div
            className="doc-mermaid-stage"
            style={inlineStageStyle}
            title="Nhấp đúp để phóng to sơ đồ"
            onDoubleClick={openModal}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>

      {isModalOpen && (
        <ZoomModal title="Xem sơ đồ toàn màn hình" dims={dims} onClose={closeModal}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </ZoomModal>
      )}
    </div>
  );
}

/**
 * Markdown image rendered as a framed figure that always fits the column;
 * clicking it opens the shared zoom viewer.
 *
 * @param {{ src?: string, alt?: string, title?: string }} props
 */
function DocImage({ src, alt = '', title }) {
  const [isOpen, setIsOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dims, setDims] = useState(/** @type {{ width: number, height: number } | null} */ (null));
  const closeModal = useCallback(() => setIsOpen(false), []);

  if (!src || failed) {
    return (
      <figure className="doc-figure">
        <div className="doc-figure-missing">Không tải được hình{alt ? `: ${alt}` : ''}</div>
      </figure>
    );
  }

  return (
    <figure className="doc-figure">
      <button
        type="button"
        className="doc-figure-frame"
        onClick={() => setIsOpen(true)}
        title={title || 'Bấm để phóng to hình'}
        aria-label={`Phóng to hình${alt ? `: ${alt}` : ''}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={event => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0) setDims({ width: img.naturalWidth, height: img.naturalHeight });
          }}
          onError={() => setFailed(true)}
        />
        <span className="doc-figure-zoom" aria-hidden="true">
          <ExpandIcon />
          <span>Phóng to</span>
        </span>
      </button>
      {alt && <figcaption>{alt}</figcaption>}
      {isOpen && (
        <ZoomModal title={alt || 'Xem hình toàn màn hình'} dims={dims} initialFit onClose={closeModal}>
          <img className="doc-figure-modal-img" src={src} alt={alt} draggable={false} />
        </ZoomModal>
      )}
    </figure>
  );
}

function CopySquaresIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="4" width="11" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6 8v10a2.5 2.5 0 0 0 2.5 2.5H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeBlock({ code, language = '' }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const normalizedLang = useMemo(() => normalizeCodeLanguage(language), [language]);
  const label = useMemo(() => formatCodeLanguageLabel(normalizedLang), [normalizedLang]);
  const lines = useMemo(() => tokenizeCodeLines(code, normalizedLang), [code, normalizedLang]);
  const rawCode = useMemo(() => String(code || '').replace(/\r\n?/g, '\n').replace(/\n$/, ''), [code]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopy = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(rawCode)
      .then(() => {
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }, [rawCode]);

  return (
    <div className="doc-code-block">
      <div className="doc-code-header">
        <span className="doc-code-lang">{label}</span>
        <div className="doc-code-actions">
          <button
            type="button"
            className={`doc-code-icon-btn ${copied ? 'is-copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Đã sao chép' : 'Sao chép mã'}
            aria-label={copied ? 'Đã sao chép' : 'Sao chép mã'}
          >
            {copied ? <CheckIcon /> : <CopySquaresIcon />}
          </button>
        </div>
      </div>
      <pre className="doc-code-pre">
        <code className="doc-code-code">
          {lines.map((lineTokens, lineIdx) => (
            <span key={lineIdx} className="doc-code-line">
              <span className="doc-code-ln" aria-hidden="true">
                {lineIdx + 1}
              </span>
              <span className="doc-code-text">
                {lineTokens.length > 0
                  ? lineTokens.map((tok, tokIdx) => (
                      <span key={tokIdx} className={`doc-tok doc-tok--${tok.type}`}>
                        {tok.value}
                      </span>
                    ))
                  : '\u200B'}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

const markdownComponents = {
  // A <figure> may not live inside <p>; standalone images render as block figures.
  p({ node, children, ...props }) {
    if (isImageOnlyParagraph(node)) return <>{children}</>;
    return <p {...props}>{children}</p>;
  },
  img({ node: _node, src, alt, title }) {
    return <DocImage src={typeof src === 'string' ? src : undefined} alt={alt || ''} title={title || undefined} />;
  },
  pre({ children, ...props }) {
    const first = Children.toArray(children).find(child => isValidElement(child));
    if (isValidElement(first)) {
      const codeProps = /** @type {{ className?: string, children?: import('react').ReactNode }} */ (first.props);
      const className = typeof codeProps.className === 'string' ? codeProps.className : '';
      if (/\blanguage-mermaid\b/.test(className)) {
        return <MermaidDiagram code={extractText(codeProps.children)} />;
      }
      if (first.type === 'code') {
        const langMatch = className.match(/\blanguage-([^\s]+)/);
        const lang = langMatch ? langMatch[1] : '';
        return <CodeBlock code={extractText(codeProps.children)} language={lang} />;
      }
    }
    return <pre {...props}>{children}</pre>;
  },
  blockquote({ children, ...props }) {
    const callout = parseCallout(children);
    if (!callout) return <blockquote {...props}>{children}</blockquote>;
    return (
      <aside className={`doc-callout doc-callout--${callout.kind}`} role="note">
        <div className="doc-callout-title">{CALLOUT_TITLES[callout.kind] || 'Lưu ý'}</div>
        {callout.body}
      </aside>
    );
  },
};

export default function DocViewer({ docPath, content: directContent = '' }) {
  const [content, setContent] = useState(directContent || '');
  const [loading, setLoading] = useState(!directContent);

  useEffect(() => {
    if (directContent) {
      setContent(directContent);
      setLoading(false);
      return;
    }
    if (!docPath) {
      setLoading(false);
      return;
    }

    setLoading(true);
    authorizedFetch(`/api/docs/${docPath}`)
      .then(r => (r.ok ? r.text() : Promise.reject()))
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent(`# ${docPath}\n\nTài liệu đang được cập nhật...`);
        setLoading(false);
      });
  }, [docPath, directContent]);

  const normalizedContent = useMemo(() => normalizeDisplayMath(content), [content]);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Đang tải tài liệu...</div>;
  }

  return (
    <div className="doc-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false }]]}
        components={markdownComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
