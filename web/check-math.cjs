// Self-check: remark-math parses $$..$$ and rehype-katex renders to HTML
const { unified } = require('unified');
const remarkParse = require('remark-parse');
const remarkMath = require('remark-math');
const remarkRehype = require('remark-rehype');
const rehypeKatex = require('rehype-katex');
const rehypeStringify = require('rehype-stringify') || require('unified').rehypeStringify || null;

const text = `$$F = G \\frac{m_1 \\cdot m_2}{r^2}$$

Keterangan: $F$ = Gaya gravitasi`;

unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeStringify)
  .process(text)
  .then((file) => {
    const html = String(file);
    console.log(html.slice(0, 400));
    if (!html.includes('katex')) throw new Error('FAIL: no KaTeX output');
    console.log('PASS');
  })
  .catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
