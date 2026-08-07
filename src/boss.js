import * as THREE from 'three'
import { BOSS_ISLAND, groundY } from './world.js'

/** Boss island lock + Kaido fight AI / HUD. */

function shortestAngle(from, to) {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function createBossController(api) {
  function refreshBossHud() {
    const seaKing = api.getSeaKing()
    const activeBoss = seaKing?.visible && seaKing.userData.alive
    api.bossHud.classList.toggle('boss-hud-visible', !!activeBoss)
    if (!activeBoss) return
    const pct = THREE.MathUtils.clamp(seaKing.userData.hp / seaKing.userData.maxHp, 0, 1)
    api.bossBarFill.style.width = `${pct * 100}%`
    api.bossHud.classList.toggle('boss-phase-rage', pct < 0.45)
  }

  function enforceBossLock(obj) {
    if (api.quest.bossUnlocked) return
    const dx = obj.position.x - BOSS_ISLAND.x
    const dz = obj.position.z - BOSS_ISLAND.z
    const dist = Math.hypot(dx, dz)
    const limit = BOSS_ISLAND.r + 4
    if (dist < limit) {
      const s = limit / (dist || 0.01)
      obj.position.x = BOSS_ISLAND.x + dx * s
      obj.position.z = BOSS_ISLAND.z + dz * s
      if (obj === api.getPlayer() && !api.isStatusBusy()) {
        api.setStatus('Boss Island sealed — open 3 chests first')
      }
    }
  }

  function updateBossFight(delta, t) {
    const seaKing = api.getSeaKing()
    const bossShockwave = api.bossShockwave
    const bossBreath = api.bossBreath
    const tmp = api.tmp

    if (!seaKing?.visible) {
      bossShockwave.visible = false
      bossBreath.visible = false
      refreshBossHud()
      return
    }

    const boss = seaKing
    const data = boss.userData
    data.cooldown = Math.max(0, (data.cooldown || 0) - delta)
    data.attackT = Math.max(0, (data.attackT || 0) - delta)
    data.invuln = Math.max(0, (data.invuln || 0) - delta)
    data.hitFlash = Math.max(0, (data.hitFlash || 0) - delta)
    refreshBossHud()

    if (!data.alive) {
      boss.rotation.z = THREE.MathUtils.lerp(boss.rotation.z, -1.35, 1 - Math.exp(-3 * delta))
      boss.position.y = Math.max(groundY(boss.position.x, boss.position.z), boss.position.y - delta * 0.8)
      if (boss.rotation.z < -1.26) boss.visible = false
      bossBreath.visible = false
      bossShockwave.visible = false
      return
    }

    const player = api.getPlayer()
    const aggro =
      !api.getSpectating() &&
      !api.isIntroActive() &&
      !api.getOnShip() &&
      api.quest.bossUnlocked &&
      player.position.distanceTo(boss.position) < 34

    const rage = data.hp / data.maxHp < 0.45
    const moveSpeed = rage ? 4.4 : 3.1
    const dx = player.position.x - boss.position.x
    const dz = player.position.z - boss.position.z
    const dist = Math.hypot(dx, dz)
    const targetYaw = Math.atan2(dx, dz)
    boss.rotation.y += shortestAngle(boss.rotation.y, targetYaw) * (1 - Math.exp(-4 * delta))

    const pulse = 0.45 + Math.sin(t * (rage ? 9 : 6)) * 0.18
    data.chest.material.emissiveIntensity = 0.18 + data.hitFlash * 1.8 + pulse * 0.25

    if (!aggro) {
      boss.position.x += (data.home.x - boss.position.x) * Math.min(1, delta * 0.7)
      boss.position.z += (data.home.z - boss.position.z) * Math.min(1, delta * 0.7)
      data.phase = 'idle'
      data.armR.rotation.x += (0 - data.armR.rotation.x) * (1 - Math.exp(-5 * delta))
      data.armR.rotation.z += (0.15 - data.armR.rotation.z) * (1 - Math.exp(-5 * delta))
      bossBreath.visible = false
      bossShockwave.visible = false
      return
    }

    if (data.phase === 'idle' && data.cooldown <= 0) {
      if (dist < 5.2) {
        data.phase = 'swing'
        data.attackT = rage ? 0.82 : 0.95
        data.didHit = false
        api.setStatus('Kaido winds up Thunder Bagua!')
      } else if (dist < 16) {
        data.phase = 'breath'
        data.attackT = rage ? 1.35 : 1.55
        data.didHit = false
        bossBreath.visible = true
        bossBreath.material.opacity = 0.88
        api.setStatus('Kaido charges Boro Breath!')
      } else {
        data.cooldown = 0.2
      }
    }

    if (data.phase === 'idle' && dist > 4.3) {
      boss.position.x += Math.sin(boss.rotation.y) * moveSpeed * delta
      boss.position.z += Math.cos(boss.rotation.y) * moveSpeed * delta
    } else if (data.phase === 'swing') {
      const p = 1 - data.attackT / (rage ? 0.82 : 0.95)
      if (p < 0.45) {
        data.armR.rotation.x = -0.8 - p * 2.8
        data.armR.rotation.z = 0.35
      } else {
        data.armR.rotation.x = -2.05 + (p - 0.45) * 5.9
        data.armR.rotation.z = -0.15
        if (!bossShockwave.userData.active) {
          bossShockwave.visible = true
          bossShockwave.material.opacity = 0.85
          bossShockwave.position.set(boss.position.x, groundY(boss.position.x, boss.position.z) + 0.12, boss.position.z)
          bossShockwave.userData = { t: 0, active: true, didHit: false, radius: 2.2 }
        }
        if (!data.didHit && dist < 5.7) {
          api.damagePlayer(rage ? 22 : 16, 'Thunder Bagua!', boss.position)
          data.didHit = true
        }
      }
      if (data.attackT <= 0) {
        data.phase = 'idle'
        data.cooldown = rage ? 1.15 : 1.6
      }
    } else if (data.phase === 'breath') {
      const mouth = data.head.position.clone().applyMatrix4(boss.matrixWorld)
      const dir = tmp.copy(player.position).sub(mouth).setY(0.2).normalize()
      bossBreath.visible = true
      bossBreath.userData.active = true
      bossBreath.userData.dir.copy(dir)
      const len = THREE.MathUtils.clamp(dist, 6, 15)
      bossBreath.userData.len = len
      bossBreath.scale.set(1, len, 1)
      bossBreath.position.copy(mouth).addScaledVector(dir, len * 0.5)
      bossBreath.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      bossBreath.material.opacity = rage ? 0.92 : 0.8
      if (!data.didHit && data.attackT < (rage ? 0.82 : 0.95)) {
        const toPlayer = player.position.clone().sub(mouth)
        const along = toPlayer.dot(dir)
        const lateral = toPlayer.clone().sub(dir.clone().multiplyScalar(along)).length()
        if (along > 0 && along < len + 1 && lateral < 1.9) {
          api.damagePlayer(rage ? 18 : 12, 'Boro Breath scorched you!', mouth)
        }
        data.didHit = true
      }
      if (data.attackT <= 0) {
        data.phase = 'idle'
        data.cooldown = rage ? 1.0 : 1.45
        bossBreath.visible = false
        bossBreath.userData.active = false
      }
    }

    if (bossShockwave.userData.active) {
      bossShockwave.userData.t += delta
      bossShockwave.userData.radius += (rage ? 9 : 7) * delta
      bossShockwave.scale.setScalar(bossShockwave.userData.radius)
      bossShockwave.material.opacity = Math.max(0, 0.85 - bossShockwave.userData.t * 1.6)
      if (
        !bossShockwave.userData.didHit &&
        player.position.distanceTo(bossShockwave.position) < bossShockwave.userData.radius + 1.3
      ) {
        api.damagePlayer(rage ? 10 : 7, 'Shockwave clipped you!', boss.position)
        bossShockwave.userData.didHit = true
      }
      if (bossShockwave.userData.t > 0.6) {
        bossShockwave.visible = false
        bossShockwave.userData.active = false
      }
    }

    if (!bossBreath.visible) {
      bossBreath.material.opacity = 0
    }
  }

  return { enforceBossLock, updateBossFight, refreshBossHud }
}
