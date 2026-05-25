// story_library.js — verhaalbibliotheek + runtime user stories
import { STORY_LIBRARY, DEFAULT_STORY_ID } from './stories/index.js';
import * as storage from './storage.js';

export { DEFAULT_STORY_ID };

// In-memory user stories (aangemaakt of geïmporteerd tijdens sessie)
const _userStories = [];

export function getLibraryStories() {
  return [...STORY_LIBRARY, ..._userStories];
}

export function addUserStory(storyDef) {
  // Vervang bestaand verhaal met zelfde id
  const idx = _userStories.findIndex(s => s.id === storyDef.id);
  if (idx >= 0) _userStories.splice(idx, 1, storyDef);
  else _userStories.push(storyDef);
}

export function getActiveStory() {
  const id = storage.getActiveStoryId();
  const all = getLibraryStories();
  return all.find(s => s.id === id) || all.find(s => s.id === DEFAULT_STORY_ID);
}
