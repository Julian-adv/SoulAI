import type { SceneType } from "./interfaces";

export const helperClassVisible = "text-stone-700";
export const helperClassHidden = "text-stone-400";
export const linkClassVisible = "text-sky-600";

export function newSceneId(initialScenes:SceneType[], additionalScenes:SceneType[]):number {
  if (additionalScenes.length > 0) {
    return additionalScenes[additionalScenes.length - 1].id + 1;
  }
  if (initialScenes.length > 0) {
    return initialScenes[initialScenes.length - 1].id + 1;
  }
  return 1;
}

export function lastScene(scenes:SceneType[]):SceneType {
  return scenes[scenes.length - 1];
}