import { describe, expect, it } from 'vitest';
import { children, descendants, folderOk, inTrash, pathTo, sorted, valid, within, type Entry } from './store';
import { freeName, kindOf, mimeOf, previewable } from './kinds';
import { parseCsv } from './csv';

const e = (id: string, parent: string, o: Partial<Entry> = {}): Entry & { box: string } =>
  ({ id, type: 'folder', name: id, parent, created: 1, edited: 1, box: '', ...o });
// My Drive ── a ── b ── f1
//          └─ t (trashed) ── f2
const m = {
  a: e('a', ''), b: e('b', 'a'), f1: e('f1', 'b', { type: 'file', size: 5 }),
  t: e('t', '', { trashed: 9 }), f2: e('f2', 't', { type: 'file', size: 1 }),
};

describe('the tree', () => {
  it('finds what is in a folder, the path to it, and everything below it', () => {
    expect(children('', m).map((x) => x.id)).toEqual(['a']); // t is in the Trash
    expect(pathTo('f1', m).map((x) => x.id)).toEqual(['a', 'b', 'f1']);
    expect(descendants('a', m).map((x) => x.id).sort()).toEqual(['b', 'f1']);
  });
  it('treats whatever is inside a trashed folder as trashed', () => {
    expect(inTrash(m.f2, m)).toBe(true);
    expect(inTrash(m.f1, m)).toBe(false);
    expect(folderOk('t', m)).toBe(false);
    expect(folderOk('b', m)).toBe(true);
    expect(folderOk('', m)).toBe(true);
  });
  it('won’t put a folder inside itself', () => {
    expect(within('b', 'a', m)).toBe(true);
    expect(within('a', 'b', m)).toBe(false);
  });
  it('sorts folders first', () => {
    expect(sorted([m.f1, m.b, m.a], 'name').map((x) => x.id)).toEqual(['a', 'b', 'f1']);
    expect(sorted([e('x10', ''), e('x9', '')], 'name').map((x) => x.id)).toEqual(['x9', 'x10']);
  });
});

describe('records', () => {
  it('keeps only a well-formed record', () => {
    expect(valid({ type: 'folder', name: 'Trip', parent: '' }, 'abcdefgh')).toMatchObject({ id: 'abcdefgh', type: 'folder', name: 'Trip', parent: '' });
    expect(valid({ type: 'file', name: 'x' }, 'abcdefgh')).toBeNull(); // no key: can't be opened
    expect(valid({ type: 'nope' }, 'abcdefgh')).toBeNull();
    const f = valid({ type: 'file', name: 'a.jpg', parent: 'abcdefgh', key: 'k', chunks: 2, size: 3, thumb: 'javascript:x' }, 'abcdefgh')!;
    expect(f.parent).toBe(''); // not inside itself
    expect(f.thumb).toBeUndefined();
  });
});

describe('files', () => {
  it('knows a file’s kind from its type or name', () => {
    expect(mimeOf('IMG_1.HEIC')).toBe('image/heic');
    expect(kindOf(mimeOf('a.pdf'), 'a.pdf')).toBe('pdf');
    expect(kindOf(mimeOf('x.csv'), 'x.csv')).toBe('text');
    expect(kindOf(mimeOf('x.xlsx'), 'x.xlsx')).toBe('sheet');
    expect(previewable('text/plain', 'big.log', 50e6)).toBe(false);
  });
  it('makes a name free in a folder', () => {
    expect(freeName('a.jpg', new Set(['A.jpg', 'a (1).jpg']))).toBe('a (2).jpg');
    expect(freeName('Trip', new Set(['Trip']))).toBe('Trip (1)');
  });
  it('reads CSV with quotes and line breaks in cells', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\r\n1,2')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere'], ['1', '2']]);
  });
});
