/**
 * In-game user guide — what you can do in One Piece World.
 */
export function createUserGuide({ onResetProgress, onInstallApp } = {}) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'hud-guide'
  btn.title = 'Open user guide'
  btn.setAttribute('aria-expanded', 'false')
  btn.setAttribute('aria-controls', 'user-guide')
  btn.textContent = 'Guide'

  const panel = document.createElement('div')
  panel.id = 'user-guide'
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-labelledby', 'user-guide-title')
  panel.innerHTML = `
    <div class="guide-sheet">
      <div class="guide-head">
        <h2 id="user-guide-title">Captain’s Guide</h2>
        <button type="button" id="guide-close" aria-label="Close guide">×</button>
      </div>
      <nav class="guide-tabs" aria-label="Guide sections">
        <button type="button" class="guide-tab guide-tab-active" data-tab="basics">Basics</button>
        <button type="button" class="guide-tab" data-tab="mobile">Mobile</button>
        <button type="button" class="guide-tab" data-tab="crew">Crew</button>
        <button type="button" class="guide-tab" data-tab="ship">Ship</button>
        <button type="button" class="guide-tab" data-tab="quests">Quests</button>
        <button type="button" class="guide-tab" data-tab="zones">Zones</button>
        <button type="button" class="guide-tab" data-tab="install">Install</button>
        <button type="button" class="guide-tab" data-tab="tips">Tips</button>
      </nav>
      <div class="guide-body">
        <section class="guide-panel guide-panel-active" data-panel="basics">
          <h3>Movement & camera</h3>
          <ul>
            <li><kbd>WASD</kbd> — move (camera-relative)</li>
            <li><kbd>Shift</kbd> — run on land</li>
            <li><kbd>Space</kbd> — jump · surface while diving</li>
            <li>Drag on screen — look around</li>
            <li>Scroll / pinch — zoom</li>
            <li>Hold <kbd>W</kbd> near towers / cliffs — climb</li>
          </ul>
          <h3>Actions</h3>
          <ul>
            <li><kbd>F</kbd> — attack (or fire ship cannons)</li>
            <li><kbd>E</kbd> — interact (chests, cook, board, puzzles)</li>
            <li><kbd>X</kbd> — dive while swimming (watch your air)</li>
            <li><kbd>V</kbd> / right-click — Usopp sniper aim</li>
            <li><kbd>G</kbd> — Gear 5 (as Luffy)</li>
            <li><kbd>P</kbd> / Spec — spectator free-cam</li>
            <li>Day/Night button (top-right) — toggle lighting</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="mobile">
          <h3>On-screen controls</h3>
          <p>The virtual pad appears on phones / narrow screens.</p>
          <ul>
            <li><strong>Left stick</strong> — move / sail / climb (push up near a climb point)</li>
            <li><strong>A</strong> — attack / fire cannons</li>
            <li><strong>E</strong> — interact (chests, cook, board, ruins, braziers)</li>
            <li><strong>J</strong> — jump · tap again underwater to surface</li>
            <li><strong>⬇ Dive</strong> — <em>hold</em> while swimming to dive (same as <kbd>X</kbd>)</li>
            <li><strong>R</strong> — hold to run</li>
            <li><strong>G</strong> — Gear 5 (Luffy)</li>
            <li><strong>⇄</strong> — next crewmate</li>
            <li><strong>📣</strong> — call crew</li>
            <li><strong>👁</strong> — spectator mode</li>
          </ul>
          <h3>Touch camera</h3>
          <ul>
            <li>One-finger drag on the world — look around</li>
            <li>Pinch in / out — zoom</li>
            <li>Top bar: <strong>Guide</strong>, Info, Spec, Day/Night</li>
          </ul>
          <h3>Mobile tips</h3>
          <ul>
            <li>Hold <strong>⬇</strong> to stay underwater; release to surface / recover air</li>
            <li>In spectator: stick flies · J up · E (or ⬇) down</li>
            <li><strong>Add to Home Screen</strong> (Install tab) for a full-screen app</li>
            <li>Open <strong>Guide</strong> anytime if you forget a button</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="crew">
          <h3>Switch crew</h3>
          <ul>
            <li><kbd>1</kbd>–<kbd>0</kbd> — pick a Straw Hat</li>
            <li><kbd>[</kbd> <kbd>]</kbd> or <kbd>Q</kbd> <kbd>.</kbd> — cycle crew</li>
            <li><kbd>C</kbd> — call all crew to you</li>
          </ul>
          <h3>Who’s who</h3>
          <ul>
            <li><strong>Luffy</strong> — stretch punches · Gear 5</li>
            <li><strong>Zoro</strong> — multi-slash swordsman</li>
            <li><strong>Nami</strong> — rain &amp; lightning</li>
            <li><strong>Usopp</strong> — sniper zoom (<kbd>V</kbd>)</li>
            <li><strong>Sanji</strong> — kicks · cook station heals</li>
            <li><strong>Chopper</strong> — compact · good jumper</li>
            <li><strong>Robin</strong> — reach &amp; crowd control</li>
            <li><strong>Franky</strong> — heavy hits · tanky</li>
            <li><strong>Brook</strong> — fast · soulful strikes</li>
            <li><strong>Jinbe</strong> — strongest swimmer · cove beach chest</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="ship">
          <h3>Going Merry</h3>
          <ul>
            <li>Walk onto the deck · <kbd>E</kbd> to board / leave</li>
            <li><kbd>WASD</kbd> — sail while aboard</li>
            <li><kbd>F</kbd> — fire cannons</li>
            <li><kbd>H</kbd> — recall Merry to the pier (from shore)</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="quests">
          <h3>Main quest</h3>
          <ul>
            <li>Open <strong>3 chests</strong> to unlock Boss Island</li>
            <li>Defeat <strong>Kaido</strong> — then enjoy the victory ceremony</li>
          </ul>
          <p class="guide-note">Quest progress also shows in the Info panel.</p>
        </section>

        <section class="guide-panel" data-panel="zones">
          <h3>Desert ruins</h3>
          <p>West desert island — step on the entrance pad.</p>
          <ul>
            <li>Press runes in the glowing order</li>
            <li>Claim the rare chest · green pad exits</li>
          </ul>
          <h3>Winter braziers</h3>
          <p>North winter island — ice is slippery.</p>
          <ul>
            <li>Short steps — ice makes you slide</li>
            <li>Light <strong>3 braziers in order</strong> (<kbd>E</kbd>)</li>
            <li>Ice softens and a rare chest appears</li>
          </ul>
          <h3>Sky wind pads</h3>
          <p>Sky island (climb the plateau).</p>
          <ul>
            <li>Step on glowing blue pads for <strong>updrafts</strong></li>
            <li>Chain pads to hop around the clouds</li>
          </ul>
          <h3>Cove chest</h3>
          <p>NE shore of the main island — look for the cyan ring.</p>
          <ul>
            <li>Chest is on the <strong>beach</strong> (no diving)</li>
            <li>Walk up and press <kbd>E</kbd></li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="install">
          <h3>Install as an app</h3>
          <p>Browser tabs steal keys (Ctrl shortcuts, refresh, zoom). Install once on desktop or phone and play fullscreen like a normal app.</p>
          <ul>
            <li><strong>Chrome / Edge (desktop)</strong> — address-bar install icon, or the button below when it appears</li>
            <li><strong>Android Chrome</strong> — menu → <em>Install app</em> / <em>Add to Home screen</em></li>
            <li><strong>iPhone / iPad Safari</strong> — Share → <em>Add to Home Screen</em></li>
          </ul>
          <p class="guide-note">Same save data as the browser tab. Load once online; later visits can work offline.</p>
          <button type="button" id="guide-install-app" class="guide-install-btn" hidden>
            Install One Piece World
          </button>
          <p id="guide-install-status" class="guide-note"></p>
        </section>

        <section class="guide-panel" data-panel="tips">
          <h3>Audio</h3>
          <ul>
            <li><kbd>M</kbd> or Info → <strong>Audio</strong> — mute / unmute</li>
            <li>Explore &amp; boss beds play automatically (procedural — no files needed)</li>
            <li>Optional: drop loops in <code>public/audio/</code> as <code>explore.mp3</code>, <code>boss.mp3</code>, <code>victory.mp3</code> (ogg/wav also work)</li>
            <li>Don’t use One Piece OST files — those are copyrighted</li>
          </ul>
          <h3>Combat &amp; survival</h3>
          <ul>
            <li>Kaido telegraphs swings and breath — keep moving</li>
            <li>Under ~45% HP he enters a rage phase</li>
            <li>If you go down, you respawn at the pier</li>
            <li>Dive air empties slowly — release <kbd>X</kbd> / <strong>⬇</strong> to recover</li>
          </ul>
          <h3>Save progress</h3>
          <ul>
            <li>Progress saves automatically (chests, quest, bounty, berries, puzzles)</li>
            <li>Reload the page anytime — you’ll pick up where you left off</li>
            <li>Use <strong>Reset progress</strong> below to start fresh</li>
          </ul>
          <h3>Exploration</h3>
          <ul>
            <li>On-screen toast (bottom) shows attacks, rewards, and nearby prompts</li>
            <li>Spectator (<kbd>P</kbd>) — fly around and peek at crew</li>
            <li>See the <strong>Mobile</strong> tab for the full touch layout</li>
          </ul>
          <p class="guide-note">Fan learning project — not affiliated with One Piece / Toei / Shueisha.</p>
          <button type="button" id="guide-reset-progress" class="guide-reset-btn">Reset progress</button>
        </section>
      </div>
    </div>
  `

  const installBtn = panel.querySelector('#guide-install-app')
  const installStatus = panel.querySelector('#guide-install-status')

  function setInstallAvailable(available) {
    if (!installBtn) return
    installBtn.hidden = !available
    if (installStatus) {
      installStatus.textContent = available
        ? 'Your browser can install this game now.'
        : 'If the button is hidden: use your browser’s Install / Add to Home Screen menu (see above).'
    }
  }
  setInstallAvailable(false)

  function setOpen(open) {
    panel.hidden = !open
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    btn.classList.toggle('hud-guide-active', open)
    document.body.classList.toggle('guide-open', open)
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    setOpen(panel.hidden)
  })

  panel.querySelector('#guide-close').addEventListener('click', (e) => {
    e.stopPropagation()
    setOpen(false)
  })

  panel.addEventListener('click', (e) => {
    if (e.target === panel) setOpen(false)
  })

  panel.querySelectorAll('.guide-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = tab.dataset.tab
      panel.querySelectorAll('.guide-tab').forEach((t) => {
        t.classList.toggle('guide-tab-active', t === tab)
      })
      panel.querySelectorAll('.guide-panel').forEach((p) => {
        p.classList.toggle('guide-panel-active', p.dataset.panel === id)
      })
    })
  })

  panel.querySelector('#guide-reset-progress')?.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!confirm('Reset all saved progress and reload?')) return
    onResetProgress?.()
  })

  installBtn?.addEventListener('click', async (e) => {
    e.stopPropagation()
    const result = await onInstallApp?.()
    if (result?.ok) {
      if (installStatus) {
        installStatus.textContent = 'Installed — open it from your home screen / apps list.'
      }
      setInstallAvailable(false)
    } else if (result?.reason === 'dismissed') {
      if (installStatus) installStatus.textContent = 'Install canceled — you can try again anytime.'
    } else if (installStatus) {
      installStatus.textContent =
        'Install prompt not available here. Use your browser menu: Install app / Add to Home Screen.'
    }
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false)
    }
  })

  return {
    btn,
    panel,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => !panel.hidden,
    setInstallAvailable,
  }
}
