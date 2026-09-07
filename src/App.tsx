import { useEffect, useState } from 'react'
import { DuelMatch } from './components/DuelMatch'
import { FriendLobby } from './components/FriendLobby'
import { Home } from './components/Home'
import { Match } from './components/Match'
import { OpponentSelect } from './components/OpponentSelect'
import { Result } from './components/Result'
import { ThemeToggle } from './components/ThemeToggle'
import { formatInvite, makeInviteToken, parseJoinHash, playHash } from './lib/invite'
import { closeDuelRoom } from './lib/onlineDuel'
import { bumpPlayStreak, saveBestScore, saveLastCategory, saveLastOpponent, getLastOpponent, getBestScore } from './lib/storage'
import type { CategoryId, Screen } from './types'
import './App.css'

function initialScreen(): Screen {
  if (typeof window === 'undefined') return { name: 'home' }
  if (window.location.hash.startsWith('#preview-duel')) {
    return { name: 'match', categoryId: 'pop', opponent: { kind: 'bot', botId: 'lina' } }
  }
  const invite = parseJoinHash(window.location.hash)
  if (invite) return { name: 'lobby', categoryId: invite.categoryId, code: invite.code, role: 'guest' }
  return { name: 'home' }
}

function setPlayHash(code: string) {
  const next = `${window.location.pathname}${window.location.search}${playHash(code)}`
  history.replaceState(null, '', next)
}

function clearPlayHash() {
  if (!parseJoinHash(window.location.hash)) return
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}

function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [matchKey, setMatchKey] = useState(0)

  useEffect(() => {
    function onHash() {
      const invite = parseJoinHash(window.location.hash)
      if (!invite) return
      setScreen((current) => {
        if (current.name === 'lobby' && current.code === invite.code) return current
        if (current.name === 'match' && current.opponent.kind === 'online' && current.opponent.roomId === invite.code) {
          return current
        }
        return { name: 'lobby', categoryId: invite.categoryId, code: invite.code, role: 'guest' }
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function goHome() {
    closeDuelRoom()
    clearPlayHash()
    setScreen({ name: 'home' })
  }

  function startHostLobby(categoryId: CategoryId) {
    saveLastCategory(categoryId)
    const code = formatInvite(categoryId, makeInviteToken())
    setPlayHash(code)
    setScreen({ name: 'lobby', categoryId, code, role: 'host' })
  }

  function startGuestLobby(code: string, categoryId: CategoryId) {
    saveLastCategory(categoryId)
    setPlayHash(code)
    setScreen({ name: 'lobby', categoryId, code, role: 'guest' })
  }

  let view = (
    <Home
      onPlay={(categoryId) => {
        saveLastCategory(categoryId)
        const opponent = getLastOpponent()
        saveLastOpponent(opponent)
        setScreen({ name: 'match', categoryId, opponent })
      }}
      onChallengeFriend={startHostLobby}
      onJoinFriend={startGuestLobby}
      onChangeOpponent={(categoryId) => setScreen({ name: 'opponent', categoryId })}
    />
  )

  if (screen.name === 'opponent') {
    view = (
      <OpponentSelect
        categoryId={screen.categoryId}
        onBack={() => setScreen({ name: 'home' })}
        onStart={(opponent) => {
          if (opponent.kind === 'online') {
            startHostLobby(screen.categoryId)
            return
          }
          saveLastOpponent(opponent)
          setScreen({ name: 'home' })
        }}
      />
    )
  } else if (screen.name === 'lobby') {
    view = (
      <FriendLobby
        categoryId={screen.categoryId}
        code={screen.code}
        role={screen.role}
        onCancel={goHome}
        onReady={(friendName) => {
          setScreen({
            name: 'match',
            categoryId: screen.categoryId,
            opponent: {
              kind: 'online',
              roomId: screen.code,
              role: screen.role,
              friendName,
            },
          })
        }}
      />
    )
  } else if (screen.name === 'match') {
    if (screen.opponent.kind === 'solo') {
      view = (
        <Match
          key={`${screen.categoryId}-solo-${matchKey}`}
          categoryId={screen.categoryId}
          onQuit={goHome}
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
          key={`${screen.categoryId}-${matchKey}-${screen.opponent.kind === 'online' ? screen.opponent.roomId : 'local'}`}
          categoryId={screen.categoryId}
          opponent={screen.opponent}
          onQuit={goHome}
          onFinish={(you, them) => {
            closeDuelRoom()
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
          if (screen.opponent.kind === 'online') {
            startHostLobby(screen.categoryId)
            return
          }
          setMatchKey((value) => value + 1)
          setScreen({
            name: 'match',
            categoryId: screen.categoryId,
            opponent: screen.opponent,
          })
        }}
        onHome={goHome}
      />
    )
  }

  const isHome = screen.name === 'home'

  return (
    <>
      {isHome ? null : <ThemeToggle compact floating />}
      {view}
    </>
  )
}

export default App
