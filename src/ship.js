import * as THREE from 'three'
import { updateCharacterAnim } from './characters.js'
import { applyTerrainOrSwim, groundY, WORLD } from './world.js'
import { sampleWaveHeight } from './water.js'

/** Going Merry boarding, sailing, cannons, lanterns. */

export function createShipController(api) {
  let shipTurnVel = 0

  function nearShip(player) {
    const ship = api.ship
    ship.updateMatrixWorld(true)
    const deck = new THREE.Vector3()
    ship.userData.seatLuffy.getWorldPosition(deck)
    return (
      player.position.distanceTo(deck) < 11 ||
      player.position.distanceTo(ship.position) < 10
    )
  }

  function recallShipHome() {
    if (api.getSpectating()) return
    if (api.getOnShip()) {
      api.setStatus('Leave the ship first (E), then recall')
      return
    }
    const ship = api.ship
    const home = ship.userData.home
    ship.position.set(home.x, 0.35, home.z)
    ship.rotation.set(0, home.rot, 0)
    ship.userData.speed = 0
    api.setStatus('Going Merry returned to the pier!')
    setTimeout(() => api.setStatus(''), 1600)
  }

  function boardShip() {
    if (api.getOnShip()) return
    const player = api.getPlayer()
    const ship = api.ship
    const characters = api.characters
    // Board active + anyone nearby (after a call / already close)
    const boarding = api.CREW_ORDER.filter((id) => {
      const c = characters[id]
      if (id === api.getActive()) return true
      return c.position.distanceTo(player.position) < 8 || c.position.distanceTo(ship.position) < 12
    })

    api.setOnShip(true)
    api.aboard.clear()
    api.sfx.board()

    // Boarding seats — slightly higher for new deck
    const seats = [
      [-1.2, 1.65, 0.5],
      [1.2, 1.65, 0.5],
      [-1.5, 1.65, -1.2],
      [1.5, 1.65, -1.2],
      [0, 1.65, -0.2],
      [-0.9, 1.65, 1.8],
      [0.9, 1.65, 1.8],
      [-1.6, 1.65, -2.2],
      [1.6, 1.65, -2.2],
      [0, 1.65, -3.0],
    ]

    boarding.forEach((id, i) => {
      const c = characters[id]
      c.userData.swimming = false
      c.userData.climbing = false
      c.userData.velY = 0
      c.userData.gathering = false
      if (c.userData.hips) c.userData.hips.rotation.x = 0
      ship.attach(c)
      const [x, y, z] = seats[i % seats.length]
      c.position.set(x, y, z)
      c.rotation.set(0, Math.PI, 0)
      api.aboard.add(id)
    })

    api.setGathering(false)
    ship.userData.speed = 0
    api.refreshActiveLabel()
    const leftBehind = api.CREW_ORDER.length - boarding.length
    api.setStatus(
      leftBehind
        ? `Aboard (${boarding.length})! ${leftBehind} left behind — Call (C) next time`
        : 'Full crew aboard! WASD sail · E leave',
    )
  }

  function leaveShip() {
    if (!api.getOnShip()) return
    api.setOnShip(false)
    const ship = api.ship
    ship.updateMatrixWorld(true)
    const exit = new THREE.Vector3()
    ship.getWorldPosition(exit)
    const side = new THREE.Vector3(
      Math.sin(ship.rotation.y + Math.PI),
      0,
      Math.cos(ship.rotation.y + Math.PI),
    )
    let i = 0
    for (const id of [...api.aboard]) {
      const c = api.characters[id]
      api.scene.attach(c)
      c.position
        .copy(exit)
        .addScaledVector(side, 5)
        .add(new THREE.Vector3((i % 5) * 0.7 - 1.4, 0, Math.floor(i / 5) * 0.8))
      applyTerrainOrSwim(c)
      c.userData.gathering = false
      c.userData.idleTarget = null
      c.userData.idleWait = 1 + Math.random() * 2
      i++
    }
    api.aboard.clear()
    ship.userData.speed = 0
    api.refreshActiveLabel()
    api.setStatus(
      api.getPlayer().userData.swimming
        ? 'Swimming! Shore or H to recall Merry'
        : 'Landed!',
    )
    setTimeout(() => api.setStatus(''), 2000)
  }

  function tryBoardToggle() {
    if (api.getOnShip()) {
      leaveShip()
      return
    }
    if (nearShip(api.getPlayer())) boardShip()
  }

  function fireShipCannon() {
    const ship = api.ship
    const cannonBall = api.cannonBall
    const data = ship.userData
    if (!data.cannons?.length || data.cannonCooldown > 0) return
    if (cannonBall.userData.active) return
    data.cannonCooldown = 0.85
    // Alternate sides
    data._cannonIdx = ((data._cannonIdx || 0) + 1) % data.cannons.length
    const c = data.cannons[data._cannonIdx]
    ship.updateMatrixWorld(true)
    c.muzzle.getWorldPosition(cannonBall.position)
    const side = c.side
    // Fire sideways relative to ship heading
    cannonBall.userData.dir
      .set(
        Math.sin(ship.rotation.y) * 0.15 + Math.cos(ship.rotation.y) * side,
        0.08,
        Math.cos(ship.rotation.y) * 0.15 - Math.sin(ship.rotation.y) * side,
      )
      .normalize()
    cannonBall.userData.t = 0
    cannonBall.userData.active = true
    cannonBall.visible = true
    api.sfx.cannon()
    api.setStatus('Fire!!!')
    setTimeout(() => api.setStatus(''), 600)
  }

  function updateShip(delta) {
    const ship = api.ship
    const keys = api.keys
    const pad = api.getPad()
    const data = ship.userData
    const t = api.clock.elapsedTime
    const mx = keys.w || pad.state.y > 0.3
    const ms = keys.s || pad.state.y < -0.3
    const ma = keys.a || pad.state.x < -0.3
    const md = keys.d || pad.state.x > 0.3

    const targetSpeed = mx ? 15 : ms ? -6.5 : 0
    data.speed += (targetSpeed - data.speed) * (1 - Math.exp(-(mx || ms ? 2.2 : 3.5) * delta))

    const turnTarget = (ma ? 1 : 0) + (md ? -1 : 0)
    shipTurnVel += (turnTarget * 1.05 - shipTurnVel) * (1 - Math.exp(-6 * delta))
    ship.rotation.y += shipTurnVel * delta

    // Merry's bow is local -Z (stern is +Z), so sail along -Z
    api.shipForward.set(-Math.sin(ship.rotation.y), 0, -Math.cos(ship.rotation.y))
    ship.position.addScaledVector(api.shipForward, data.speed * delta)

    const waveY = sampleWaveHeight(ship.position.x, ship.position.z, t)
    const waveYaw = sampleWaveHeight(ship.position.x + 1.2, ship.position.z, t)
    const waveRoll = sampleWaveHeight(ship.position.x, ship.position.z + 1.2, t)
    ship.position.y = 0.18 + waveY * 0.85
    ship.rotation.z = THREE.MathUtils.lerp(
      ship.rotation.z,
      (waveRoll - waveY) * 0.35 + Math.sin(t * 0.9) * 0.015,
      1 - Math.exp(-4 * delta),
    )
    ship.rotation.x = THREE.MathUtils.lerp(
      ship.rotation.x,
      (waveYaw - waveY) * 0.28 + Math.sin(t * 0.7) * 0.012,
      1 - Math.exp(-4 * delta),
    )

    const r = Math.hypot(ship.position.x, ship.position.z)
    if (r > WORLD.sailRadius) {
      ship.position.x *= WORLD.sailRadius / r
      ship.position.z *= WORLD.sailRadius / r
      data.speed *= -0.35
    }

    const landUnder = groundY(ship.position.x, ship.position.z)
    if (landUnder > 0.6) {
      ship.position.addScaledVector(api.shipForward, -data.speed * delta * 1.5)
      data.speed *= -0.4
      api.setStatus('Too shallow — steer back to open water')
    }

    if (data.cannonCooldown > 0) data.cannonCooldown -= delta

    for (const id of api.aboard) {
      updateCharacterAnim(api.characters[id], false, false, t, {
        delta,
        swimming: false,
      })
    }

    ship.updateMatrixWorld(true)
    api.enforceBossLock(ship)
    api.getPlayer().getWorldPosition(api.tmp)
    api.updateFollowCamera(api.tmp, delta, 1.6)
  }

  function updateLanterns(night) {
    const lights = api.ship.userData.lanternLights || []
    const intensity = night > 0.35 ? (night - 0.35) * 4.5 : 0
    for (const entry of lights) {
      entry.light.intensity = intensity
      if (entry.mesh?.material) {
        entry.mesh.material.emissiveIntensity = 0.35 + intensity * 0.4
      }
    }
  }

  return {
    nearShip,
    recallShipHome,
    boardShip,
    leaveShip,
    tryBoardToggle,
    fireShipCannon,
    updateShip,
    updateLanterns,
  }
}
