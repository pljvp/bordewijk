// story_data.js — tijdelijke shim; vervalt in fase 1 wanneer generator story-agnostisch is
import storyDef from './stories/bordewijk_verplaatsing.js';

export const STORY = {
  title:      storyDef.title,
  author:     storyDef.author,
  year:       storyDef.year,
  chapters:   storyDef.chapters,
  paragraphs: storyDef.paragraphs,
};
