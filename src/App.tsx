import { useState } from 'react'
import { DuelMatch } from './components/DuelMatch'
import { Home } from './components/Home'
import { Match } from './components/Match'
import { OpponentSelect } from './components/OpponentSelect'
import { Result } from './components/Result'
import { ThemeToggle } from './components/ThemeToggle'
import { bumpPlayStreak, saveBestScore, saveLastCategory, saveLastOpponent, getLastOpponent, getBestScore } from './lib/storage'
import type { Screen } from './types'
import './App.css'

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [matchKey, setMatchKey] = useState(0)

  let view = (
    <Home
      onPlay={(categoryId) => {
        saveLastCategory(categoryId)
        const opponent = getLastOpponent()
        saveLastOpponent(opponent)
        setScreen({ name: 'match', categoryId, opponent })
      }}
      onChallengeFriend={(categoryId) => {
        saveLastCategory(categoryId)
        saveLastOpponent({ kind: 'local' })
        setScreen({ name: 'match', categoryId, opponent: { kind: 'local' } })
      }}
      onChangeOpponent={(categoryId) => setScreen({ name: 'opponent', categoryId })}
    />
  )

  if (screen.name === 'opponent') {
    view = (
      <OpponentSelect
        categoryId={screen.categoryId}
        onBack={() => setScreen({ name: 'home' })}
        onStart={(opponent) => {
          saveLastOpponent(opponent)
          setScreen({ name: 'home' })
        }}
      />
    )
  } else if (screen.name === 'match') {
    if (screen.opponent.kind === 'solo') {
      view = (
        <Match
          key={`${screen.categoryId}-solo-${matchKey}`}
          categoryId={screen.categoryId}
          onQuit={() => setScreen({ name: 'home' })}
          onFinish={(score, correct) => {
            const previousBest = getBestScore(screen.categoryId)
            saveBestScore(screen.categoryId, score)
            bumpPlayStreak()
            setScreen({
              name: 'result',
              categoryId: screen.categoryId,
              opponent: screen.opponent,
              you: { score, correct },
              previousBest,
            })
          }}
        />
      )
    } else {
      view = (
        <DuelMatch
          key={`${screen.categoryId}-${matchKey}`}
          categoryId={screen.categoryId}
          opponent={screen.opponent}
          onQuit={() => setScreen({ name: 'home' })}
          onFinish={(you, them) => {
            const previousBest = getBestScore(screen.categoryId)
            saveBestScore(screen.categoryId, you.score)
            bumpPlayStreak()
            setScreen({
              name: 'result',
              categoryId: screen.categoryId,
              opponent: screen.opponent,
              you,
              them,
              previousBest,
            })
          }}
        />
      )
    }
  } else if (screen.name === 'result') {
    view = (
      <Result
        categoryId={screen.categoryId}
        opponent={screen.opponent}
        you={screen.you}
        them={screen.them}
        previousBest={screen.previousBest}
        onReplay={() => {
          setMatchKey((value) => value + 1)
          setScreen({
            name: 'match',
            categoryId: screen.categoryId,
            opponent: screen.opponent,
          })
        }}
        onHome={() => setScreen({ name: 'home' })}
      />
    )
  }

  const isHome = screen.name === 'home'

  return (
    <>
      {isHome ? null : <ThemeToggle />}
      {view}
    </>
  )
}

export default App
