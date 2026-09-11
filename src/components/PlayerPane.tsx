import { DIFFICULTY_LABEL } from '../lib/game'
import type { PlayQuestion } from '../types'
import { QuestionPrompt } from './QuestionPrompt'

type Props = {
  name: string
  tag: string
  score: number
  question: PlayQuestion
  picked: number | null
  locked: boolean
  reveal: boolean
  interactive: boolean
  onChoose: (choiceIndex: number) => void
}

export function PlayerPane({
  name,
  tag,
  score,
  question,
  picked,
  locked,
  reveal,
  interactive,
  onChoose,
}: Props) {
  return (
    <section className="pane">
      <header className="pane-bar">
        <div>
          <strong>{name}</strong>
          <span>{tag}</span>
        </div>
        <p className="score">{score} pts</p>
      </header>
      <QuestionPrompt question={question} heading="h2" />
      <p className="q-diff">{DIFFICULTY_LABEL[question.difficulty]}</p>
      <ol className="choices pane-choices">
        {question.choices.map((choice, choiceIndex) => {
          let tone = ''
          if (reveal) {
            if (choiceIndex === question.correctIndex) tone = 'right'
            else if (choiceIndex === picked) tone = 'wrong'
          } else if (picked === choiceIndex) {
            tone = 'picked'
          }
          return (
            <li key={`${question.id}-${choice}`}>
              <button
                type="button"
                className={`choice ${tone}`}
                disabled={locked || !interactive}
                onClick={() => onChoose(choiceIndex)}
              >
                {choice}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
