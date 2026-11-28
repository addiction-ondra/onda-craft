# Ondra a Laura Craft 🧱

Vzdělávací 3D kostičková stavebnice pro předškoláky (cca 4 roky).
Barevný voxelový ostrov s řekou, stromy, domečkem a zvířátky – pejskem Freným,
ovečkou a kuřátkem. Ovládání dotykem, minimum textu, české hlasové pokyny.

- **Bez** reklam, nákupů, registrace, backendu, externích API a sběru dat.
- **Bez** příšer, násilí, umírání a časového stresu.
- Funguje **offline** (PWA), vše se ukládá automaticky do zařízení (LocalStorage).
- Optimalizováno pro **iPad a iPhone** (Safari, přidání na plochu).

Architektura a roadmapa: [PLAN.md](PLAN.md) · pravidla vývoje: [CLAUDE.md](CLAUDE.md)

## Co umí verze 0.7.3

- **Frený chodí za dětmi ve všech světech** – za dítětem, se kterým se zrovna hraje
  (naposledy vybraným / poslaným). Pluje s nimi i loďkou do Ledového království.
- Ťukni na Freného, když je vybraný Ondra nebo Laura → dítě k němu dojde a pohladí ho („Frený, hudlánka!“).
- Na ostrově Frený dál vleze do hotového domečku a při stavbě domečku počká.

## Co umí verze 0.7.2

- Prak u sněhuláka Bobka: **3 hrady na výběr** (malý ⭐, střední ⭐⭐, velký ⭐⭐⭐ – obrázkem, bez čtení),
  silnější prak (dostřelí s rezervou i na velký hrad), po zboření se sesype celý hrad
  a objeví se velké zelené tlačítko ✔ – vrátí zpět do světa. 🏰 = jiný hrad, 🔄 = postavit znovu.

## Co umí verze 0.7.1

- V rodičovské zóně malé tlačítko **🧪 Testovací režim**: skok do libovolného světa (i bez klíče),
  splnit všechny úkoly světa (klíč + loďka), rovnou otevřít úkol z bedny/dárku, puzzle, prak nebo plavbu.

## Co umí verze 0.7 – Ledové království ❄️

- **Cesta loďkou:** když jsou na ostrově hotové všechny úkoly (a klíč je v truhle), na vodě
  se objeví **loďka** s bublinou mapy. Ťukni na ni → Ondra a Laura k ní dojdou a odplují.
  Na mapě světů se dá ťuknout na otevřený svět (⛵) – děti dojdou k loďce a odjedou tam.
  Každý svět si pamatuje své stavby i úkoly.
- **Ledové království:** stejně velký zasněžený svět (sněžení), ledový hrad s krystaly,
  zamrzlé jezero, stromy se sněhem. Kostky: **led, zem se sněhem, šedý kámen, dřevo**.
- Místo beden s otazníkem jsou **dárky** – princip stejný (dojdi, otevři, vyřeš úkol).
- **5 nových úkolů:** sněhulák ze 3 sněhových kostek, věž z 5 kostek (počítání),
  vzor led–dřevo (doplň řadu), najdi 3 krystaly, ťukej na sněhové koule od 1 do 5.
- **Princezna Vločka** (v modrých šatech u ledového hradu, mává, bublina „!!“) –
  když k ní děti dojdou, otevře se **puzzle** (6 dílků, obrázek ledového království s dětmi).
- **Sněhulák Bobek** se pořád rozpadá a zase skládá – otevře hru s **prakem**: posíláš
  kostky na ledový hrad z kostek, dokud ho nesestřelíš (neomezeně pokusů, žádný trest).
- Postavičky jsou vlastní (ne Disney) – grafika je kreslená kódem.

## Co umí verze 0.6.2

- Když Ondra nebo Laura dojde k Frenému: nad dítětem ikonka pejska, dítě řekne
  „Frený, hudlánka!“ a pak se objeví srdíčko nad dítětem i nad Freným (Frený poskočí).

## Co umí verze 0.6.1

- Klíč nahoře je šedý, dokud nejsou splněné všechny úkoly; truhla má pak 3 prázdné zámky.
  Po splnění klíč zezlátne. „Nový svět“ i „Začít úkoly znovu“ v rodičovské zóně vrátí klíč na začátek.
- **Mapa světů** (ikona mapy u truhly a v pravém panelu pod hradem): náš ostrov „jsi tady“
  a další ostrovy v mlze. Další světy se teprve připravují.
- Na telefonu je otáčení a přiblížení v jedné řadě nad spodní lištou (nad Ondrou a Laurou).

## Co umí verze 0.6

