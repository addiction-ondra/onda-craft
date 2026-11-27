# Ondra a Laura Craft – plán projektu

Vzdělávací 3D voxelová stavebnice pro předškoláky (cca 4 roky). Inspirováno
žánrem „kostičkových“ stavebnic, ale s vlastní grafikou, vlastními texturami
(generovanými kódem) a jednoduchým, bezpečným prostředím.

## 1. Cíle

| Cíl | Jak ho naplňujeme |
| --- | --- |
| Samostatnost | Ovládání bez čtení – ikony, barvy, hlas. Dítě si samo vybírá materiál i misi. |
| Kreativita | Volné stavění bez omezení, žádné „špatné“ stavby. |
| Prostorová představivost | 3D izometrický pohled, otáčení světa, stavění do výšky a přes řeku. |
| Logické myšlení | Mise s jasným cílem (most musí spojit oba břehy, počítání kostek). |
| Bezpečí | Žádné příšery, násilí, umírání, časový tlak, nákupy, reklamy, registrace, síť. |

## 2. Technologie

- **React 19 + TypeScript** – UI (palety, mise, nastavení).
- **Three.js** – 3D svět, `OrthographicCamera` v izometrickém úhlu, `InstancedMesh` na typ kostky.
- **Vite 8** – build, dev server.
- **vite-plugin-pwa (Workbox)** – service worker, manifest, offline režim.
- **LocalStorage** – automatické ukládání světa, misí a nastavení.
- **Web Speech API** (`speechSynthesis`, `cs-CZ`) – hlasové pokyny.
- **Web Audio API** – syntetizované, krátké a příjemné zvuky (žádné soubory).
- **Vitest** – unit testy herní logiky, **Playwright** – smoke test v prohlížeči.

## 3. Architektura

```
src/
├── main.tsx              vstup, registrace service workeru
├── App.tsx               skládá UI + GameController
├── i18n/cs.ts            VŠECHNY texty a hlasové hlášky (čeština)
├── game/                 ČISTÁ LOGIKA – bez DOM a Three.js, testovatelná
│   ├── blocks.ts         definice typů kostek (barvy, vlastnosti)
│   ├── world.ts          model světa 16×16×12, generování výchozího světa
│   ├── missions.ts       definice a vyhodnocování misí (reducer styl)
│   ├── pathfinding.ts    hledání cesty (BFS, schod max. 1 kostka, výška těla: děti 2, pejsek 1)
│   ├── quiz.ts           úkoly z beden s otazníkem (počítání, barvy, tvary, písmena)
│   ├── templates.ts      šablony Stavitele (hrad, domeček, farma), hledání volného místa
│   ├── rewards.ts        klíče k pokladu (1 za svět se všemi úkoly)
│   ├── characters.ts     postavičky Ondra a Laura, výchozí pozice
│   ├── settings.ts       rodičovské nastavení + výchozí hodnoty
│   └── storage.ts        serializace / LocalStorage s verzí formátu
├── audio/
│   ├── speech.ts         fronta hlasových pokynů, výběr českého hlasu
│   └── sfx.ts            syntetizované zvuky (pop, cink, melodie)
├── render/               VŠE, co sahá na Three.js
│   ├── textures.ts       procedurální pixelové textury (canvas)
│   ├── SceneView.ts      scéna, kamera, světla, instancované kostky, raycast
│   ├── animals.ts        zvířátka (pejsek Frený, ovečka, kuřátko)
│   └── effects.ts        částice, nápovědní „duchové“ kostky, majáčky
├── controller/
│   └── GameController.ts lepidlo: vstup → svět → mise → zvuk/hlas → uložení;
│                         poskytuje snapshot pro React (useSyncExternalStore)
└── ui/                   React komponenty (velká tlačítka, minimum textu)
```

### Tok dat

```
dotyk ─► SceneView.pick() ─► GameController.handleTap()
                                │
                                ├─► World.set/remove        (čistý model)
                                ├─► missions.reduce(event)  (čistá funkce)
                                ├─► sfx / speech            (zpětná vazba)
                                ├─► SceneView.markDirty()   (překreslení)
                                └─► storage.scheduleSave()  (debounce 400 ms)
React UI ◄── subscribe/getSnapshot ◄── GameController
```

### Souřadnice světa

- `x`, `z` ∈ ⟨0, 15⟩, `y` ∈ ⟨0, 11⟩. Vrstva `y = 0` je terén (tráva / voda) a **nelze ji odstranit** – svět nikdy nemá díry.
- Řeka teče po celé šířce v řádcích `z = 7` a `z = 8`.
- Most = pro nějaké `x` jsou pevné kostky na `(x, 1, 7)` i `(x, 1, 8)`.

## 4. Herní mechaniky (MVP)

