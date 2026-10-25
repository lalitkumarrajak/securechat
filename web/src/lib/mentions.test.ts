import { describe, expect, it } from 'vitest';
import { insertMention, mentionQuery, mentioned, splitMentions } from './mentions';

const users = ['rakhi', 'lalit.r', 'chris'];

describe('mentions', () => {
  it('finds mentions of players only', () => {
    expect(mentioned('nice one @Rakhi and @nobody', users)).toEqual(['rakhi']);
    expect(mentioned('your turn @lalit.r.', users)).toEqual(['lalit.r']);
    expect(mentioned('email me@chris.com', users)).toEqual([]); // an email address isn't a mention
  });
  it('splits text for highlighting', () => {
    expect(splitMentions('hi @rakhi!', users)).toEqual([{ t: 'hi ' }, { t: '@rakhi', u: 'rakhi' }, { t: '!' }]);
    expect(splitMentions('no tags here', users)).toEqual([{ t: 'no tags here' }]);
  });
  it('knows when you are typing a mention', () => {
    expect(mentionQuery('hey @ra', 7)).toEqual({ start: 4, q: 'ra' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, q: '' });
    expect(mentionQuery('mail@ra', 7)).toBeNull();
    expect(mentionQuery('hey @ra done', 12)).toBeNull();
  });
  it('completes a mention', () => {
    expect(insertMention('hey @ra', 7, 4, 'rakhi')).toEqual({ text: 'hey @rakhi ', cursor: 11 });
    expect(insertMention('@c go', 2, 0, 'chris')).toEqual({ text: '@chris go', cursor: 7 });
  });
});
