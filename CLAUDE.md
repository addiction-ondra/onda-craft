# CLAUDE.md – pravidla vývoje Ondra a Laura Craft

Hra pro čtyřleté dítě. Každá změna se posuzuje otázkou: **„Zvládne to samo
čtyřleté dítě na iPadu, bez čtení a bez frustrace?“**

## Příkazy

```bash
npm install          # závislosti
npm run dev          # vývojový server (http://localhost:5173)
npm run build        # typecheck + produkční build do dist/
npm run preview      # náhled buildu (včetně service workeru)
npm test             # unit testy (Vitest)
npm run test:e2e     # smoke test v Chromiu (Playwright) – vyžaduje build
npm run lint         # tsc --noEmit
```

Před commitem vždy: `npm run lint && npm test && npm run build`.

## Architektura (podrobně v PLAN.md)

- `src/game/` – **čistá logika**. Nesmí importovat `three`, React ani DOM API
  (výjimka: `storage.ts` přes injektovaný `Storage`). Vše zde má unit testy.
- `src/render/` – jediné místo, kde se používá Three.js.
- `src/controller/GameController.ts` – jediný „mozek“, který propojuje vstup,
  logiku, render, zvuk a ukládání. React s ním mluví přes `subscribe/getSnapshot`.
- `src/ui/` – React komponenty bez herní logiky.
- `src/i18n/cs.ts` – **všechny** texty a hlášky. Žádné řetězce natvrdo v komponentách.

## Pravidla obsahu (nepřekročitelná)

- Žádné příšery, násilí, zbraně, umírání, ztráta životů, časový stres, odpočty.
- Žádné nákupy, reklamy, registrace, analytika, externí API ani síťové požadavky
  (kromě statických souborů aplikace).
- Žádné originální Minecraft assety, názvy bloků, zvuky ani loga. Textury se
  generují v `render/textures.ts`.
- Žádné návykové mechaniky: denní odměny, série (streaky), náhodné odměny,
  žebříčky, notifikace.
- Chyba se nikdy netrestá – jen jemná nápověda („Zkus…“). Odměny jen pozitivní.

## Pravidla UX pro předškoláky

- Dotykové cíle ≥ 64 px (minimálně 56 px na malém iPhonu).
- Minimum textu; každý pokyn musí jít i hlasem a ikonou.
- Rodičovské funkce jen za rodičovskou bránou (`ParentGate`).
- Destruktivní akce (reset světa) jen v rodičovské zóně a s potvrzením.
  Výjimka (přání rodiče): „Prázdná louka“ je i v menu Stavitele – s velkým obrázkovým
  potvrzením ✔/✖ a hlasem, protože ve výchozím světě není na šablony místo.
- Režimy vpravo: panáček (chození, výchozí po spuštění), kladivo (stavění z kostek),
  hrad (Stavitel). Mise přepnou na kladivo samy.
- Respektovat `safe-area-inset-*`, zakázat zoom stránky, long-press menu a výběr textu.
- Nová mise musí mít: úvodní ukázku, hlasový úvod, průběh, nápovědu, oslavu.

## Konvence kódu

- TypeScript `strict`. Žádné `any` bez komentáře proč.
- Souřadnice kostek jako `Vec3 = { x, y, z }`, klíč v mapě `"x,y,z"` (`keyOf`).
- Nové typy kostek přidávej do `BLOCKS` v `blocks.ts` a textury do `textures.ts`;
  index typu se ukládá do LocalStorage – **nikdy neměň pořadí existujících**, jen přidávej na konec.
- Změna formátu uložených dat ⇒ zvýšit `SAVE_VERSION` a doplnit migraci v `storage.ts`.
- Nové mise: přidat do `MISSIONS` v `missions.ts` (čistý reducer), texty do `cs.ts`,
  ukázku do `ui/MissionDemo.tsx`, testy do `missions.test.ts`.
- Postavičky chodí jen po cestě z `findPath` (žádné teleporty ani lezení po zdech).
  Stavby ve výchozím světě musí jít vidět a „ťuknout“ z kamery (45°) – vysoké zdi
  kolem malého prostoru ho schovají; ověř smoke testem.
- Svítící místa (ghosty z `effects.setGhosts`) jsou klikací: ťuknutí položí kostku přímo do nich
  (i „ve vzduchu“). Když je cíl mise schovaný za hradem, natoč na něj kameru (`view.focusOn`).
- Nová šablona Stavitele: `game/templates.ts` (max ~30 kostek, `entrance` musí vést na pevnou zem),
  název a hlas do `cs.ts` (`builder`), emoji do `ui/Overlays.tsx` a `ui/Hud.tsx`.
- Nová úloha do beden s otazníkem: rozšířit `quiz.ts` (data), `cs.ts` (hlas) a `ui/QuizOverlay.tsx`.
- Výkon: kostky jen přes `InstancedMesh`, žádné stíny, `pixelRatio ≤ 2`, render
  jen když je něco „dirty“ nebo běží animace.
