// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {attrs, h, text} from '../../../src/js/render/html.js';

describe('html builder', () => {
    it('attrs: escapes values, true is bare, false/null/undefined are left out, order kept', () => {
        expect(attrs({class: 'a"b', hidden: true, x: false, y: null, z: undefined, n: 0})).toBe(' class="a&quot;b" hidden n="0"');
    });
    it('h: children are HTML; falsy ones and nested arrays flatten away', () => {
        expect(h('p', {}, 'a', false, null, '', ['b', ['c']])).toBe('<p>abc</p>');
    });
    it('h: void elements have no closing tag', () => {
        expect(h('input', {type: 'search'})).toBe('<input type="search">');
    });
    it('text escapes, and treats null as empty', () => {
        expect(text('<b>&')).toBe('&lt;b&gt;&amp;');
        expect(text(null)).toBe('');
        expect(text(0)).toBe('0');
    });
});
