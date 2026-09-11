import type { CategoryId } from '../types'

type Props = {
  id: CategoryId | 'more'
}

export function TopicIcon({ id }: Props) {
  return (
    <svg className="topic-icon" viewBox="0 0 24 24" aria-hidden="true">
      {id === 'mix' ? (
        <path
          fill="currentColor"
          d="M7 3h4v8H7V3zm6 0h4v5h-4V3zM7 13h4v8H7v-8zm6 7h4v5h-4v-5zm0-9h4v7h-4V11z"
        />
      ) : null}
      {id === 'general' ? (
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 17.9V18h-2v1.9A8 8 0 0 1 4.1 13H6v-2H4.1A8 8 0 0 1 11 4.1V6h2V4.1A8 8 0 0 1 19.9 11H18v2h1.9A8 8 0 0 1 13 19.9z"
        />
      ) : null}
      {id === 'science' ? (
        <path
          fill="currentColor"
          d="M9 2h6v2h-1v6.6l5 7.5A2 2 0 0 1 17.4 22H6.6A2 2 0 0 1 5 18.1l5-7.5V4H9V2zm2 4v5.2L6.6 20h10.8L13 11.2V6h-2z"
        />
      ) : null}
      {id === 'history' ? (
        <path
          fill="currentColor"
          d="M13 3a9 9 0 1 0 8.5 12h-2.1A7 7 0 1 1 13 5v4l5-3-5-3V3z"
        />
      ) : null}
      {id === 'pop' ? (
        <path fill="currentColor" d="M8 5v14l12-7L8 5z" />
      ) : null}
      {id === 'math' ? (
        <path fill="currentColor" d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3z" />
      ) : null}
      {id === 'geography' ? (
        <path
          fill="currentColor"
          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
        />
      ) : null}
      {id === 'sports' ? (
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 2.1A8 8 0 0 0 4.2 11H7.4A12 12 0 0 1 11 4.1zm2 0A12 12 0 0 1 16.6 11h3.2A8 8 0 0 0 13 4.1zM4.2 13A8 8 0 0 0 11 19.9 12 12 0 0 1 7.4 13H4.2zm5.4 0A10 10 0 0 0 12 19.2 10 10 0 0 0 14.4 13H9.6zm6.8 0A12 12 0 0 1 13 19.9 8 8 0 0 0 19.8 13H16.6z"
        />
      ) : null}
      {id === 'flags' ? (
        <path
          fill="currentColor"
          d="M5 3h2v18H5V3zm3 1h11l-2.2 3.5L19 11H8V4z"
        />
      ) : null}
      {id === 'more' ? (
        <path fill="currentColor" d="M6 11h4v4H6v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
      ) : null}
    </svg>
  )
}
