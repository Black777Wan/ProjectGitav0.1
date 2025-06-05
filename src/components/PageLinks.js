import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const PAGE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export const PageLinks = Extension.create({
  name: 'pageLinks',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pageLinks'),
        props: {
          decorations: (state) => {
            const decorations = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                let match;
                const text = node.text;
                PAGE_LINK_REGEX.lastIndex = 0; // Reset regex state

                while ((match = PAGE_LINK_REGEX.exec(text)) !== null) {
                  const start = pos + match.index;
                  const end = start + match[0].length;
                  const pageName = match[1];

                  decorations.push(
                    Decoration.inline(start, end, {
                      class: 'page-link',
                      'data-page-name': pageName,
                    })
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick: (view, pos, event) => {
            const { target } = event;
            if (target.classList.contains('page-link')) {
              const pageName = target.getAttribute('data-page-name');
              if (pageName) {
                // Emit a custom event that the parent component can listen to
                const customEvent = new CustomEvent('pageLink', {
                  detail: { pageName },
                });
                view.dom.dispatchEvent(customEvent);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
