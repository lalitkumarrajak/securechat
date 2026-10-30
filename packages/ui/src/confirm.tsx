// Promise-based confirmation dialog, replacing window.confirm():
//   if (await confirm({ title: 'Block Rakhi?', confirmText: 'Block', destructive: true })) …

export { choose, confirm } from './confirm/store';
export { ConfirmHost } from './confirm/ConfirmHost';
