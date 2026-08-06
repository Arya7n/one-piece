/**
 * In-game user guide — what you can do in Grand Line Archipelago.
 */
export function createUserGuide({ onResetProgress } = {}) {
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
            <li><kbd>Ctrl</kbd> — dive while swimming (watch your air)</li>
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
            <li><strong>⬇ Dive</strong> — <em>hold</em> while swimming to dive (same as Ctrl)</li>
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
            <li>Open <strong>Guide</strong> anytime if you forget a button</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="crew">
          <h3>Switch crew</h3>
          <ul>
            <li><kbd>1</kbd>–<kbd>0</kbd> — pick a Straw Hat</li>
            <li><kbd>[</kbd> <kbd>]</kbd> or <kbd>Q</kbd> <kbd>.</kbd> — cycle crew</li>
            <li>Tap a name chip in Info — same thing</li>
            <li><kbd>C</kbd> — call everyone to you</li>
          </ul>
          <h3>Who does what</h3>
          <ul>
            <li><strong>Luffy</strong> — rubber punches · Gear 5</li>
            <li><strong>Zoro</strong> — sword slashes (sometimes gets lost)</li>
            <li><strong>Nami</strong> — Clima-Tact rain &amp; lightning</li>
            <li><strong>Usopp</strong> — pellets · sniper zoom</li>
            <li><strong>Sanji</strong> — kicks · best at the cook station</li>
            <li><strong>Chopper</strong> — heavy kicks</li>
            <li><strong>Robin</strong> — bloom strikes</li>
            <li><strong>Franky</strong> — Radical Beam</li>
            <li><strong>Brook</strong> — soul slash</li>
            <li><strong>Jinbe</strong> — strongest swimmer · cove beach chest</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="ship">
          <h3>Going Merry</h3>
          <ul>
            <li>Walk near the pier ship · <kbd>E</kbd> to board</li>
            <li><kbd>WASD</kbd> — sail &amp; steer</li>
            <li><kbd>F</kbd> — fire side cannons</li>
            <li><kbd>E</kbd> again — leave the ship</li>
            <li><kbd>H</kbd> — recall Merry to the pier (from shore)</li>
            <li><kbd>C</kbd> first if you want the whole crew aboard</li>
          </ul>
        </section>

        <section class="guide-panel" data-panel="quests">
          <h3>Main quest</h3>
          <ol>
            <li>Open <strong>3 treasure chests</strong> around the islands</li>
            <li>Boss Island unlocks in the <strong>southwest</strong></li>
            <li>Sail there and defeat <strong>Kaido</strong></li>
          </ol>
          <h3>Collectibles</h3>
          <ul>
            <li><strong>Berries</strong> — gold coins (respawn)</li>
            <li><strong>Chests</strong> — <kbd>E</kbd> to open</li>
            <li><strong>Barrels</strong> — smash with attacks</li>
            <li><strong>Meat</strong> — heal HP</li>
            <li><strong>Devil Fruits</strong> — temporary buffs (weak in water)</li>
            <li><strong>Cook station</strong> — spend Berries for big heals (Sanji is better)</li>
          </ul>
          <p class="guide-note">Quest progress also shows in the Info panel.</p>
        </section>

        <section class="guide-panel" data-panel="zones">
          <h3>Desert ruins</h3>
          <p>West desert island — glowing stone arch.</p>
          <ul>
            <li><kbd>E</kbd> at the arch to enter</li>
            <li>Light <strong>3 runes in order</strong> (<kbd>E</kbd>)</li>
            <li>Wrong order resets — claim the rare chest, then green pad to exit</li>
          </ul>
          <h3>Winter ice</h3>
          <p>North winter island — slippery ice sheets.</p>
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

        <section class="guide-panel" data-panel="tips">
          <h3>Combat &amp; survival</h3>
          <ul>
            <li>Kaido telegraphs swings and breath — keep moving</li>
            <li>Under ~45% HP he enters a rage phase</li>
            <li>If you go down, you respawn at the pier</li>
            <li>Dive air empties slowly — release <kbd>Ctrl</kbd> / <strong>⬇</strong> to recover</li>
          </ul>
          <h3>Save progress</h3>
          <ul>
            <li>Progress saves automatically (chests, quest, bounty, berries, puzzles)</li>
            <li>Reload the page anytime — you’ll pick up where you left off</li>
            <li>Use <strong>Reset progress</strong> below to start fresh</li>
          </ul>
          <h3>Exploration</h3>
          <ul>
            <li>Status line (top bar) hints when you’re near something</li>
            <li>Spectator (<kbd>P</kbd>) — fly around and peek at crew</li>
            <li>See the <strong>Mobile</strong> tab for the full touch layout</li>
          </ul>
          <p class="guide-note">Fan learning project — not affiliated with One Piece / Toei / Shueisha.</p>
          <button type="button" id="guide-reset-progress" class="guide-reset-btn">Reset progress</button>
        </section>
      </div>
    </div>
  `

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
  }
}
