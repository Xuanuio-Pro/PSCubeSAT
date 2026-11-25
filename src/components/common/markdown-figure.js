/**
 * True when a hast paragraph holds only images (and whitespace), e.g. `![..](..)` on its own
 * line. Such paragraphs are unwrapped so the image can render as a block `<figure>`.
 *
 * @param {any} node
 * @returns {boolean}
 */
export function isImageOnlyParagraph(node) {
  const kids = Array.isArray(node?.children) ? node.children : [];
  const isImg = kid => kid?.type === 'element' && kid.tagName === 'img';
  return kids.some(isImg) && kids.every(kid => isImg(kid) || (kid?.type === 'text' && !String(kid.value).trim()));
}
