import { get } from 'svelte/store'
import type { Preset, SceneType, Message, ChatResult, Session } from './interfaces'
import { settings, zeroUsage } from './store'
import {
  assistantRole,
  assocMemory,
  charSetting,
  chatHistory,
  countTokensApi,
  endTag,
  saveMemory,
  startStory,
  systemRole,
  tokensOver,
  userRole,
  userSetting
} from './api'
import { getStartEndIndex } from '$lib'
import { tcLog } from './tauriCompat'

function convertRole(role: string) {
  switch (role) {
    case systemRole:
    case charSetting:
    case endTag:
      return systemRole
    case assistantRole:
      return assistantRole
    case userRole:
    case userSetting:
      return userRole
    default:
      return systemRole
  }
}

function generateMessages(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  summary: boolean
) {
  const messages: Message[] = []
  if (summary) {
    messages.push({ role: systemRole, content: preset.summarizePrompt })
    for (const scene of dialogues) {
      messages.push({ role: scene.role, content: scene.content })
    }
  } else {
    let sentChatHistory = false
    for (const scene of prologues) {
      switch (scene.role) {
        case startStory:
          break
        case chatHistory: {
          const { start, end } = getStartEndIndex(scene, dialogues)
          for (const mesg of dialogues.slice(start, end)) {
            messages.push({ role: mesg.role, content: mesg.textContent ?? mesg.content })
          }
          sentChatHistory = true
          break
        }
        case assocMemory: {
          if (memories) {
            messages.push({ role: systemRole, content: scene.textContent + '\n' + memories })
          }
          break
        }
        default:
          messages.push({
            role: convertRole(scene.role),
            content: scene.textContent ?? scene.content
          })
      }
    }
    if (!sentChatHistory) {
      for (const scene of dialogues) {
        messages.push({ role: scene.role, content: scene.content })
      }
    }
  }
  return messages
}

async function generateMessagesCheck(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  session: Session,
  summary: boolean
) {
  let messages: Message[] = []
  let tokens = 0
  while (session.startIndex < dialogues.length) {
    messages = generateMessages(
      preset,
      prologues,
      dialogues.slice(session.startIndex),
      memories,
      summary
    )
    for (const mesg of messages) {
      tokens += countTokensApi(mesg.content)
    }
    if (tokensOver(preset, tokens)) {
      await saveMemory(dialogues[session.startIndex])
      session.startIndex++
    } else {
      break
    }
  }
  return { messages, tokens }
}

function generatePrompt(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  summary: boolean
) {
  let prompt = ''
  if (summary) {
    prompt += preset.summarizePrompt + '\n'
    for (const scene of dialogues) {
      prompt += scene.content + '\n'
    }
  } else {
    let sentChatHistory = false
    for (const scene of prologues) {
      switch (scene.role) {
        case startStory:
          break
        case chatHistory: {
          const { start, end } = getStartEndIndex(scene, dialogues)
          for (const mesg of dialogues.slice(start, end)) {
            prompt += mesg.content + '\n'
          }
          sentChatHistory = true
          break
        }
        case assocMemory: {
          if (memories) {
            prompt += scene.content + '\n'
            prompt += memories
          }
          break
        }
        default:
          prompt += scene.content + '\n'
      }
    }
    if (!sentChatHistory) {
      for (const scene of dialogues) {
        prompt += scene.content + '\n'
      }
    }
  }
  return prompt
}

async function generateOpenAIPromptCheck(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  session: Session,
  summary = false
) {
  let prompt = ''
  let tokens = 0
  while (session.startIndex < dialogues.length) {
    prompt = generatePrompt(
      preset,
      prologues,
      dialogues.slice(session.startIndex),
      memories,
      summary
    )
    tokens = countTokensApi(prompt)
    if (tokensOver(preset, tokens)) {
      await saveMemory(dialogues[session.startIndex])
      session.startIndex++
    } else {
      break
    }
  }
  return { prompt, tokens }
}

function apiUrl(instructModel: boolean) {
  if (instructModel) {
    return '/completions'
  } else {
    return '/chat/completions'
  }
}