- Hra se jmenuje **Ondra a Laura Craft**. Úvodní nápis je kostičkový 3D (vlastní pixelové
  písmo z kostek – kamenný řádek „ONDRA A LAURA“ a travnato-hliněný „CRAFT“).
- Ikona na ploše iPadu se jmenuje „Ondra a Laura“.

## Co umí verze 0.5.2

- Ondra a Laura se potkají **pokaždé**, když jeden dojde k druhému: srdíčka, výskok
  a rozhovor – 10 variant, nikdy stejný jako poslední 4. Repliky jdou po sobě
  (vlastní fronta, spolehlivá i v Safari na iPadu), nad mluvícím je bublina s tečkami.

## Co umí verze 0.5.1

- Bedny s otazníkem jsou ve světě **vždy** (i na prázdné louce, hned po vyčištění).
  Když se nenajde ideální místo, pravidla se uvolní, takže se bedna objeví pokaždé.
- Úkoly z beden se neopakují – hra si pamatuje posledních 8 a dá jiný.

## Co umí verze 0.5

- **Truhla s pokladem se 3 zámky:** klíč nahoře je vidět vždy. Ťuknutí ukáže truhlu –
  když jsou úkoly hotové, hlas řekne „Jdi objevit další svět a získej další klíč“;
  když ne, řekne, kolik úkolů zbývá, a nabídne tlačítko na úkoly.
- **Oslava klíče:** po posledním úkolu konfety a klíč vletí do prvního zámku truhly.
- **Ondra a Laura se potkají:** když jeden dojde k druhému, nad oběma se objeví srdíčko,
  společně vyskočí, otočí se k sobě a krátce si popovídají (různé rozhovory, každý jiným hlasem).

## Co umí verze 0.4.1

- Bedny s otazníkem se po vyřešení úkolu objevují znovu (asi za 30 s) na jiném místě,
  kam Ondra a Laura dojdou. Ve světě jsou vždy 3, i na prázdné louce.

## Co umí verze 0.4

- **Tři režimy vpravo:**
  - 🚶 **Panáček** (výchozí): dole si vybere Ondru nebo Lauru a ťukáním chodí po světě.
  - 🔨 **Kladivo**: stavění z kostek (paleta, kostka a guma vlevo).
  - 🏰 **Stavitel**: vybere hrad, domeček nebo farmu s ohradou; svítící kostky ukážou,
    kam stavět (po patrech zespodu), materiál se dá sám. Hotovou stavbou pak může projít.
- **Prázdná louka:** smaže všechno postavené, zůstane tráva, písek a řeka. V menu Stavitele
  (s velkým potvrzením ✔/✖) i v rodičovské zóně.
- **Klíč k pokladu:** za splnění všech 5 úkolů. Ukládá se nahoru do lišty; v dalších
  světech bude otvírat poklad.

## Co umí verze 0.3

- **Mise 4 – Nakrm zvířátka:** nad zvířátkem je bublina s jídlem, které má rádo.
  Vyber dole stejnou kostku a ťukni na zvířátko (ovečka = tráva, kuřátko = žlutá
  zrníčka, Frený = hnědé granulky).
- **Mise 5 – Domeček pro Freného:** kamera sama ukáže svítící místa – 3 stěny
  a střecha. Ťuknutí na svítící místo položí kostku přesně tam. Hotový domeček
  Frený sám obsadí.
- **Bedny s otazníkem:** pošli k bedně Ondru nebo Lauru a otevře se úkol –
  počítání do 5, barvy, tvary nebo písmena (O jako Ondra). Hlas úkol přečte,
  odpovědi jsou obrázky. Chyba = „zkus znovu“, po dvou pokusech se správná
  odpověď rozsvítí.
- Pejsek se jmenuje **Frený**.

## Co umí verze 0.2

- **Hrad** s věžemi, hradbami a bránou – postavičky do něj můžou dojít.
- **Postavičky Ondra a Laura:** ťukni na postavičku (nebo na její obličej
  vpravo nahoře), pak ťukni kamkoli do mapy – postavička tam dojde. Přes řeku
  jen po mostě, na vysoké kostky jen po schodech.
- **Pejsek Frený** je bílý francouzský buldoček s hnědým čumákem a flíčky.
- Uložený svět z verze 0.1 dostane hrad automaticky (stavby mimo hrad zůstanou).

## Co umí verze 0.1 (MVP)

