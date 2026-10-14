import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface FormattedMessageProps {
  content: string;
  isAI?: boolean;
}

export function FormattedMessage({ content, isAI = false }: FormattedMessageProps) {
  if (!isAI) {
    // User messages render as plain text
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="formatted-message prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Headings
          h1: ({ node, ...props }) => (
            <h1 className="text-lg font-semibold mb-2 mt-4" style={{ color: '#0A0A0A' }} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-base font-semibold mb-2 mt-3" style={{ color: '#0A0A0A' }} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-sm font-semibold mb-1.5 mt-2" style={{ color: '#0A0A0A' }} {...props} />
          ),
          
          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="mb-3 last:mb-0 leading-relaxed text-[13px]" style={{ color: '#0A0A0A' }} {...props} />
          ),
          
          // Lists
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1.5" style={{ color: '#0A0A0A' }} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1.5" style={{ color: '#0A0A0A' }} {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-[13px] leading-relaxed" {...props} />
          ),
          
          // Code blocks
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded text-[12px] font-mono"
                  style={{ 
                    background: '#F4F7F4', 
                    color: '#1B5E20',
                    border: '1px solid #E2E8E2'
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block p-3 rounded-lg text-[12px] font-mono overflow-x-auto ${className || ''}`}
                style={{ 
                  background: '#F4F7F4',
                  border: '1px solid #E2E8E2'
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          
          pre: ({ node, ...props }) => (
            <pre className="mb-3 overflow-x-auto" {...props} />
          ),
          
          // Blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 pl-4 py-2 mb-3 italic"
              style={{ 
                borderColor: '#2E7D32',
                background: '#F4F7F4',
                color: '#4A5568'
              }}
              {...props}
            />
          ),
          
          // Tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-3 rounded-lg border" style={{ borderColor: '#E2E8E2' }}>
              <table className="w-full text-[12px]" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead style={{ background: '#F4F7F4' }} {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left font-semibold" style={{ color: '#4A5568' }} {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-t" style={{ borderColor: '#EEF2EE', color: '#0A0A0A' }} {...props} />
          ),
          
          // Links
          a: ({ node, ...props }) => (
            <a
              className="font-medium hover:underline"
              style={{ color: '#2E7D32' }}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          
          // Strong/Bold
          strong: ({ node, ...props }) => (
            <strong className="font-semibold" style={{ color: '#1B5E20' }} {...props} />
          ),
          
          // Emphasis/Italic
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          
          // Horizontal Rule
          hr: ({ node, ...props }) => (
            <hr className="my-4" style={{ borderColor: '#E2E8E2' }} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
