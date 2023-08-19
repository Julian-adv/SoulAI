import { writable } from "svelte/store"
import type { SceneType, Story, StringDictionary, Settings, Char } from "./interfaces"
import { Api, SortOrder, SortType } from './interfaces'

const defaultScenes:SceneType[] = []

export const initialScenes = writable(defaultScenes)
export const additionalScenes = writable(defaultScenes)

const defaultStory: Story = {
  title: '',
  image: '',
  api: Api.OpenAi,
  // This prompt is copied from https://arca.live/b/characterai/81890153
  // summarizePrompt: "This is part of the history of the last conversation between <char>(<char_gender>) and <user>(<user_gender>). Summarize, condense, approximately timestamp the content of the messages exchanged between <char> and <user>, focusing on concrete events and direct information from their conversation. Remove or simplify any content that appears to be redundant or repetitive. Use abbreviations, common language shortcuts. Lastly, add \"<Preiviously on <char> and <user>'s story>\" at the beginning of the output, and \"</Previously>\" at the end of the output. If any of these phrases are in the middle of the input you receive, delete them. They should only appear once, at the end of the output. Next, add a visual summary of what's going on. It is important to include details about character's appearance, clothing, posture, and surroundings in the visual summary. The description should be written in short phrases within \"<Visual>\" and \"</Visual>\", for example \"<Visual>blonde hair, big breasts, long legs, school uniform, lying in bed</Visual>\"",
  summarizePrompt: "This is part of the history of the last conversation between <char>(<char_gender>) and <user>(<user_gender>). Summarize, condense, approximately timestamp the content of the messages exchanged between <char> and <user>, focusing on concrete events and direct information from their conversation. Remove or simplify any content that appears to be redundant or repetitive. Use abbreviations, common language shortcuts. Lastly, add \"<Preiviously on <char> and <user>'s story>\" at the beginning of the output, and \"</Previously>\" at the end of the output. If any of these phrases are in the middle of the input you receive, delete them. They should only appear once, at the end of the output.",

  openAi: {
    apiUrl: 'https://api.openai.com/v1',
    model: '',
    frequencyPenalty: 0.4,
    presencePenalty: 0.4,
    temperature: 0.75,
    maxTokens: 300,
    contextSize: 4096,
  },
  
  // oobabooga
  oobabooga: {
    apiUrl: 'http://localhost:5000/api/v1/generate',
    maxTokens: 300,
    temperature: 1.0,
    topK: 0,
    topP: 1.0,
    typicalP: 1.0,
    topA: 0,
    repetitionPenalty: 1.0,
    encoderRepetitionPenalty: 1,
    noRepeatNgramSize: 0,
    minLength: 0,
    doSample: true,
    penaltyAlpha: 0,
    numBeams: 1,
    lengthPenalty: 1,
    earlyStopping: false,
    truncationLength: 2048,
    addBosToken: true,
    banEosToken: false,
    skipSpecialTokens: true,
    seed: -1,
    contextSize: 4096,
    systemPrefix: "### Instruction:\n",
    userPrefix: "### Input:\n",
    assistantPrefix: "### Response:\n"
  },

  prompts: []
}

export const story = writable(defaultStory)

export const storyPath = writable('')
export const sessionPath = writable('')

export const zeroUsage = {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0}
export const usage = writable(zeroUsage)

export const firstSceneIndex = writable(0)
export const summarySceneIndex = writable(0)
export const summarizePrompt = writable('')

const dict: StringDictionary = {}
export const replaceDict = writable(dict)

export const defaultSettings: Settings = {
  openAiApiKey: "",
  sortOrder: SortOrder.Ascending,
  sortType: SortType.Name,
  convertMarkdown: true,
  dialogSettings: {
    bold: true,
    italic: false,
    color: "#0f0f0f"
  },
  descriptionSettings: {
    bold: false,
    italic: true,
    color: "#0f0f0f"
  },
  userNameSettings: {
    bold: true,
    italic: false,
    color: "#0f0f0f"
  },
  charNameSettings: {
    bold: true,
    italic: false,
    color: "#0f0f0f"
  },
  fontFamily: 'Geogia',
  fontSize: 12,
  generateImage: true,
  sdURL: 'http://localhost:7860',
  imageWidth: 512,
  imageHeight: 512,
  steps: 30,
  cfgScale: 7.0,
  prompt: '(masterpiece, best quality, realistic, finely detailed)',
  negativePrompt: '(worst quality, low quality, normal quality)',
  sampler: 'DPM++ SDE Karras',
  enableHires: false,
  denoisingStrength: 0.4,
  hiresScale: 2.0,
  hiresUpscaler: 'Latent',
  enableADetailer: true,
  deeplApiKey: '',
  aiLang: 'EN-US',
  userLang: '',
  translateOutput: false,
  translateInput: false
}

export const settings = writable(defaultSettings)

export const emptyChar: Char = {
  image: '',
  name: 'Click to load',
  gender: '',
  visual: '',
  description: ''
}

export const curChar = writable(emptyChar)
export const curCharPath = writable('')
export const char = writable(emptyChar)
export const charPath = writable('')
export const user = writable(emptyChar)
export const userPath = writable('')