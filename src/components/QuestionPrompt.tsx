import type { PlayQuestion } from '../types'
import { FlagArt } from './FlagArt'

type Props = {
  question: PlayQuestion
  heading?: 'h1' | 'h2'
}

export function QuestionPrompt({ question, heading = 'h1' }: Props) {
  const Heading = heading
  return (
    <>
      {question.flagCode ? <FlagArt code={question.flagCode} /> : null}
      <Heading>{question.prompt}</Heading>
    </>
  )
}