- **Režim stavění** (ruka s „+“): ťuknutí na stěnu kostky přidá kostku vybraného materiálu vedle ní.
- **Režim gumy**: ťuknutí odstraní kostku (kromě terénu).
- **6 stavebních materiálů**: dřevo, kámen, červená, tráva, písek, modrá.
- Další (nestavitelné z palety) typy: kmen, listí, voda, zeď domečku, střecha.
- **Kamera**: tažení jedním prstem = otáčení, dvěma prsty = přiblížení, velká tlačítka ⟲ ⟳ ＋ －.
- **Zvířátka** (buldoček Frený, ovečka, kuřátko) chodí po světě, po ťuknutí poskočí a ozvou se.
- **Postavičky Ondra a Laura**: ťuknutí na postavičku (nebo její obličej nahoře) ji vybere,
  další ťuknutí do mapy = „jdi sem“. Cesta se hledá po zemi, přes most a bránou;
  vylézt umí o 1 kostku, seskočit až ze 3. Když cíl není dosažitelný, dojde co nejblíž
  a poradí „Postav mi schody nebo most!“. Pozice se ukládají.
- **Hrad** na jižním břehu: hradby, 4 věže, brána na východ, volné nádvoří pro postavičky.
  Hradby jsou nízké a věže štíhlé, aby bylo na nádvoří vidět (kamera 45°).
- **Automatické ukládání** po každé změně + při skrytí stránky.

## 5. Vzdělávací mise

| # | Mise | Stav | Vyhodnocení | Nápověda |
|---|------|------|-------------|----------|
| 1 | Polož 5 dřevěných kostek | MVP | počítadlo položených `wood` | pulzující dřevo v paletě |
| 2 | Najdi 3 červené kostky | MVP | 3 skryté cíle, ťuknutím je „najdeš“ | třpytivé majáčky nad cíli |
| 3 | Postav most přes řeku | MVP | `hasBridge(world)` | průhledné „duchové“ kostky mostu |
| 4 | Nakrm zvířátka | v0.3 | nad zvířátkem bublina s jídlem; vybrat stejnou kostku a ťuknout (ovečka = tráva, kuřátko = písek/zrní, Frený = dřevo/granulky) | bublina, blikající správné jídlo |
| 5 | Domeček pro pejska Freného | v0.3 | 3 stěny + střecha na svítících místech, volné dveře a vnitřek (`doghouseStatus`); Frený pak sám vleze dovnitř | kamera sama ukáže místo, svítící místa |
| 6 | Čísla 1–10 | další verze | | |
| 7 | Geometrické tvary | další verze | | |
| 8 | Písmena | další verze | | |

**Bedny s otazníkem:** ve světě jsou 4 bedny (u startu, na nádvoří, za řekou – tam vede až most,
u domečku). Otevře je jen postavička, která k bedně dojde. Pak přijde krátký úkol se 3 obrázkovými
odpověďmi a hlasem: počítání 1–5, barva kostky, tvar, písmeno („O jako Ondra“). Špatná odpověď =
„zkus znovu“, po 2 pokusech se správná rozsvítí. Ve světě jsou vždy bedny (cíl 3, nikdy 0 – ani na prázdné louce;
když chybí ideální místo, pravidla pro výběr místa se postupně uvolní). Úkoly se neopakují
(posledních 8). Typicky 3 bedny: asi 30 s po vyřešení
úkolu se objeví nová na jiném náhodném místě, kam postavičky dojdou (ne za řekou bez mostu,
ne v bráně ani v rozestavěné stavbě; i na prázdné louce).

Každá mise má: **úvod s animovanou ukázkou** (karta + hlas), **průběh** (ikonky
se plní), **nápovědu** (po nečinnosti nebo při jiném materiálu – nikdy trest),
**oslavu** (hvězdička, konfety, pochvala) a návrat do volného stavění.

## 6. Pedagogické zásady

1. Nejdřív ukázat, pak hrát (úvodní animace + hlas).
2. Chyba neexistuje – jiný materiál je „taky hezký“, jen jemně navedeme.
3. Odměna = pochvala + hvězdička u mise. **Žádné** denní odměny, série, žebříčky, loot boxy, odpočty.
4. Volitelné jemné připomenutí přestávky (rodič nastaví 15 / 30 min).
5. Rodičovská zóna za „rodičovskou bránou“ (příklad na sčítání).

## 7. Roadmapa

- **v0.1 (MVP)** – svět 16×16, 6 materiálů, volné stavění, mise 1–3, hlas, rodičovské nastavení, autosave, PWA. ✅
- **v0.2** – hrad, postavičky Ondra a Laura s chozením, buldoček Frený. ✅
- **v0.3** – mise 4 (krmení zvířátek), mise 5 (domeček pro Freného), bedny s otazníkem s úkoly
  (počítání 1–5, barvy, tvary, písmena), ťuknutí na svítící místo položí kostku přímo tam. ✅
- **v0.4** – režimy panáček / kladivo / Stavitel (šablony hrad, domeček, farma), prázdná louka,
  klíč k pokladu za všechny úkoly. ✅
- **v0.5** – truhla se 3 zámky (klíč nahoře vždy viditelný), oslava klíče, setkání Ondry a Laury. ✅
- **v0.6** – další světy (výběr ostrova); klíče z nich otevřou truhlu s pokladem.
- **v0.7** – mise 6 (čísla: postav věž z N kostek, hlasové počítání), mise 7 (tvary: obtáhni čtverec/obdélník/trojúhelník na zemi).
- **v0.8** – mise 8 (písmena z kostek, začáteční hlásky), více světů / slotů pro sourozence.
- Průběžně: přístupnost (větší kontrast), výkon na starších iPadech, nahrané lidské hlasy jako fallback.
