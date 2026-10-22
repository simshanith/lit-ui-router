import type { MarkdownRenderer } from 'vitepress';

const STYLE_ELEMENT = /^[ \t]*<style\b[^>]*>[\s\S]*?<\/style>[ \t]*\n?/gm;

// Vue keeps <style> in the server render but strips it from client templates; a diagram's svg:root palette is inert inline anyway.
export function stripInlineSvgStyles(md: MarkdownRenderer): void {
  md.core.ruler.after('block', 'strip_inline_svg_styles', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'html_block' && token.content.startsWith('<svg'))
        token.content = token.content.replace(STYLE_ELEMENT, '');
    }
  });
}
