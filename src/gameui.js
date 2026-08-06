/**
 * Quest tracker UI + state machine.
 * Beat 1: open 3 chests → unlock boss island
 * Beat 2: defeat the island boss
 */
export function createQuestSystem({ onUnlockBoss, onBossDefeated }) {
  const el = document.createElement('div')
  el.id = 'quest-log'
  el.innerHTML = `
    <strong>Quest</strong>
    <p id="quest-text"></p>
    <span id="quest-progress"></span>
  `
  document.body.appendChild(el)
  const textEl = el.querySelector('#quest-text')
  const progEl = el.querySelector('#quest-progress')
  const infoEl = document.querySelector('#quest-hint-line')

  let stage = 'chests' // chests | boss | done
  let chestsNeeded = 3
  let bossUnlocked = false
  let bossDefeated = false

  function refresh(chestsOpened = 0) {
    let text = ''
    let prog = ''
    if (stage === 'chests') {
      text = 'Raid the Grand Line — open treasure chests'
      prog = `Chests ${Math.min(chestsOpened, chestsNeeded)}/${chestsNeeded}`
    } else if (stage === 'boss') {
      text = 'Boss Island unlocked — defeat the Sea King!'
      prog = 'Sail SW to the red island'
    } else {
      text = 'Archipelago secured — King of the Pirates vibes'
      prog = 'All story beats complete'
      el.classList.add('quest-done')
      infoEl?.classList.add('quest-done')
    }
    textEl.textContent = text
    progEl.textContent = prog
    if (infoEl) {
      infoEl.textContent = `Quest: ${text} · ${prog}`
    }
  }

  refresh(0)

  return {
    el,
    get bossUnlocked() {
      return bossUnlocked
    },
    get stage() {
      return stage
    },
    getQuestTarget(bossPos) {
      if (stage === 'boss' && bossPos) return { x: bossPos.x, z: bossPos.z }
      return null
    },
    onChestOpened(chestsOpened) {
      refresh(chestsOpened)
      if (stage === 'chests' && chestsOpened >= chestsNeeded && !bossUnlocked) {
        bossUnlocked = true
        stage = 'boss'
        refresh(chestsOpened)
        onUnlockBoss?.()
        return true
      }
      return false
    },
    onBossDefeated() {
      if (stage !== 'boss') return
      bossDefeated = true
      stage = 'done'
      refresh()
      onBossDefeated?.()
    },
  }
}
