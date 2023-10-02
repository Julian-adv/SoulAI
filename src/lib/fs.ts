import { writeBinaryFile } from '@tauri-apps/api/fs'
import { sep } from '@tauri-apps/api/path'
import type { Preset, Char, FirstScene, Session } from './interfaces'
import { open, save } from '@tauri-apps/api/dialog'
import { convertFileSrc } from '@tauri-apps/api/tauri'
import { readMetadata } from 'png-metadata-writer'
import {
  tcAppDataDir,
  tcCopyFile,
  tcCreateDir,
  tcExists,
  tcResolveResource,
  tcWriteBinaryFile,
  tcWriteTextFile
} from './tauriCompat'

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
  if (window.__TAURI_METADATA__) {
    const byteString = atob(dataURI.split(',')[1])
    const arrayBuffer = new ArrayBuffer(byteString.length)
    const uint8Array = new Uint8Array(arrayBuffer)

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i)
    }
    writeBinaryFile(filename, uint8Array)
  } else {
    tcWriteBinaryFile(filename, dataURI)
  }
}

export function saveImageToFileOrg(dataURI: string, filename: string) {
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
    tcWriteTextFile(filePath, JSON.stringify(data, null, 2))
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

export async function saveObjQuietly(filePath: string, obj: Preset | Char | FirstScene | Session) {
  tcWriteTextFile(filePath, JSON.stringify(obj, null, 2))
}

export const presetExt = 'preset'
export const sessionExt = 'session'
export const charExt = 'char'
export const sceneExt = 'scene'
export const allExts = [presetExt, sessionExt, charExt, sceneExt]

export const settingsFile = 'settings.json'

export function basenameOf(path: string) {
  let endIndex = path.lastIndexOf('.')
  if (endIndex < 0) {
    endIndex = path.length
  }
  let startIndex = path.lastIndexOf(sep)
  if (startIndex < 0) {
    startIndex = -1
  }
  return path.slice(startIndex + 1, endIndex)
}

export function extOf(path: string) {
  const index = path.lastIndexOf('.')
  if (index < 0) {
    return ''
  }
  return path.slice(index + 1)
}

export function dirnameOf(path: string) {
  const correctedPath = path.replace(/\\/g, '/')
  const lastSlashIndex = correctedPath.lastIndexOf('/')
  if (lastSlashIndex === -1) return ''
  return correctedPath.substring(0, lastSlashIndex)
}

function loadFileAsBlob(path: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.responseType = 'blob'
    xhr.onload = () => resolve(xhr.response)
    xhr.onerror = reject
    xhr.open('GET', convertFileSrc(path))
    xhr.send()
  })
}

export async function loadMetaData(path: string) {
  const blob = await loadFileAsBlob(path)
  const buffer = await blob.arrayBuffer()
  return readMetadata(new Uint8Array(buffer))
}

export async function installDefaults() {
  const filesToCopy = ['default.preset', 'Julian.char', 'Eliane.char', "Adventurer's Guild.scene"]

  if (await tcExists(filesToCopy[0])) {
    return
  }

  const dataDir = await tcAppDataDir()
  if (!(await tcExists(dataDir))) {
    tcCreateDir('')
  }

  for (const file of filesToCopy) {
    const filePath = await tcResolveResource('resources/' + file)
    tcCopyFile(filePath, file)
  }
}
