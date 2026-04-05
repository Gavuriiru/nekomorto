/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {ElementFormatType, NodeKey} from 'lexical';

import {BlockWithAlignableContents} from '@lexical/react/LexicalBlockWithAlignableContents';
import {useThemeMode} from '@/hooks/use-theme-mode';
import {useEffect, useRef, useState} from 'react';

const WIDGET_SCRIPT_URL = 'https://platform.twitter.com/widgets.js';
const TWEET_CROSSFADE_DURATION_MS = 220;
const TWITTER_SCRIPT_LOADED_ATTRIBUTE = 'data-lexical-twitter-widgets-loaded';

type TwitterWidgetTheme = 'light' | 'dark';
type TwitterWidgets = Readonly<{
  createTweet: (
    tweetID: string,
    target: HTMLElement,
    options: Readonly<{
      theme: TwitterWidgetTheme;
    }>,
  ) => Promise<unknown>;
}>;
type TwitterWindow = Window &
  typeof globalThis & {
    twttr?: {
      widgets?: TwitterWidgets;
    };
  };

export type TweetComponentProps = Readonly<{
  className: Readonly<{
    base: string;
    focus: string;
  }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  tweetID: string;
}>;

const getTwitterWidgets = (): TwitterWidgets | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const twitterWindow = window as TwitterWindow;
  return twitterWindow.twttr?.widgets ?? null;
};

let twitterScriptLoadPromise: Promise<void> | null = null;

const loadTwitterScript = (): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('twitter_widgets_requires_browser'));
  }
  if (typeof getTwitterWidgets()?.createTweet === 'function') {
    return Promise.resolve();
  }
  if (twitterScriptLoadPromise) {
    return twitterScriptLoadPromise;
  }

  twitterScriptLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${WIDGET_SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
    const finish = (callback: () => void) => {
      cleanup();
      twitterScriptLoadPromise = null;
      callback();
    };
    const handleLoad = () => {
      script.setAttribute(TWITTER_SCRIPT_LOADED_ATTRIBUTE, 'true');
      const resolveOnNextTick =
        typeof queueMicrotask === 'function'
          ? queueMicrotask
          : (callback: () => void) => {
              void Promise.resolve().then(callback);
            };
      resolveOnNextTick(() => {
        finish(() => {
          if (typeof getTwitterWidgets()?.createTweet === 'function') {
            resolve();
            return;
          }
          reject(new Error('twitter_widgets_unavailable'));
        });
      });
    };
    const handleError = () => {
      finish(() => {
        reject(new Error('twitter_widgets_script_failed'));
      });
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existingScript) {
      script.src = WIDGET_SCRIPT_URL;
      script.async = true;
      (
        document.body ||
        document.head ||
        document.documentElement
      ).appendChild(script);
      return;
    }

    if (script.getAttribute(TWITTER_SCRIPT_LOADED_ATTRIBUTE) === 'true') {
      handleLoad();
    }
  });

  return twitterScriptLoadPromise;
};

function TweetLoadingSkeleton() {
  return (
    <div className="tweet-skeleton" aria-label="Carregando tweet">
      <div className="tweet-skeleton__header">
        <div className="tweet-skeleton__avatar" />
        <div className="tweet-skeleton__meta">
          <div className="tweet-skeleton__line tweet-skeleton__line--short" />
          <div className="tweet-skeleton__line tweet-skeleton__line--mid" />
        </div>
      </div>
      <div className="tweet-skeleton__body">
        <div className="tweet-skeleton__line" />
        <div className="tweet-skeleton__line" />
        <div className="tweet-skeleton__line tweet-skeleton__line--mid" />
      </div>
      <div className="tweet-skeleton__media" />
    </div>
  );
}

export default function TweetComponent({
  className,
  format,
  nodeKey,
  tweetID,
}: TweetComponentProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const renderTokenRef = useRef(0);
  const activeStageRef = useRef<HTMLDivElement | null>(null);
  const [isTweetLoading, setIsTweetLoading] = useState(false);
  const {effectiveMode} = useThemeMode();
  const tweetTheme: TwitterWidgetTheme =
    effectiveMode === 'light' ? 'light' : 'dark';

  useEffect(() => {
    const targetHost = targetRef.current;
    if (!targetHost) {
      return;
    }
    if (activeStageRef.current && !activeStageRef.current.isConnected) {
      activeStageRef.current = null;
    }

    const renderToken = renderTokenRef.current + 1;
    renderTokenRef.current = renderToken;

    const currentStage = activeStageRef.current;
    Array.from(targetHost.children).forEach((child) => {
      if (child !== currentStage) {
        child.remove();
      }
    });

    setIsTweetLoading(!currentStage);

    const requestTarget = document.createElement('div');
    requestTarget.className = 'lexical-tweet__stage lexical-tweet__stage--entering';
    requestTarget.setAttribute('aria-hidden', 'true');
    requestTarget.setAttribute('data-lexical-tweet-request', String(renderToken));
    targetHost.appendChild(requestTarget);

    const renderTweet = async () => {
      try {
        await loadTwitterScript();
        if (
          renderTokenRef.current !== renderToken ||
          !requestTarget.isConnected
        ) {
          return;
        }

        const widgets = getTwitterWidgets();
        if (!widgets || typeof widgets.createTweet !== 'function') {
          throw new Error('twitter_widgets_unavailable');
        }

        await widgets.createTweet(tweetID, requestTarget, {
          theme: tweetTheme,
        });

        const previousStage = activeStageRef.current;
        if (
          renderTokenRef.current !== renderToken ||
          !requestTarget.isConnected
        ) {
          requestTarget.remove();
          return;
        }

        if (previousStage && previousStage !== requestTarget) {
          previousStage.classList.remove('lexical-tweet__stage--active');
          previousStage.classList.remove('lexical-tweet__stage--entering');
          previousStage.classList.add('lexical-tweet__stage--fading-out');
          previousStage.setAttribute('aria-hidden', 'true');
          window.setTimeout(() => {
            if (activeStageRef.current !== previousStage) {
              previousStage.remove();
            }
          }, TWEET_CROSSFADE_DURATION_MS);
        }

        requestTarget.classList.remove('lexical-tweet__stage--entering');
        requestTarget.classList.remove('lexical-tweet__stage--fading-out');
        requestTarget.classList.add('lexical-tweet__stage--active');
        requestTarget.removeAttribute('aria-hidden');
        activeStageRef.current = requestTarget;
        setIsTweetLoading(false);
      } catch (_error) {
        if (
          renderTokenRef.current !== renderToken ||
          !requestTarget.isConnected
        ) {
          return;
        }
        requestTarget.remove();
        setIsTweetLoading(false);
      }
    };

    void renderTweet();
  }, [tweetID, tweetTheme]);

  useEffect(() => {
    return () => {
      renderTokenRef.current += 1;
      activeStageRef.current = null;
      if (targetRef.current) {
        targetRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <BlockWithAlignableContents
      className={className}
      format={format}
      nodeKey={nodeKey}>
      <div className="lexical-tweet">
        {isTweetLoading ? <TweetLoadingSkeleton /> : null}
        <div className="lexical-tweet__target" ref={targetRef} />
      </div>
    </BlockWithAlignableContents>
  );
}