| Funkce | |
| --- | --- |
| Svět 16 × 16 s řekou, stromy, domečkem a zvířátky | ✅ |
| 6 stavebních kostek: dřevo, kámen, červená, tráva, písek, modrá | ✅ |
| Volné stavění – pokládání a gumování ťuknutím, stavění do výšky | ✅ |
| Otáčení světa (tažení prstem / šipky), přiblížení (dva prsty / lupa) | ✅ |
| Mise 1: Polož 5 dřevěných kostek (počítání) | ✅ |
| Mise 2: Najdi 3 červené kostky (pozornost, prostorová orientace) | ✅ |
| Mise 3: Postav most přes řeku (logika, prostorová představivost) | ✅ |
| Animovaná ukázka před každou misí, hlasový úvod, nápověda, oslava | ✅ |
| České hlasové pokyny (Web Speech API) s možností vypnutí | ✅ |
| Rodičovská zóna (za příkladem na sčítání): hlas, zvuky, nápověda, přestávka, reset | ✅ |
| Automatické ukládání, offline režim (PWA) | ✅ |

## Jak se hraje

1. Ťukni na velké zelené ▶. Dole vyber kamaráda a ťukej, kam má jít.
   Stavět z kostek = kladivo vpravo, šablony staveb = hrad vpravo.
2. Dole vyber kostku, ťukni na zem nebo na jinou kostku – kostka přibude.
3. Gumou (růžová ikona vlevo) kostky schováš. Zem zůstane vždy.
4. Vlajka vlevo nahoře = úkoly. Hvězdička = splněný úkol.
5. Obličej Ondry nebo Laury vpravo nahoře (nebo ťuknutí na postavičku) → pak ťukni, kam má jít.
6. Ozubené kolečko vpravo nahoře = nastavení pro rodiče.

## Lokální spuštění

Potřebujete **Node.js 20+** (doporučeno 22).

```bash
npm install
npm run dev
```

Otevřete <http://localhost:5173>. Pro test na iPadu ve stejné Wi-Fi:

```bash
npm run dev -- --host
```

a na iPadu otevřete adresu `http://<IP-počítače>:5173`.
(Service worker a offline režim fungují jen v produkčním buildu – viz níže.)

### Produkční build a náhled

```bash
npm run build      # typecheck + build do dist/
npm run preview    # http://localhost:4173 (včetně service workeru)
```

### Testy

```bash
npm test           # unit testy herní logiky (Vitest)
npm run build && npm run test:e2e   # smoke test v Chromiu (Playwright)
```

Smoke test spustí produkční náhled, „zahraje“ hru (pokládání, guma, otáčení,
všechny 3 mise, zvířátko, reload a obnova uložení, rodičovská brána, offline
režim) na iPadu i iPhonu a uloží screenshoty do `test-results/`.
Pokud nemáte prohlížeč pro Playwright: `npx playwright install chromium`.

## Nasazení na Vercel

Projekt obsahuje `vercel.json` (Vite, výstup `dist/`, SPA přesměrování,
správné cachování `sw.js`).

**Přes webové rozhraní**

1. Nahrajte repozitář na GitHub.
2. Na <https://vercel.com/new> zvolte *Import Git Repository*.
3. Framework Preset: **Vite** (detekuje se sám), Build Command `npm run build`,
   Output Directory `dist`. Nic dalšího není třeba – žádné proměnné prostředí.
4. *Deploy*. Každý push do hlavní větve se nasadí automaticky.

**Přes CLI**

```bash
npm i -g vercel
vercel          # první nasazení (náhled)
vercel --prod   # produkce
```

## Instalace na iPad / iPhone (offline hraní)

1. Otevřete nasazenou adresu v **Safari**.
2. Sdílet → **Přidat na plochu**.
3. Spusťte ikonou z plochy – hra běží na celou obrazovku a funguje i bez internetu.

**Český hlas:** iOS obvykle obsahuje český hlas „Zuzana“. Kvalitnější verzi lze
stáhnout v *Nastavení → Zpřístupnění → Předčítaný obsah → Hlasy → Čeština*.
Hlas lze vyzkoušet a vypnout v rodičovském nastavení.

**Tip pro rodiče:** *Nastavení → Zpřístupnění → Asistovaný přístup* zamkne iPad
jen do této hry.

## Struktura projektu

```
src/
  game/        čistá herní logika (svět, mise, ukládání) + unit testy
  render/      Three.js – scéna, kamera, textury, zvířátka, efekty
  controller/  GameController – propojuje vstup, logiku, render, zvuk a ukládání
  audio/       hlas (Web Speech) a syntetizované zvuky (Web Audio)
  ui/          React komponenty (HUD, mise, ukázky, rodičovská zóna)
  i18n/cs.ts   všechny české texty a hlášky
scripts/       smoke test a generátor ikon
public/icons/  ikony aplikace (vlastní SVG → PNG: npm run icons)
```

Veškerá grafika (textury kostek, zvířátka, ikony) je vlastní a generuje se kódem –
nepoužívají se žádné cizí assety.
