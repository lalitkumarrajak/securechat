// This app's translations: locales/<language>/*.json, each a part, loaded only when that language is on.
import { fromParts } from '@sanga/i18n';

export const SHELL_DICTS = { shell: { hi: fromParts(import.meta.glob('./locales/hi/*.json')) } };
