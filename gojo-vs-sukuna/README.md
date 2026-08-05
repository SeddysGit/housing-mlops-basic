# Jujutsu Clash — Gojo vs Sukuna (3D Fighting Game)

A fan-made 3D arena fighter in the browser: **Satoru Gojo vs Ryomen Sukuna**, each with
their signature Jujutsu Kaisen kit — Infinity, Blue, Red, Hollow Purple, Unlimited Void,
Dismantle, Cleave, Fire Arrow, Malevolent Shrine, Black Flash, and Domain Clashes.

Built with plain JavaScript + [Three.js](https://threejs.org) (vendored, no build step,
no external assets — all models are procedural and all audio is synthesized with WebAudio).

## Play

Just open `index.html` in any modern desktop browser (double-click works — no server needed).

Pick **1 Player vs CPU** (Easy / Normal / Hard) or **2 Players** on one keyboard,
then choose your fighter. Best of 3 rounds, 99-second timer.

## Controls

| Action | Player 1 | Player 2 |
|---|---|---|
| Move | `W A S D` | Arrow keys |
| Jump | `Space` | `Right Shift` |
| Dash (i-frames) | `Left Shift` | `Right Ctrl` |
| Light attack (3-hit combo) | `J` | `,` |
| Heavy attack | `K` | `.` |
| Guard / **Infinity** | hold `L` | hold `/` |
| Skill 1 | `U` | `;` |
| Skill 2 | `I` | `'` |
| Skill 3 | `O` | `]` |
| Skill 4 (Sukuna: Piercing Blood) | `Y` | `\` |
| **Reverse Cursed Technique** (heal) | hold `N` | hold `[` |
| **Domain Expansion** | `P` | `Enter` |

`H` controls help · `M` mute · `Esc` pause · `R` rematch on the result screen.

## The kits

**Technique fusions**
- **Gojo**: cast **Blue then Red** (either order) within 3 seconds while both are live —
  they converge and detonate into a free, oversized **Hollow Purple**.
- **Sukuna**: cast **Dismantle then Cleave** (either order) within 3 seconds — the
  **World Cutting Slash** telegraphs a red line across the arena, then splits the world
  along it. Dash off the line to survive.

**Gojo — Limitless & Six Eyes**
- **Infinity** (hold guard): nothing reaches you — melee is halted, projectiles dissolve.
  Drains Cursed Energy; if it empties, your guard shatters.
- **Lapse: Blue** — a vortex at the enemy's position that drags them in and detonates.
- **Reversal: Red** — repulsive blast with huge knockback.
- **Hollow Purple** — long charge, then a massive piercing sphere that erases the lane.
- **Domain: Unlimited Void** — the world drops into the void; the enemy is overwhelmed
  by infinite information (stunned, damage over time — but Void never kills on its own).

**Sukuna — the King of Curses**
- **Guard**: blocks 85% of damage; chip damage can never KO you.
- **Dismantle** — a fan of three ranged slash waves.
- **Cleave** — up close: blink behind the target and flurry-slash; at range: one big slash wave.
- **Fire Arrow** — "Open." A fast flame arrow with an explosive blast radius.
- **Piercing Blood** — Blood Manipulation: a hypersonic blood beam that leaves the
  target bleeding (`Y`).
- **Domain: Malevolent Shrine** — a barrierless domain: slashes rain on everything inside
  the red ring. No shelter — run for the edge or eat the storm.

**Shared mechanics**
- **Cursed Energy (CE)**: a colossal 2000-point reserve (20× the original) with fast
  regeneration. Skills cost CE; the **gold mark (100)** unlocks your Domain Expansion.
- **Simple Domain**: hold guard while caught inside the enemy's Domain to project a
  barrier that negates the sure-hit (Void's stun, the Shrine's slashes) — for a steady
  CE price.
- **Reverse Cursed Technique**: hold the heal key to channel CE into health (~150 HP/s).
  You're rooted and vulnerable while channeling — any hit interrupts it.
- **Black Flash**: every melee hit has a chance to spark a Black Flash — 2.5× damage,
  time briefly distorts, and you gain bonus CE.
- **Domain Clash**: expand your domain while the enemy's is up (or mid-cast) and the
  stronger presence wins — loser takes a burst of damage and the winner's domain holds.
- Domain casts have super armor; big casts (Hollow Purple, Fire Arrow) can be interrupted
  by hitting the caster.

## Files

```
index.html        page, menus, HUD, styling
js/three.min.js   Three.js r147 (vendored)
js/audio.js       WebAudio-synthesized SFX + BGM loop
js/characters.js  procedural low-poly fighters + pose animation
js/game.js        engine: combat, abilities, domains, AI, camera, FX, rounds
```

*Fan project for fun — Jujutsu Kaisen and its characters belong to Gege Akutami / Shueisha.*
