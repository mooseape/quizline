import { useEffect, useState } from 'react'
import { DuelMatch } from './components/DuelMatch'
import { FriendLobby } from './components/FriendLobby'
import { Home } from './components/Home'
import { Match } from './components/Match'
import { OpponentSelect } from './components/OpponentSelect'
import { PartyLobby } from './components/PartyLobby'
import { PartyMatch } from './components/PartyMatch'
import { PartyResult } from './components/PartyResult'
import { RandomQueue } from './components/RandomQueue'
import { Result } from './components/Result'
import { ThemeToggle } from './components/ThemeToggle'
import { formatInvite, makeInviteToken, parseJoinHash, parsePartyHash, partyHash, playHash } from './lib/invite'
import { closeDuelRoom, clearDuelHand, getDuelRoom, openDuelRoom } from './lib/onlineDuel'
import { closePartyRoom } from './lib/onlineParty'
import { recordRankedResult } from './lib/leaderboard'
import { saveDuelResult } from './lib/saveDuel'
import { handleOrYou } from './lib/handle'
import { saveBestScore, saveLastCategory, saveLastOpponent, getLastOpponent, getBestScore, getLastPace, saveLastPace } from './lib/storage'
import { titleForScreen } from './lib/seo'
import type { CategoryId, PaceMode, Screen } from './types'
import './App.css'

function initialScreen(): Screen {
  if (typeof window === 'undefined') return { name: 'home' }
  if (window.location.hash.startsWith('#preview-duel')) {
    return { name: 'match', categoryId: 'pop', opponent: { kind: 'bot', botId: 'lina' }, pace: 'rapid' }
  }
  const party = parsePartyHash(window.location.hash)
  if (party) {
    return { name: 'party-lobby', categoryId: party.categoryId, code: party.code, role: 'guest', pace: party.pace, round: 0 }
  }
  const invite = parseJoinHash(window.location.hash)
  if (invite) return { name: 'lobby', categoryId: invite.categoryId, code: invite.code, role: 'guest', pace: invite.pace, round: 0 }
  return { name: 'home' }
}

function setPlayHash(code: string) {
  const next = `${window.location.pathname}${window.location.search}${playHash(code)}`
  history.replaceState(null, '', next)
}

function setPartyHash(code: string) {
  const next = `${window.location.pathname}${window.location.search}${partyHash(code)}`
  history.replaceState(null, '', next)
}

function clearInviteHash() {
  if (!parseJoinHash(window.location.hash) && !parsePartyHash(window.location.hash)) return
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}

function isDuelScreen(screen: Screen, code: string) {
  if (screen.name === 'lobby' && screen.code === code) return true
  if (screen.name === 'match' && screen.opponent.kind === 'online' && screen.opponent.roomId === code) return true
  if (screen.name === 'result' && screen.opponent.kind === 'online' && screen.opponent.roomId === code) return true
  return false
}

