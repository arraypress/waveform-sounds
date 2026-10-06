import {describe, it, expect, vi} from 'vitest';
import {parseBool, parseList, parseNumber, parseUrlState, parseJson, readDataOptions, mergeOptions, DEFAULT_OPTIONS} from '../../../src/js/core/options.js';

describe('attribute parsers', () => {
    it('parseBool', () => {
        expect(parseBool('')).toBe(true);
        expect(parseBool('true')).toBe(true);
        expect(parseBool('false')).toBe(false);
        expect(parseBool('yes')).toBeUndefined();
        expect(parseBool(undefined)).toBeUndefined();
    });
    it('parseList: trims, drops blanks, empty string = empty list', () => {
        expect(parseList(' type , key,')).toEqual(['type', 'key']);
        expect(parseList('')).toEqual([]);
        expect(parseList(undefined)).toBeUndefined();
    });
    it('parseNumber: empty is unset', () => {
        expect(parseNumber('24')).toBe(24);
        expect(parseNumber('')).toBeUndefined();
    });
    it('parseUrlState: booleans or a prefix', () => {
        expect(parseUrlState('true')).toBe(true);
        expect(parseUrlState('')).toBe(true);
        expect(parseUrlState('false')).toBe(false);
        expect(parseUrlState('pack')).toBe('pack');
    });
    it('parseJson warns and ignores invalid JSON', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(parseJson('{"a":1}', 'x')).toEqual({a: 1});
        expect(parseJson('{oops', 'strings')).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('data-strings'));
        warn.mockRestore();
    });
});

describe('readDataOptions / mergeOptions', () => {
    it('reads only what is set', () => {
        const el = document.createElement('div');
        Object.assign(el.dataset, {player: 'strip', pageSize: '30', sorts: '', urlState: 'pack', strings: '{"loop":"L"}'});
        expect(readDataOptions(el)).toEqual({player: 'strip', pageSize: 30, sorts: [], urlState: 'pack', strings: {loop: 'L'}});
        expect(readDataOptions(document.createElement('div'))).toEqual({});
    });
    it('later sources win; null/undefined never overwrite', () => {
        expect(mergeOptions({a: 1, b: 2}, {a: null, b: 3}, undefined, {c: undefined})).toEqual({a: 1, b: 3});
    });
    it('every default has a defined value or null', () => {
        for (const [k, v] of Object.entries(DEFAULT_OPTIONS)) expect(v, k).not.toBeUndefined();
    });
});
