import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DOCS = import.meta.glob('/src/data/docs/*.md', { query: '?raw', import: 'default' });

export default function DocViewer({ docPath, content: directContent }) {
  const [content, setContent] = useState(directContent || '');
  const [loading, setLoading] = useState(!directContent);

  useEffect(() => {
    if (directContent) {
      setContent(directContent);
      return;
    }
    if (!docPath) return;

    const key = `/src/data/docs/${docPath}.md`;
    if (DOCS[key]) {
      DOCS[key]().then(text => {
        setContent(text);
        setLoading(false);
      });
    } else {
      // Try fetching from server API
      fetch(`/api/docs/${docPath}`)
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(text => { setContent(text); setLoading(false); })
        .catch(() => {
          setContent(`# ${docPath}\n\nTài liệu đang được cập nhật...`);
          setLoading(false);
        });
    }
  }, [docPath, directContent]);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Đang tải tài liệu...</div>;
  }

  return (
    <div className="doc-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