function isPartyScreen(screen: Screen, code: string) {
  return (
    (screen.name === 'party-lobby' || screen.name === 'party-match' || screen.name === 'party-result') &&
    screen.code === code
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [matchKey, setMatchKey] = useState(0)

  useEffect(() => {
    document.title = titleForScreen(screen)
  }, [screen])

  useEffect(() => {
    function onHash() {
      const party = parsePartyHash(window.location.hash)
      if (party) {
        setScreen((current) => {
          if (isPartyScreen(current, party.code)) return current
          return {
            name: 'party-lobby',
            categoryId: party.categoryId,
            code: party.code,
            role: 'guest',
            pace: party.pace,
            round: 0,
          }
        })
        return
      }
      const invite = parseJoinHash(window.location.hash)
      if (!invite) return
      setScreen((current) => {
        if (isDuelScreen(current, invite.code)) return current
        return { name: 'lobby', categoryId: invite.categoryId, code: invite.code, role: 'guest', pace: invite.pace, round: 0 }
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function goHome() {
    closeDuelRoom()
    closePartyRoom()
    clearInviteHash()
    setScreen({ name: 'home' })
  }

  function startHostLobby(categoryId: CategoryId, pace: PaceMode) {
    saveLastCategory(categoryId)
    saveLastPace(pace)
    closePartyRoom()
    const code = formatInvite(categoryId, makeInviteToken(), pace)
    setPlayHash(code)
    setScreen({ name: 'lobby', categoryId, code, role: 'host', pace, round: 0 })
  }

  function startGuestLobby(code: string, categoryId: CategoryId, pace: PaceMode) {
    saveLastCategory(categoryId)
    saveLastPace(pace)
    closePartyRoom()
    setPlayHash(code)
    setScreen({ name: 'lobby', categoryId, code, role: 'guest', pace, round: 0 })
  }

  function startHostParty(categoryId: CategoryId, pace: PaceMode) {
    saveLastCategory(categoryId)
    saveLastPace(pace)
    closeDuelRoom()
    const code = formatInvite(categoryId, makeInviteToken(), pace, 'party')
    setPartyHash(code)
    setScreen({ name: 'party-lobby', categoryId, code, role: 'host', pace, round: 0 })
  }

  function startGuestParty(code: string, categoryId: CategoryId, pace: PaceMode) {
    saveLastCategory(categoryId)
    saveLastPace(pace)
    closeDuelRoom()
    setPartyHash(code)
    setScreen({ name: 'party-lobby', categoryId, code, role: 'guest', pace, round: 0 })
  }

  let view = (
    <Home
      onPlay={(categoryId, pace) => {
        saveLastCategory(categoryId)
        saveLastPace(pace)
        const opponent = getLastOpponent()
        saveLastOpponent(opponent)
        setScreen({ name: 'match', categoryId, opponent, pace })
      }}
      onChallengeFriend={startHostLobby}
      onJoinFriend={startGuestLobby}
      onParty={startHostParty}
      onJoinParty={startGuestParty}
      onPlayRandom={(categoryId, pace) => {
        saveLastCategory(categoryId)
        saveLastPace(pace)
        setScreen({ name: 'ranked-queue', categoryId, pace })
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
          if (opponent.kind === 'online') {
            startHostLobby(screen.categoryId, getLastPace())
            return
          }
          saveLastOpponent(opponent)
          setScreen({ name: 'home' })
        }}
      />
    )
  } else if (screen.name === 'ranked-queue') {
    view = (
      <RandomQueue
        categoryId={screen.categoryId}
        pace={screen.pace}
        onCancel={goHome}
        onMatched={(match) => {
          openDuelRoom(match.code)
          setPlayHash(match.code)
          setScreen({
            name: 'match',
            categoryId: match.categoryId,
            opponent: {
              kind: 'online',
              roomId: match.code,
              role: match.role,
              friendName: match.name,
              friendAvatar: match.avatar,
              friendPhoto: match.photo,
              friendFrame: match.frame,
              ranked: true,
              opponentId: match.opponentId,
            },
            pace: match.pace,
          })
        }}
      />
    )
  } else if (screen.name === 'lobby') {
    view = (
      <FriendLobby
        categoryId={screen.categoryId}
        code={screen.code}
        role={screen.role}
        pace={screen.pace}
        round={screen.round}
        onCancel={goHome}
        onSetup={(categoryId, pace) => {
          saveLastCategory(categoryId)
          saveLastPace(pace)
          setScreen((current) =>
            current.name === 'lobby' ? { ...current, categoryId, pace } : current,
          )
        }}
        onStart={(categoryId, pace, round, goAt, friendName, look) => {
          saveLastCategory(categoryId)
          saveLastPace(pace)
          setScreen({
            name: 'match',
            categoryId,
            opponent: {
              kind: 'online',
              roomId: screen.code,
              role: screen.role,
              friendName,
              friendAvatar: look?.avatar,
              friendPhoto: look?.photo,
              friendFrame: look?.frame,
            },
            pace,
            round,
            goAt,
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
          pace={screen.pace}
          onQuit={goHome}
          onFinish={(score, correct) => {
            const previousBest = getBestScore(screen.categoryId)
            saveBestScore(screen.categoryId, score)
            setScreen({
              name: 'result',
              categoryId: screen.categoryId,
              opponent: screen.opponent,
              you: { score, correct },
              previousBest,
              pace: screen.pace,
            })
          }}
        />
      )
    } else {
      view = (
        <DuelMatch
          key={`${screen.categoryId}-${matchKey}-${screen.opponent.kind === 'online' ? screen.opponent.roomId : 'local'}-r${screen.round ?? 0}`}
          categoryId={screen.categoryId}
          opponent={screen.opponent}
          pace={screen.pace}
          round={screen.round}
          goAt={screen.goAt}
          onQuit={() => {
            if (screen.opponent.kind === 'online' && screen.opponent.ranked) {
              goHome()
              return
            }
            if (screen.opponent.kind === 'online') {
              getDuelRoom()?.send({ t: 'lobby', round: (screen.round ?? 0) + 1 })
              clearDuelHand()
              setScreen({
                name: 'lobby',
                categoryId: screen.categoryId,
                code: screen.opponent.roomId,
                role: screen.opponent.role,
                pace: screen.pace,
                round: (screen.round ?? 0) + 1,
              })
              return
            }
            goHome()
          }}
          onLobby={() => {
            if (screen.opponent.kind !== 'online') return
            if (screen.opponent.ranked) {
              goHome()
              return
            }
            clearDuelHand()
            setScreen({
              name: 'lobby',
              categoryId: screen.categoryId,
              code: screen.opponent.roomId,
              role: screen.opponent.role,
              pace: screen.pace,
              round: (screen.round ?? 0) + 1,
            })
          }}
          onFinish={(you, them) => {
            clearDuelHand()
            if (screen.opponent.kind === 'online') {
              if (screen.opponent.ranked) {
                void recordRankedResult({
                  code: screen.opponent.roomId,
                  opponentId: screen.opponent.opponentId || getDuelRoom()?.friendId || '',
                  myScore: you.score,
                  theirScore: them.score,
                  categoryId: screen.categoryId,
                  pace: screen.pace,
                })
              }
              void saveDuelResult({
                code: screen.opponent.roomId,
                category_id: screen.categoryId,
                you_name: handleOrYou(),
                you_score: you.score,
                them_name: them.name,
                them_score: them.score,
              })
            }
            const previousBest = getBestScore(screen.categoryId)
            saveBestScore(screen.categoryId, you.score)
            setScreen({
              name: 'result',
              categoryId: screen.categoryId,
              opponent: screen.opponent,
              you,
              them,
              previousBest,
              pace: screen.pace,
              round: screen.round ?? 0,
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
        pace={screen.pace}
        onReplay={() => {
          setMatchKey((value) => value + 1)
          setScreen({
            name: 'match',
            categoryId: screen.categoryId,
            opponent: screen.opponent,
            pace: screen.pace,
          })
        }}
        onSameLobby={() => {
          if (screen.opponent.kind !== 'online') return
          if (screen.opponent.ranked) {
            setScreen({ name: 'ranked-queue', categoryId: screen.categoryId, pace: screen.pace })
            return
          }
          clearDuelHand()
          setScreen({
            name: 'lobby',
            categoryId: screen.categoryId,
            code: screen.opponent.roomId,
            role: screen.opponent.role,
            pace: screen.pace,
            round: (screen.round ?? 0) + 1,
          })
        }}
        onBegin={(categoryId, pace, round, goAt) => {
          if (screen.opponent.kind !== 'online') return
          saveLastCategory(categoryId)
          saveLastPace(pace)
          setScreen({
            name: 'match',
            categoryId,
            opponent: screen.opponent,
            pace,
            round,
            goAt,
          })
        }}
        onHome={goHome}
      />
    )
  } else if (screen.name === 'party-lobby') {
    view = (
      <PartyLobby
        categoryId={screen.categoryId}
        code={screen.code}
        role={screen.role}
        pace={screen.pace}
        round={screen.round}
        onCancel={goHome}
        onSetup={(categoryId, pace) => {
          saveLastCategory(categoryId)
          saveLastPace(pace)
          setScreen((current) =>
            current.name === 'party-lobby' ? { ...current, categoryId, pace } : current,
          )
        }}
        onStart={(players, round, goAt, categoryId, pace) => {
          setScreen({
            name: 'party-match',
            categoryId,
            code: screen.code,
            role: screen.role,
            pace,
            round,
            players,
            goAt,
          })
        }}
      />
    )
  } else if (screen.name === 'party-match') {
    view = (
      <PartyMatch
        key={`${screen.code}-${screen.round}`}
        categoryId={screen.categoryId}
        code={screen.code}
        role={screen.role}
        pace={screen.pace}
        round={screen.round}
        players={screen.players}
        goAt={screen.goAt}
        onQuit={() => {
          setScreen({
            name: 'party-lobby',
            categoryId: screen.categoryId,
            code: screen.code,
            role: screen.role,
            pace: screen.pace,
            round: screen.round + 1,
          })
        }}
        onFinish={(standings) => {
          setScreen({
            name: 'party-result',
            categoryId: screen.categoryId,
            code: screen.code,
            role: screen.role,
            pace: screen.pace,
            round: screen.round,
            standings,
          })
        }}
      />
    )
  } else if (screen.name === 'party-result') {
    view = (
      <PartyResult
        categoryId={screen.categoryId}
        code={screen.code}
        role={screen.role}
        pace={screen.pace}
        round={screen.round}
        standings={screen.standings}
        onLobby={() => {
          setScreen({
            name: 'party-lobby',
            categoryId: screen.categoryId,
            code: screen.code,
            role: screen.role,
            pace: screen.pace,
            round: screen.round + 1,
          })
        }}
        onBegin={(players, round, goAt, categoryId, pace) => {
          setScreen({
            name: 'party-match',
            categoryId: categoryId ?? screen.categoryId,
            code: screen.code,
            role: screen.role,
            pace: pace ?? screen.pace,
            round,
            players,
            goAt,
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
