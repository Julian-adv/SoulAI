import { readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { sep } from '@tauri-apps/api/path'
import { type Preset, type Char, Api, type SceneType } from './interfaces'
import { open, save } from '@tauri-apps/api/dialog'
import { convertFileSrc } from '@tauri-apps/api/tauri'
import {
  assistantRole,
  authorNote,
  changeApi,
  charSetting,
  chatHistory,
  endTag,
  globalNote,
  loreBook,
  systemRole,
  userRole,
  userSetting
} from './api'
import { defaultPreset } from './store'

function convertRole(risuRole: string) {
  switch (risuRole) {
    case 'user':
      return userRole
    case 'bot':
      return assistantRole
    case 'system':
      return systemRole
    default:
      return systemRole
  }
}

interface RisuPrompt {
  text: string
  role: string
  innerFormat: string
  rangeStart: number
  rangeEnd: string
}

let sceneId = 0

function convertCharSetting(preset: Preset, prompt: RisuPrompt, role: string) {
  const [beforeSlot, afterSlot] = prompt.innerFormat.split('{{slot}}')
  const scene: SceneType = {
    id: sceneId++,
    content: beforeSlot,
    role: convertRole(prompt.role)
  }
  preset.prompts.push(scene)
  const scene2: SceneType = {
    id: sceneId++,
    content: '',
    role: role
  }
  preset.prompts.push(scene2)
  const scene3: SceneType = {
    id: sceneId++,
    content: afterSlot,
    role: endTag
  }
  preset.prompts.push(scene3)
}

function convertChat(preset: Preset, start: number, end: string) {
  const scene: SceneType = {
    id: sceneId++,
    content: '',
    role: chatHistory,
    rangeStart: start,
    rangeEnd: end
  }
  preset.prompts.push(scene)
}

function convertNormal(preset: Preset, prompt: RisuPrompt, role?: string) {
  const scene: SceneType = {
    id: sceneId++,
    content: prompt.text,
    role: role ? role : convertRole(prompt.role)
  }
  preset.prompts.push(scene)
}

function splitWithTokens(input: string): string[] {
  const regexp = /(@@@system\n|@@@user\n|@@@assistant\n)/

  const segments = []
  let match

  while (input && (match = regexp.exec(input)) !== null) {
    segments.push(input.slice(0, match.index))
    segments.push(match[0])
    input = input.slice(match.index + match[0].length)
  }

  segments.push(input)

  return segments.filter(segment => segment.trim() !== '')
}

function convertMainPrompt(preset: Preset, prompt: string) {
  const segments = splitWithTokens(prompt)
  for (let i = 0; i < segments.length; ) {
    let role
    switch (segments[i]) {
      case '@@@system\n':
        role = systemRole
        i++
        break
      case '@@@assistant\n':
        role = assistantRole
        i++
        break
      case '@@@user\n':
        role = userRole
        i++
        break
      default:
        role = systemRole
        break
    }
    preset.prompts.push({ id: sceneId++, content: segments[i], role: role })
    i++
  }
}

export async function loadPreset(path: string): Promise<[Preset, boolean]> {
  const json = await readTextFile(path)
  const tempPreset = JSON.parse(json)
  let preset: Preset = defaultPreset
  let imported = false
  if (tempPreset.name) {
    // Assume RisuAI's preset
    preset.prompts = []
    imported = true
    preset.title = tempPreset.name
    preset.api = tempPreset.aiModel === 'textgen_webui' ? Api.Oobabooga : Api.OpenAi
    if (preset.api === Api.OpenAi) {
      preset.openAi.temperature = tempPreset.temperature
      preset.openAi.contextSize = tempPreset.maxContext
      preset.openAi.maxTokens = tempPreset.maxResponse
      preset.openAi.frequencyPenalty = tempPreset.frequencyPenalty
      preset.openAi.presencePenalty = tempPreset.presencePenalty
      preset.openAi.model = tempPreset.aiModel
    } else if (preset.api === Api.Oobabooga) {
      preset.oobabooga.apiUrl = tempPreset.textgenWebUIBlockingURL
      preset.oobabooga.maxTokens = tempPreset.ooba.max_new_tokens
      preset.oobabooga.doSample = tempPreset.ooba.do_sample
      preset.oobabooga.temperature = tempPreset.ooba.temperature
      preset.oobabooga.topP = tempPreset.ooba.top_p
      preset.oobabooga.typicalP = tempPreset.ooba.typical_p
      preset.oobabooga.repetitionPenalty = tempPreset.ooba.repetition_penalty
      preset.oobabooga.encoderRepetitionPenalty = tempPreset.ooba.encoder_repetition_penalty
      preset.oobabooga.topK = tempPreset.ooba.top_k
      preset.oobabooga.minLength = tempPreset.ooba.min_length
      preset.oobabooga.noRepeatNgramSize = tempPreset.ooba.no_repeat_ngram_size
      preset.oobabooga.numBeams = tempPreset.ooba.num_beams
      preset.oobabooga.penaltyAlpha = tempPreset.ooba.penalty_alpha
      preset.oobabooga.lengthPenalty = tempPreset.ooba.length_penalty
      preset.oobabooga.earlyStopping = tempPreset.ooba.early_stopping
      preset.oobabooga.seed = tempPreset.ooba.seed
      preset.oobabooga.addBosToken = tempPreset.ooba.add_bos_token
      preset.oobabooga.truncationLength = tempPreset.ooba.truncation_length
      preset.oobabooga.banEosToken = tempPreset.ooba.ban_eos_token
      preset.oobabooga.skipSpecialTokens = tempPreset.ooba.skip_special_tokens
      preset.oobabooga.topA = tempPreset.ooba.top_a
      preset.oobabooga.tfs = tempPreset.ooba.tfs
      preset.oobabooga.userPrefix = tempPreset.ooba.formating.userPrefix
      preset.oobabooga.assistantPrefix = tempPreset.ooba.formating.assistantPrefix
      preset.oobabooga.systemPrefix = tempPreset.ooba.formating.systemPrefix
    }
    sceneId = 0
    if (tempPreset.promptTemplate) {
      for (const prompt of tempPreset.promptTemplate) {
        if (prompt.type === 'description') {
          convertCharSetting(preset, prompt, charSetting)
        } else if (prompt.type === 'persona') {
          convertCharSetting(preset, prompt, userSetting)
        } else if (prompt.type === 'chat') {
          convertChat(preset, prompt.rangeStart, prompt.rangeEnd)
        } else if (prompt.type === 'authornote') {
          convertNormal(preset, prompt, authorNote)
        } else if (prompt.type === 'lorebook') {
          convertNormal(preset, prompt, loreBook)
        } else if (prompt.type === 'plain' && prompt.type2 === 'globalNote') {
          convertNormal(preset, prompt, globalNote)
        } else {
          convertNormal(preset, prompt)
        }
      }
    } else {
      if (tempPreset.formatingOrder) {
        for (const promptType of tempPreset.formatingOrder) {
          switch (promptType) {
            case 'main':
              if (tempPreset.mainPrompt) {
                convertMainPrompt(preset, tempPreset.mainPrompt)
              }
              break
            case 'personaPrompt':
              preset.prompts.push({ id: sceneId++, content: '', role: userSetting })
              break
            case 'description':
              preset.prompts.push({ id: sceneId++, content: '', role: charSetting })
              break
            case 'jailbreak':
              if (tempPreset.jailbreak) {
                convertMainPrompt(preset, tempPreset.jailbreak)
              }
              break
            case 'authorNote':
              if (tempPreset.authorNote) {
                convertMainPrompt(preset, tempPreset.authorNote)
              }
              break
            case 'lorebook':
              if (tempPreset.lorebook) {
                convertMainPrompt(preset, tempPreset.lorebook)
              }
              break
            case 'globalNote':
              if (tempPreset.globalNote) {
                convertMainPrompt(preset, tempPreset.globalNote)
              }
              break
            case 'chats':
              convertChat(preset, 0, '-1')
              break
            case 'lastChat':
              convertChat(preset, -1, 'end')
              break
          }
        }
      }
    }
  } else {
    preset = tempPreset
  }
  changeApi(preset.api)
  return [preset, imported]
}

export async function loadPresetDialog(): Promise<[Preset | null, string]> {
  const selected = await open({ filters: [{ name: '*', extensions: ['json', presetExt] }] })
  if (typeof selected === 'string') {
    const [preset, imported] = await loadPreset(selected)
    return [preset, imported ? '' : selected]
  }
  return [null, '']
}

async function readAsDataURL(blob: Blob): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function loadImage(): Promise<string | null> {
  const selected = await open({ filters: [{ name: '*', extensions: ['png', 'jpg'] }] })
  if (typeof selected === 'string') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.responseType = 'blob'
      xhr.onload = () => resolve(readAsDataURL(xhr.response))
      xhr.onerror = reject
      xhr.open('GET', convertFileSrc(selected))
      xhr.send()
    })
  }
  return null
}

