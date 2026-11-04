// This app's translations: locales/<language>/*.json, each a part, loaded only when that language is on.
import { fromParts } from '@sanga/i18n';

export const SPLIT_DICTS = { split: { hi: fromParts(import.meta.glob('./locales/hi/*.json')), mr: fromParts(import.meta.glob('./locales/mr/*.json')) } };
