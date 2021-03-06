import fs from 'fs'
import path from 'path'
import test from 'tape'
import {micromark} from 'micromark'
import {footnote as syntax, footnoteHtml as html} from '../dev/index.js'

test('markdown -> html (micromark)', (t) => {
  t.deepEqual(
    micromark('^[inline]', {
      extensions: [syntax()],
      htmlExtensions: [html]
    }),
    '<p>^[inline]</p>',
    'should not support inline footnotes by default'
  )

  t.deepEqual(
    micromark('^[inline]', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a></p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>inline<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support inline footnotes w/ `inlineNotes: true`'
  )

  t.deepEqual(
    micromark('A paragraph.\n\n[^1]: whatevs', {
      extensions: [syntax()],
      htmlExtensions: [html]
    }),
    '<p>A paragraph.</p>\n',
    'should ignore definitions w/o calls'
  )

  t.deepEqual(
    micromark('A call.[^1]\n\n[^1]: whatevs', {
      extensions: [syntax()],
      htmlExtensions: [html]
    }),
    '<p>A call.<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a></p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>whatevs<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support calls and definitions'
  )

  // 999 `x` characters.
  const max = Array.from({length: 1000}).join('x')

  t.deepEqual(
    micromark('Call.[^' + max + '].\n\n[^' + max + ']: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>y<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support 999 characters in a call / definition'
  )

  t.deepEqual(
    micromark('Call.[^a' + max + '].\n\n[^a' + max + ']: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.[^a' + max + '].</p>\n<p>[^a' + max + ']: y</p>',
    'should not support 1000 characters in a call / definition'
  )

  t.deepEqual(
    micromark('Call.[^a\\+b].\n\n[^a\\+b]: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>y<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support a character escape in a call / definition'
  )

  t.deepEqual(
    micromark('Call.[^a&copy;b].\n\n[^a&copy;b]: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>y<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support a character reference in a call / definition'
  )

  t.deepEqual(
    micromark('Call.[^a\\]b].\n\n[^a\\]b]: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>y<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support a useful character escape in a call / definition'
  )

  t.deepEqual(
    micromark('Call.[^a&#91;b].\n\n[^a&#91;b]: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>y<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support a useful character reference in a call / definition'
  )

  t.deepEqual(
    micromark('Call.[^a\\+b].\n\n[^a+b]: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.[^a+b].</p>\n',
    'should match calls to definitions on the source of the label, not on resolved escapes'
  )

  t.deepEqual(
    micromark('Call.[^a&#91;b].\n\n[^a\\[b]: y', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p>Call.[^a[b].</p>\n',
    'should match calls to definitions on the source of the label, not on resolved references'
  )

  t.deepEqual(
    micromark('[^1] and ^[b]\n\n[^1]: a', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a> and <a href="#fn2" class="footnote-ref" id="fnref2" role="doc-noteref"><sup>2</sup></a></p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>a<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n<li id="fn2" role="doc-endnote">\n<p>b<a href="#fnref2" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support correctly number inline footnotes after calls'
  )

  t.deepEqual(
    micromark('[^1].\n\n[^1]: a\nb', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>a\nb<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support lazyness (1)'
  )

  t.deepEqual(
    micromark('[^1].\n\n> [^1]: a\nb', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<blockquote>\n</blockquote>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>a\nb<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support lazyness (2)'
  )

  t.deepEqual(
    micromark('[^1].\n\n> [^1]: a\n> b', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<blockquote>\n</blockquote>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>a\nb<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p>\n</li>\n</ol>\n</section>',
    'should support lazyness (3)'
  )

  t.deepEqual(
    micromark('[^1].\n\n[^1]: a\n\n    > b', {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    }),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a>.</p>\n<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n<li id="fn1" role="doc-endnote">\n<p>a</p>\n<blockquote>\n<p>b</p>\n</blockquote>\n<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a>\n</li>\n</ol>\n</section>',
    'should support lazyness (4)'
  )

  t.end()
})

test('fixtures', (t) => {
  const base = path.join('test', 'fixtures')
  const files = fs.readdirSync(base).filter((d) => /\.md$/.test(d))
  let index = -1

  while (++index < files.length) {
    const name = path.basename(files[index], '.md')
    const input = fs.readFileSync(path.join(base, name + '.md'))
    const actual = micromark(input, {
      extensions: [syntax({inlineNotes: true})],
      htmlExtensions: [html]
    })
    /** @type {string|undefined} */
    let expected

    try {
      expected = String(fs.readFileSync(path.join(base, name + '.html')))
    } catch {}

    if (expected) {
      t.deepEqual(actual, expected, name)
    } else {
      fs.writeFileSync(path.join(base, name + '.html'), actual)
    }
  }

  t.end()
})