function dataURIToBlob(dataURI: string) {
  const byteString = atob(dataURI.split(',')[1])
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }

  const blob = new Blob([uint8Array], { type: 'image/png' })
  return blob
}

export function saveImageToFile(dataURI: string, filename: string) {
  const blob = dataURIToBlob(dataURI)

  const url = window.URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()

  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

export async function savePath(path: string, ext: string, data: any) {
  const filePath = await save({ defaultPath: path, filters: [{ name: '*', extensions: [ext] }] })
  if (filePath) {
    writeTextFile(filePath, JSON.stringify(data, null, 2))
  }
  return filePath
}

export async function savePreset(preset: Preset) {
  let fileName = preset.title.replace(/[<>:"/\\|?*]/g, '_').trim()
  if (fileName === '') {
    fileName = 'preset' + Date.now()
  }
  fileName += '.' + presetExt
  return savePath(fileName, presetExt, preset)
}

export async function saveObjQuietly(filePath: string, obj: Preset | Char) {
  writeTextFile(filePath, JSON.stringify(obj, null, 2))
}

export const presetExt = 'preset'
export const sessionExt = 'session'
export const charExt = 'char'
export const allExts = [presetExt, sessionExt, charExt]

export function basenameOf(path: string) {
  let endIndex = path.lastIndexOf('.')
  if (endIndex < 0) {
    endIndex = path.length
  }
  let startIndex = path.lastIndexOf(sep)
  if (startIndex < 0) {
    startIndex = 0
  }
  return path.slice(startIndex, endIndex)
}

export function extOf(path: string) {
  const index = path.lastIndexOf('.')
  if (index < 0) {
    return ''
  }
  return path.slice(index + 1)
}
