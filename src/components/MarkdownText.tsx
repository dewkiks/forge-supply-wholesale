/**
 * MarkdownText — dependency-free markdown renderer for workflow responses.
 *
 * Workflow runs return their final output as markdown text (see
 * `extractWorkflowResponse` / the hook's `responseText`). Render it with this
 * component instead of dumping raw strings or JSON. Zero dependencies on
 * purpose: generated projects must not require an npm install to display a
 * run result.
 *
 * Supports: headings, paragraphs, bold/italic/strikethrough, inline code,
 * fenced code blocks, links, ordered/unordered lists, blockquotes, tables,
 * horizontal rules. Builds React elements (no dangerouslySetInnerHTML), so
 * model/user-provided text cannot inject HTML.
 *
 * Styling uses the design-system tokens (muted/border/foreground) so it
 * inherits each app's look — restyle via the `className` prop, not by
 * editing tag classes ad hoc.
 */
import React from 'react';

function renderInline(text: string, keyPrefix = ''): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(~~[^~]+~~)|(\[([^\]]+)\]\(([^)\s]+)\))/;
  while (remaining) {
    const m = remaining.match(pattern);
    if (!m || m.index === undefined) {
      nodes.push(remaining);
      break;
    }
    if (m.index > 0) nodes.push(remaining.slice(0, m.index));
    const tok = m[0];
    const key = `${keyPrefix}i${i++}`;
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      nodes.push(<strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>);
    } else if (tok.startsWith('~~')) {
      nodes.push(<del key={key}>{tok.slice(2, -2)}</del>);
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      nodes.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>);
    } else {
      // [text](url) — only allow http(s)/mailto/relative targets.
      const href = m[9] || '';
      const safe = /^(https?:|mailto:|\/|#)/i.test(href);
      nodes.push(
        safe ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {renderInline(m[8] || href, key)}
          </a>
        ) : (
          <span key={key}>{m[8] || href}</span>
        ),
      );
    }
    remaining = remaining.slice(m.index + tok.length);
  }
  return nodes;
}

interface MarkdownTextProps {
  children: string | null | undefined;
  className?: string;
}

export function MarkdownText({ children, className = '' }: MarkdownTextProps) {
  if (!children || !children.trim()) return null;

  const lines = children.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let k = 0;
  let idx = 0;

  const flushParagraph = (buf: string[]) => {
    if (!buf.length) return;
    blocks.push(
      <p key={`p${k++}`} className="leading-relaxed">
        {buf.map((l, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(l, `p${k}l${j}`)}
          </React.Fragment>
        ))}
      </p>,
    );
    buf.length = 0;
  };

  const para: string[] = [];
  while (idx < lines.length) {
    const line = lines[idx];

    // Fenced code block
    if (/^```/.test(line)) {
      flushParagraph(para);
      const code: string[] = [];
      idx++;
      while (idx < lines.length && !/^```/.test(lines[idx])) code.push(lines[idx++]);
      idx++; // closing fence
      blocks.push(
        <pre key={`c${k++}`} className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-sm">
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushParagraph(para);
      const level = h[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'];
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      blocks.push(
        <Tag key={`h${k++}`} className={`font-semibold ${sizes[level - 1]} mt-2`}>
          {renderInline(h[2], `h${k}`)}
        </Tag>,
      );
      idx++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushParagraph(para);
      blocks.push(<hr key={`r${k++}`} className="border-border" />);
      idx++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushParagraph(para);
      const quote: string[] = [];
      while (idx < lines.length && /^>\s?/.test(lines[idx])) quote.push(lines[idx++].replace(/^>\s?/, ''));
      blocks.push(
        <blockquote key={`q${k++}`} className="border-l-2 border-border pl-3 text-muted-foreground">
          <MarkdownText>{quote.join('\n')}</MarkdownText>
        </blockquote>,
      );
      continue;
    }

    // List (unordered or ordered, flat)
    const isUl = (l: string) => /^\s*[-*+]\s+/.test(l);
    const isOl = (l: string) => /^\s*\d+[.)]\s+/.test(l);
    if (isUl(line) || isOl(line)) {
      flushParagraph(para);
      const ordered = isOl(line);
      const items: string[] = [];
      while (idx < lines.length && (ordered ? isOl(lines[idx]) : isUl(lines[idx]))) {
        items.push(lines[idx++].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, ''));
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`l${k++}`}
          className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}
        >
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, `l${k}i${j}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Table (| a | b | rows with a |---| separator)
    if (/^\s*\|.*\|\s*$/.test(line) && idx + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[idx + 1])) {
      flushParagraph(para);
      const parseRow = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = parseRow(line);
      idx += 2; // skip separator
      const rows: string[][] = [];
      while (idx < lines.length && /^\s*\|.*\|\s*$/.test(lines[idx])) rows.push(parseRow(lines[idx++]));
      blocks.push(
        <div key={`t${k++}`} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {header.map((cell, j) => (
                  <th key={j} className="px-3 py-2 text-left font-semibold">
                    {renderInline(cell, `th${k}${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-b border-border/50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top">
                      {renderInline(cell, `td${k}${r}${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blank line ends the current paragraph
    if (!line.trim()) {
      flushParagraph(para);
      idx++;
      continue;
    }

    para.push(line);
    idx++;
  }
  flushParagraph(para);

  return <div className={`space-y-3 ${className}`}>{blocks}</div>;
}

export default MarkdownText;
