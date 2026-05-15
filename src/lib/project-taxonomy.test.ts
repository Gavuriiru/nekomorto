import { describe, expect, it } from 'vitest';
import { sortByTranslatedLabel, translateTag, buildTranslationMap } from './project-taxonomy';

describe('sortByTranslatedLabel', () => {
    it('sorts properly with translator', () => {
        const items = ['z', 'a', 'x', 'b'];
        const map = buildTranslationMap({});
        const res = sortByTranslatedLabel(items, (t) => translateTag(t, map));
        expect(res).toEqual(['a', 'b', 'x', 'z']);
    });
});
