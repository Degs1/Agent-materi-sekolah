'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Preprocess LLM text before rendering.
 * Sometimes LLMs output `\[ ... \]` or `\( ... \)` instead of `$$` and `$`.
 * We replace them so remark-math can parse them correctly.
 */
function preprocessLaTeX(text: string) {
  return text
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

/** Render markdown + LaTeX ($$..$$ / $..$) via KaTeX. */
export default function Md({ text }: { text: string }) {
  const processedText = preprocessLaTeX(text);

  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1 prose-pre:bg-raised prose-pre:rounded-lg prose-code:text-accent prose-table:border-collapse prose-th:border prose-th:border-line prose-th:p-2 prose-td:border prose-td:border-line prose-td:p-2">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, ...props }) => {
            const href = props.href || '';
            const ytMatch = href.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            if (ytMatch) {
              return (
                <div className="my-4 aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full rounded-lg"
                  ></iframe>
                </div>
              );
            }
            return <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent underline" />;
          }
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
