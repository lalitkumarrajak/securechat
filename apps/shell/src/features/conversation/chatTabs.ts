import { create } from 'zustand';
import type { Topic } from '../../lib/types';

/** The add / rename dialog: 'new', a tab to rename, or closed. */
export const useTabDialog = create<{ edit: Topic | 'new' | null }>(() => ({ edit: null }));
export const addChatTab = () => useTabDialog.setState({ edit: 'new' });

export const NO_TOPICS: Topic[] = [];
