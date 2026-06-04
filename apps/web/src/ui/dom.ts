/**
 * Tiny hyperscript helper so views create DOM consistently. No framework.
 */

type Child = Node | string | number | null | undefined | false;

export interface ElProps {
  class?: string;
  text?: string;
  html?: string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  on?: Partial<{
    [K in keyof HTMLElementEventMap]: (ev: HTMLElementEventMap[K]) => void;
  }>;
  title?: string;
  tabIndex?: number;
  type?: string;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text != null) node.textContent = props.text;
  if (props.html != null) node.innerHTML = props.html;
  if (props.title != null) node.title = props.title;
  if (props.tabIndex != null) node.tabIndex = props.tabIndex;
  if (props.type != null) node.setAttribute("type", props.type);
  if (props.dataset) {
    for (const [k, v] of Object.entries(props.dataset)) node.dataset[k] = v;
  }
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  }
  if (props.style) Object.assign(node.style, props.style);
  if (props.on) {
    for (const [k, fn] of Object.entries(props.on)) {
      node.addEventListener(k, fn as EventListener);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

/** Remove all children of a node. */
export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
