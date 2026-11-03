import { describe, expect, it } from 'vitest';
import { lang, register, setLang, t, tn, tx } from './index';

describe('translations', () => {
  it('English by default: the text in the code', () => {
    expect(lang()).toBe('en');
    expect(t('Add expense')).toBe('Add expense');
    expect(t('Hi {name}', { name: 'Ravi' })).toBe('Hi Ravi');
    expect(tn(1, '{n} expense', '{n} expenses')).toBe('1 expense');
    expect(tn(3, '{n} expense', '{n} expenses')).toBe('3 expenses');
  });
  it('Hindi once picked, English where a word is missing', async () => {
    register('test', { hi: async () => ({ 'Add expense': 'ख़र्च जोड़ें', 'Hi {name}': 'नमस्ते {name}', '{n} expenses': { one: '{n} ख़र्च', other: '{n} ख़र्चे' } }) });
    await setLang('hi');
    expect(t('Add expense')).toBe('ख़र्च जोड़ें');
    expect(t('Hi {name}', { name: 'Ravi' })).toBe('नमस्ते Ravi');
    expect(t('Not translated')).toBe('Not translated');
    expect(tn(1, '{n} expense', '{n} expenses')).toBe('1 ख़र्च');
    expect(tn(4, '{n} expense', '{n} expenses')).toBe('4 ख़र्चे');
    const node = tx('Hi {name}', { name: 'R' }) as { props: { children: unknown[] } };
    expect(node.props.children).toHaveLength(2);
    await setLang('en');
    expect(t('Add expense')).toBe('Add expense');
  });
});
