// Every message the server (server/*.js) answers with in English and the user may see. api() in
// engine.ts (and so sdk().api in the apps) and the games' error toast show them with t(message), a key
// the checker can't see: listed here so their Hindi entries count as used. Keep in step with the server.
import { tk } from '@sanga/i18n';

export const SERVER_TEXT = [
  // general (index.js, http.js)
  tk('not found'), tk('method not allowed'), tk('Not logged in'), tk('Slow down'), tk('Request too large'), tk('Bad request'),
  // accounts and sessions (auth.js)
  tk('Sign-up is closed'), tk('Too many attempts, try later'), tk('Username: 3-24 chars, a-z 0-9 _ .'), tk('Invalid auth key'),
  tk('Invalid public key'), tk('Invalid key backup'), tk('Username taken'), tk('Invalid credentials'),
  tk('Too many attempts, try again in 15 minutes'), tk('Wrong username or password'), tk('Invalid session'), tk('Session not found'),
  tk('Invalid request'), tk('Current password is wrong'),
  tk('Enter a valid email address'), tk('This email is already used by another account'), tk('Couldn’t send the email, try again later'),
  tk('This is already your email'), tk('That code isn’t right'), tk('That code has expired, ask for a new one'),
  // friends (friends.js)
  tk('Not your friend'), tk('Too many requests, try later'), tk('No such user'), tk('Unblock them first'), tk("You can't add this user"),
  tk('No pending request from them'), tk('No pending request'),
  // groups (groups.js)
  tk('Group not found'), tk('Only group admins can do that'), tk('Give the group a name'), tk('A group can have up to 50 people'),
  tk('You can only add your friends'), tk('Pick someone to add'), tk('Not in this group'), tk('This invite link isn’t valid any more'),
  tk('This group is full'), tk('You can’t join this group'), tk('No photo'), tk('Invalid image'), tk('Use a JPEG, PNG or WebP image'),
  // profiles (profiles.js)
  tk('Invalid mute'),
  // push (push.js)
  tk('Invalid subscription'), tk('This browser is set up for notifications for another account'),
  // link previews, GIFs, songs (preview.js, gifs.js, songs.js)
  tk('No preview'), tk('That link can’t be previewed'), tk('GIFs aren’t set up on this server'), tk('GIF search is unavailable right now'),
  tk('Song search is unavailable right now'),
  // app storage (items.js), notes (notes.js), reminders (reminders.js)
  tk('Unknown app'), tk('Invalid since'), tk('Invalid record'), tk('That is too long'), tk('You can keep up to 20000 of these'),
  tk('This app is using all its space. Delete some first.'), tk('Invalid note'), tk('That note is too long'), tk('You can keep up to 10000 notes'),
  tk('Your notes are using all their space. Delete some first.'), tk('Up to 500 reminders'), tk('Invalid reminder'),
  // stories (stories.js)
  tk('This story is no longer available'), tk('Too many stories for now. Try again later.'), tk('Invalid story'), tk('That story is too large'),
  tk('Invalid tags'), tk('You can have up to 30 stories at a time. Delete one first.'), tk('Your stories are using all their space. Delete one first.'),
  tk('Story not found'), tk('That comment is too long'), tk('You’ve commented a lot on this story already'), tk('Comment not found'),
  // Split (split.js)
  tk('Invalid group'), tk('You can be in up to 100 groups'), tk('They are in too many groups'), tk('Only the person who made the group can remove people'),
  tk('This group has reached its limit'), tk('This group is out of space'), tk('Invalid bill'), tk('Bill not found'), tk('That bill is too big'),
  tk('This group is out of space for bills'),
  // games (games.js, over the socket: frameHooks.gerr)
  tk('This game has ended'), tk('Unknown game'), tk('Pick 1 to 1 friends'), tk('Pick 1 to 3 friends'), tk('Pick 1 to 5 friends'), tk('Pick 1 to 7 friends'),
  tk('You can only invite friends'), tk('Finish or leave one of your games first'), tk('Wait for someone to join'), tk('This game has already started'),
  tk('This game is invite-only'), tk('You can’t join this game'), tk('This game is full'), tk('No seats left'),
];
