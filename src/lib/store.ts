import { writable } from "svelte/store";
import type { SceneType, Story } from "./interfaces";

export const openAiApiKey = writable('');
export const openAiModel = writable('');

const defaultScenes:SceneType[] = [];

export const scenes = writable(defaultScenes);

export const hiddenScenes = writable(0);

const defaultStory: Story = {
  title: '',
  model: '',
  temperature: 0.75,
  frequencyPenalty: 0.4,
  presencePenalty: 0.4,
  maxTokens: 300,
  prompts: []
}

export const story = writable(defaultStory);