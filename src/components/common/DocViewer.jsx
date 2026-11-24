import { Children, cloneElement, isValidElement, useEffect, useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { authorizedFetch } from '../../contexts/auth-api';
import './doc-viewer.css';

const CALLOUT_TITLES = {
  note: 'Ghi chú',
  tip: 'Mẹo kỹ thuật',
  important: 'Lưu ý quan trọng',
  warning: 'Cảnh báo',
  caution: 'Thận trọng',
};

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

function MermaidDiagram({ code }) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSvg('');
    import('mermaid')
      .then(async mod => {
        const mermaid = mod.default;
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
          mermaidInitialized = true;
        }
        mermaidSeq += 1;
        const id = `doc-mermaid-${reactId}-${mermaidSeq}`;
        const rendered = await mermaid.render(id, code.trim());
        if (!cancelled) setSvg(rendered.svg);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (failed || !svg) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }
  return <div className="doc-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const markdownComponents = {
  pre({ children, ...props }) {
    const first = Children.toArray(children).find(child => isValidElement(child));
    if (isValidElement(first)) {
      const codeProps = /** @type {{ className?: string, children?: import('react').ReactNode }} */ (first.props);
      if (typeof codeProps.className === 'string' && /\blanguage-mermaid\b/.test(codeProps.className)) {
        return <MermaidDiagram code={extractText(codeProps.children)} />;
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

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Đang tải tài liệu...</div>;
  }

  return (
    <div className="doc-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
