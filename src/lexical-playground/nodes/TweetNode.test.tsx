import type {ReactNode} from 'react';

import {render} from '@testing-library/react';
import {createEditor} from 'lexical';
import {describe, expect, it, vi} from 'vitest';

vi.mock('@lexical/react/LexicalBlockWithAlignableContents', () => ({
  BlockWithAlignableContents: ({
    children,
  }: {
    children: ReactNode;
  }) => <div data-testid="tweet-block">{children}</div>,
}));

import {TweetNode} from '@/lexical-playground/nodes/TweetNode';

describe('TweetNode', () => {
  it('renderiza o wrapper dedicado do tweet para clipping do embed', () => {
    const editor = createEditor({
      namespace: 'TweetNodeTest',
      nodes: [TweetNode],
      onError: (error) => {
        throw error;
      },
    });

    let decoratedElement: ReturnType<TweetNode['decorate']> | null = null;

    editor.update(() => {
      const node = new TweetNode('1234567890');
      decoratedElement = node.decorate({} as never, {
        theme: {
          embedBlock: {
            base: 'embed-base',
            focus: 'embed-focus',
          },
        },
      } as never);
    });

    const {container} = render(decoratedElement);

    expect(container.querySelector('.lexical-tweet')).toBeTruthy();
  });
});
