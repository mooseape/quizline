declare module 'nsfwjs' {
  export function load(url?: string): Promise<{
    classify(
      img: HTMLImageElement,
      topk?: number,
    ): Promise<{ className: string; probability: number }[]>
  }>
}