export async function sendChatOpenAi(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  session: Session,
  summary: boolean
): Promise<ChatResult | null> {
  const instructModel = preset.openAi.model.includes('instruct')
  const uri = preset.openAi.apiUrl + apiUrl(instructModel)
  const url = new URL(uri)
  const commonReq = {
    model: preset.openAi.model,
    temperature: preset.openAi.temperature,
    frequency_penalty: preset.openAi.frequencyPenalty,
    presence_penalty: preset.openAi.presencePenalty,
    max_tokens: preset.openAi.maxTokens,
    stream: false
  }
  let request
  if (instructModel) {
    const { prompt } = await generateOpenAIPromptCheck(
      preset,
      prologues,
      dialogues,
      memories,
      session,
      summary
    )
    request = {
      ...commonReq,
      prompt: prompt
    }
  } else {
    const { messages } = await generateMessagesCheck(
      preset,
      prologues,
      dialogues,
      memories,
      session,
      summary
    )
    request = {
      ...commonReq,
      messages: messages
    }
  }
  tcLog('INFO', 'request', JSON.stringify(request))
  const respFromGPT = await fetch(url, {
    body: JSON.stringify(request),
    headers: {
      Authorization: 'Bearer ' + get(settings).openAiApiKey,
      'Content-Type': 'application/json'
    },
    method: 'POST',
    signal: null
  })
  const dataFromGPT = await respFromGPT.json()
  tcLog('INFO', 'dataFromGPT', JSON.stringify(dataFromGPT))
  if (respFromGPT.ok && respFromGPT.status >= 200 && respFromGPT.status < 300) {
    let scene: SceneType
    if (instructModel) {
      scene = {
        id: 0,
        role: assistantRole,
        content: dataFromGPT.choices[0].text
      }
    } else {
      scene = dataFromGPT.choices[0].message
      scene.id = 0
    }
    scene.done = true
    return { scene, usage: dataFromGPT.usage ?? zeroUsage }
  } else {
    return null
  }
}

export async function sendChatOpenAiStream(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  session: Session,
  summary: boolean,
  received: (text: string) => void,
  closedCallback: () => void
): Promise<ChatResult | null> {
  const instructModel = preset.openAi.model.includes('instruct')
  const uri = preset.openAi.apiUrl + apiUrl(instructModel)
  const url = new URL(uri)
  const commonReq = {
    model: preset.openAi.model,
    temperature: preset.openAi.temperature,
    frequency_penalty: preset.openAi.frequencyPenalty,
    presence_penalty: preset.openAi.presencePenalty,
    max_tokens: preset.openAi.maxTokens,
    stream: true
  }
  let request
  let numTokens = 0
  if (instructModel) {
    const { prompt, tokens } = await generateOpenAIPromptCheck(
      preset,
      prologues,
      dialogues,
      memories,
      session,
      summary
    )
    request = {
      ...commonReq,
      prompt: prompt
    }
    numTokens = tokens
  } else {
    const { messages, tokens } = await generateMessagesCheck(
      preset,
      prologues,
      dialogues,
      memories,
      session,
      summary
    )
    request = {
      ...commonReq,
      messages: messages
    }
    numTokens = tokens
  }
  tcLog('INFO', 'request', JSON.stringify(request))
  const respFromGPT = await fetch(url, {
    body: JSON.stringify(request),
    headers: {
      Authorization: 'Bearer ' + get(settings).openAiApiKey,
      'Content-Type': 'application/json'
    },
    method: 'POST',
    signal: null
  })
  if (respFromGPT.ok && respFromGPT.status >= 200 && respFromGPT.status < 300) {
    const reader = respFromGPT.body?.getReader()
    const decoder = new TextDecoder()
    reader?.read().then(async function processText({ value }): Promise<void> {
      const str = decoder.decode(value)
      const strs = str.split('\n')
      for (const str of strs) {
        if (str.startsWith('data: ')) {
          const text = str.slice(6)
          if (text === '[DONE]') {
            closedCallback()
            return
          } else {
            const json = JSON.parse(text)
            if (json.choices[0].delta.content) {
              received(json.choices[0].delta.content)
            }
          }
        }
      }
      return reader?.read().then(processText)
    })
    const scene = {
      id: 0,
      role: assistantRole,
      content: ''
    }
    return {
      scene,
      usage: { prompt_tokens: numTokens, completion_tokens: 0, total_tokens: numTokens }
    }
  } else {
    return null
  }
}
