/** Berry / barrel / fruit pickups and attack hit helpers. */

export function createCollectibles(api) {
  function damageMul() {
    let m = 1
    const fruitBuff = api.getFruitBuff()
    if (fruitBuff?.buff === 'stretch' || fruitBuff?.buff === 'bloom') m *= 1.5
    if (fruitBuff?.buff === 'charm') m *= 1.25
    if (api.getActive() === 'luffy' && api.getCharacters().luffy.userData.gear5) m *= 1.4
    const cookBuff = api.getCookBuff()
    if (cookBuff) m *= cookBuff.mul
    return m
  }

  function hitBarrels(origin, range, damage) {
    let hit = false
    const dmg = damage * damageMul()
    const clock = api.getClock()
    for (const barrel of api.getBarrels()) {
      if (!barrel.visible || barrel.userData.hp <= 0) continue
      if (origin.distanceTo(barrel.position) > range) continue
      barrel.userData.hp -= dmg
      barrel.scale.y = 0.5 + 0.5 * (barrel.userData.hp / barrel.userData.maxHp)
      barrel.rotation.z += (Math.random() - 0.5) * 0.4
      hit = true
      if (barrel.userData.hp <= 0) {
        barrel.visible = false
        barrel.userData.respawnAt = clock.elapsedTime + 28 + Math.random() * 12
        api.setBarrelsSmashed(api.getBarrelsSmashed() + 1)
        api.setBerryCount(api.getBerryCount() + 1)
        api.addBounty(150_000)
        api.refreshStats()
        api.sfx.smash()
        api.setStatus('Barrel smashed! +1 Berry')
        setTimeout(() => api.setStatus(''), 900)
      }
    }
    // Kaido boss
    const seaKing = api.getSeaKing()
    if (
      seaKing?.visible &&
      seaKing.userData.alive &&
      origin.distanceTo(seaKing.position) < range + 2.5
    ) {
      if (seaKing.userData.invuln > 0) return hit
      seaKing.userData.hp -= dmg
      seaKing.rotation.y += 0.12
      seaKing.userData.hitFlash = 0.2
      seaKing.userData.invuln = 0.08
      hit = true
      api.refreshBossHud()
      api.setStatus(`Kaido HP ${Math.max(0, Math.ceil(seaKing.userData.hp))}`)
      if (seaKing.userData.hp <= 0) {
        seaKing.userData.alive = false
        seaKing.userData.phase = 'downed'
        api.setBerryCount(api.getBerryCount() + 25)
        api.refreshStats()
        api.refreshBossHud()
        api.sfx.smash()
        api.quest.onBossDefeated()
        api.persistProgress()
      }
    }
    return hit
  }

  function updateBerries(t) {
    const player = api.getPlayer()
    for (const berry of api.getBerries()) {
      // Respawn
      if (berry.userData.taken && berry.userData.respawnAt && t >= berry.userData.respawnAt) {
        berry.userData.taken = false
        berry.visible = true
        berry.position.x = berry.userData.homeX
        berry.position.z = berry.userData.homeZ
        berry.userData.respawnAt = 0
      }
      if (berry.userData.taken) continue
      berry.rotation.y = t * 2 + berry.userData.spin
      berry.position.y =
        api.groundY(berry.position.x, berry.position.z) +
        0.9 +
        Math.sin(t * 3 + berry.userData.spin) * 0.15

      if (!api.getOnShip() && player.position.distanceTo(berry.position) < 1.4) {
        berry.userData.taken = true
        berry.visible = false
        berry.userData.respawnAt = t + 22 + Math.random() * 10
        const berryCount = api.getBerryCount() + 1
        api.setBerryCount(berryCount)
        api.addBounty(25_000)
        api.refreshStats()
        api.sfx.berry()
        api.setStatus(`Berry +1  (total ${berryCount})`)
        setTimeout(() => api.setStatus(''), 700)
        api.persistProgress()
      }
    }
  }

  function updateBarrelRespawn(t) {
    for (const barrel of api.getBarrels()) {
      if (
        !barrel.visible &&
        barrel.userData.respawnAt &&
        t >= barrel.userData.respawnAt
      ) {
        barrel.visible = true
        barrel.userData.hp = barrel.userData.maxHp
        barrel.scale.set(1, 1, 1)
        barrel.rotation.z = 0
        barrel.position.x = barrel.userData.homeX
        barrel.position.z = barrel.userData.homeZ
        barrel.position.y = api.groundY(barrel.userData.homeX, barrel.userData.homeZ) + 0.5
        barrel.userData.respawnAt = 0
      }
    }
    const meat = api.getMeat()
    if (meat?.userData.taken && meat.userData.respawnAt && t >= meat.userData.respawnAt) {
      meat.userData.taken = false
      meat.visible = true
      meat.userData.respawnAt = 0
    }
  }

  function updateFruits(t) {
    const player = api.getPlayer()
    for (const fruit of api.getFruits()) {
      if (fruit.userData.taken) continue
      fruit.rotation.y = t * 1.5 + fruit.userData.spin
      fruit.position.y =
        api.groundY(fruit.position.x, fruit.position.z) +
        0.85 +
        Math.sin(t * 2.5 + fruit.userData.spin) * 0.12

      if (!api.getOnShip() && player.position.distanceTo(fruit.position) < 1.6) {
        fruit.userData.taken = true
        fruit.visible = false
        api.setFruitBuff({
          buff: fruit.userData.buff,
          label: fruit.userData.label,
          until: t + 25,
        })
        // Devil Fruit users can't swim well — unless Jinbe
        if (api.getActive() !== 'jinbe') {
          api.setStatus(`${fruit.userData.label}! Buff 25s — careful in water`)
        } else {
          api.setStatus(`${fruit.userData.label}! Buff 25s`)
        }
        api.sfx.fruit()
        api.refreshStats()
        setTimeout(() => api.setStatus(''), 2000)
      }
    }
    const fruitBuff = api.getFruitBuff()
    if (fruitBuff && t > fruitBuff.until) {
      api.setFruitBuff(null)
      api.refreshStats()
      api.setStatus('Devil Fruit power faded')
      setTimeout(() => api.setStatus(''), 1200)
    }
  }

  return { updateBerries, updateBarrelRespawn, updateFruits, damageMul, hitBarrels }
}
