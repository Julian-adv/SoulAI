import { get } from 'svelte/store'
import type { SceneType, Preset, Usage, ChatResult, Session } from './interfaces'
import { user } from './store'
import { assistantRole, countTokensApi, generatePromptCheck } from './api'
import { tcLog } from './tauriCompat'

export async function sendChatOobabooga(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  session: Session,
  summary: boolean
): Promise<ChatResult | null> {
  const uri = preset.oobabooga.apiUrl + '/v1/generate'
  const url = new URL(uri)
  const { prompt, tokens } = await generatePromptCheck(
    preset,
    prologues,
    dialogues,
    memories,
    session,
    summary
  )
  tcLog('INFO', 'prompt:', prompt)
  const usage: Usage = { prompt_tokens: tokens, completion_tokens: 0, total_tokens: tokens }
  const userName = get(user).name

  const respFromOoga = await fetch(url, {
    body: JSON.stringify({
      ...preset.oobabooga,
      // continue_: false,
      // name1: name1,
      // name2: name2,
      stop: [
        '### INPUT',
        '### Input',
        '### User',
        '### USER',
        '### INSTRUCTION',
        '### Instruction',
        '\n```',
        '\nUser:',
        '\nuser:',
        '\n<|user|>',
        `\n${userName}:`,
        `\n${userName} `
      ],
      prompt: prompt
    }),
    headers: {},
    method: 'POST',
    signal: null
  })
  const dataFromOoga = await respFromOoga.json()
  tcLog('INFO', 'dataFromOoga', dataFromOoga.results[0].text)
  if (respFromOoga.ok && respFromOoga.status >= 200 && respFromOoga.status < 300) {
    const scene: SceneType = {
      id: 0,
      role: assistantRole,
      content: dataFromOoga.results[0].text,
      done: true
    }
    usage.completion_tokens = countTokensApi(dataFromOoga.results[0].text)
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
    return { scene, usage }
  } else {
    return null
  }
}

export async function sendChatOobaboogaStream(
  preset: Preset,
  prologues: SceneType[],
  dialogues: SceneType[],
  memories: string,
  session: Session,
  summary: boolean,
  received: (text: string) => void,
  closedCallback: () => void
): Promise<ChatResult | null> {
  const userName = get(user).name

  const { prompt, tokens } = await generatePromptCheck(
    preset,
    prologues,
    dialogues,
    memories,
    session,
    summary
  )
  tcLog('INFO', 'prompt:', prompt)
  const usage: Usage = { prompt_tokens: tokens, completion_tokens: 0, total_tokens: tokens }

  const conn = new WebSocket(preset.oobabooga.apiUrl)
  conn.onopen = () => {
    const request = {
      ...preset.oobabooga,
      stop: [
        '### INPUT',
        '### Input',
        '### User',
        '### USER',
        '### INSTRUCTION',
        '### Instruction',
        '### Response',
        '\n```',
        '\nUser:',
        '\nuser:',
        '\n<|user|>',
        `\n${userName}:`,
        `\n${userName} `
      ],
      prompt: prompt
    }
    conn.send(JSON.stringify(request))
  }

  conn.onmessage = event => {
    const resp = JSON.parse(event.data)
    switch (resp.event) {
      case 'text_stream':
        received(resp.text)
        break
      case 'stream_end':
        conn.close()
        closedCallback()
        break
    }
  }

  conn.onerror = error => {
    tcLog('ERROR', 'on error', String(error))
  }

  conn.onclose = () => {
    tcLog('INFO', 'on close')
  }

  const scene: SceneType = {
    id: 0,
    role: assistantRole,
    content: ''
  }
  return { scene, usage }
}
