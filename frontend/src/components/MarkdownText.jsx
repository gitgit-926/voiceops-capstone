import React from 'react';

// Safe, lightweight Markdown renderer for AI customer responses (bold, lists, paragraphs, code)
export default function MarkdownText({ text }) {
  if (!text) return null;

  // Split into block elements by double newline (or multiple newlines)
  const blocks = text.trim().split(/\n\s*\n/);

  return (
    <div className="markdown-body">
      {blocks.map((block, bIdx) => {
        const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (rawLines.length === 0) return null;

        // Check if block is a bulleted list (* item, - item, • item)
        const isBulletList = rawLines.every((l) => /^[-*•]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={bIdx} className="md-unordered-list">
              {rawLines.map((line, lIdx) => (
                <li key={lIdx}>
                  {renderInlineFormatting(line.replace(/^[-*•]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        // Check if block is a numbered list (1. item, 2. item)
        const isNumberedList = rawLines.every((l) => /^\d+\.\s+/.test(l));
        if (isNumberedList) {
          return (
            <ol key={bIdx} className="md-ordered-list">
              {rawLines.map((line, lIdx) => (
                <li key={lIdx}>
                  {renderInlineFormatting(line.replace(/^\d+\.\s+/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        // Default: paragraph with possible single line breaks
        return (
          <p key={bIdx} className="md-paragraph">
            {rawLines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInlineFormatting(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// Helper to safely render inline bold (**text**), italics (*text*), and code (`code`)
function renderInlineFormatting(text) {
  if (!text) return '';
  const parts = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={key++} className="inline-code">{token.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
