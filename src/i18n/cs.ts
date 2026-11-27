import type { BlockType } from '../game/blocks';
import type { MissionId } from '../game/missions';

/** Všechny texty a hlasové hlášky hry. Krátké věty, jednoduchá slova. */
export const CS = {
  appName: 'ONDA CRAFT',

  blockNames: {
    grass: 'tráva',
    wood: 'dřevo',
    stone: 'kámen',
    red: 'červená',
    sand: 'písek',
    blue: 'modrá',
    water: 'voda',
    log: 'strom',
    leaves: 'listí',
    wall: 'zeď',
    roof: 'střecha',
    question: 'bedna s otazníkem',
  } satisfies Record<BlockType, string>,

  /** Hlas při výběru materiálu. */
  blockSpoken: {
    grass: 'Zelená tráva',
    wood: 'Hnědé dřevo',
    stone: 'Šedý kámen',
    red: 'Červená kostka',
    sand: 'Žlutý písek',
    blue: 'Modrá kostka',
    water: 'Voda',
    log: 'Strom',
    leaves: 'Listí',
    wall: 'Zeď',
    roof: 'Střecha',
    question: 'Bedna s otazníkem',
  } satisfies Record<BlockType, string>,

  voice: {
    welcome: 'Ahoj staviteli! Vyber si kostku dole a ťukni na zem.',
    buildMode: 'Stavíme!',
    eraseMode: 'Guma. Ťukni na kostku a schováme ji.',
    groundStays: 'Zem tu zůstane. Zkus jinou kostku.',
    tooHigh: 'Tak vysoko už to nejde. Postav to vedle!',
    freeBuild: 'Volné stavění. Postav, co tě napadne!',
    missionsMenu: 'Vyber si úkol.',
    praise: ['Výborně!', 'Paráda!', 'Skvělá práce!', 'To se ti povedlo!', 'Jsi šikula!'],
    breakTime: 'Stavíš už dlouho. Co si dát pauzu, protáhnout se a napít?',
    characters: {
      ondra: { name: 'Ondra', hello: 'Ahoj, já jsem Ondra! Ťukni, kam mám jít.' },
      lauriska: { name: 'Lauriska', hello: 'Ahoj, já jsem Lauriska! Kam půjdeme?' },
    },
    walk: ['Jdu tam!', 'Už běžím!', 'Hned tam budu!', 'Jdeme na to!'],
    cantReach: 'Tam nedojdu. Postav mi schody nebo most!',
    inCastle: 'Hurá, jsem na hradě!',
    chooseFriend: 'Ahoj! Vyber si dole Ondru nebo Lauriskou a pojď se projít po světě.',
    walkMode: 'Chození. Vyber si kamaráda a ťukni, kam má jít.',
    pickFirst: 'Nejdřív si vyber, kdo půjde. Ťukni dole na Ondru nebo Lauriskou.',
    keyInfo: 'To je klíč k pokladu! Až objevíš další světy, otevřeš s ním poklad.',
    keyAwarded: 'A tady je klíč k pokladu! Ukládám ti ho nahoru.',
    boxNeedsFriend: 'V bedně je úkol! Ťukni na Ondru nebo Lauriskou a pošli je k bedně.',
    boxCantErase: 'Tuhle bednu otevře jen Ondra nebo Lauriska.',
    newBoxes: 'Ve světě jsou nové bedny s otazníkem!',
    newBox: 'Objevila se nová bedna s otazníkem! Najdeš ji?',
    animals: {
      dog: 'Haf haf! Já jsem buldoček Frený.',
      sheep: 'Bééé! Já jsem ovečka.',
      chick: 'Píp píp! Já jsem kuřátko.',
    },
  },

  missions: {
    wood5: {
      title: '5 dřevěných kostek',
      intro: 'Polož pět hnědých dřevěných kostek. Nejdřív vyber dole dřevo. Pak ťukni na zem. Budeme počítat spolu!',
      hint: 'Vyber dole hnědé dřevo. Svítí! Pak ťukni na trávu.',
      otherMaterial: 'To je moc hezká kostka! Teď zkus hnědé dřevo.',
      count: ['Jedna!', 'Dvě!', 'Tři!', 'Čtyři!', 'Pět!'],
      success: 'Hurá! Položil jsi pět dřevěných kostek. Umíš počítat do pěti!',
    },
    findRed: {
      title: 'Najdi 3 červené kostky',
      intro: 'Ve světě se schovaly tři červené kostky. Najdi je a ťukni na ně! Svět můžeš otáčet prstem.',
      hint: 'Podívej se, kde to třpytí. Zkus otočit svět šipkami.',
      found: ['Jednu máš!', 'Druhá! Ještě jedna.', ''],
      success: 'Hurá! Našel jsi všechny tři červené kostky. Máš bystré oči!',
    },
    bridge: {
      title: 'Most přes řeku',
      intro: 'Pejsek Frený chce na druhou stranu řeky. Postav most! Polož kostky na vodu, až budou spojovat oba břehy.',
      hint: 'Polož kostky tam, kde svítí. Ťukni na vodu.',
      half: 'Super, kus mostu už máš! Ještě jednu kostku vedle.',
      success: 'Hurá! Most je hotový. Frený může přejít řeku. Děkuje ti!',
    },
    feed: {
      title: 'Nakrm zvířátka',
      intro:
        'Zvířátka mají hlad! V bublince nad každým je jídlo, které má rádo. Vyber dole stejnou kostku a ťukni na zvířátko.',
      hint: 'Podívej se do bublinky nad zvířátkem. Vyber dole stejnou kostku a ťukni na zvířátko.',
      wants: {
        sheep: 'Ovečka má ráda zelenou trávu.',
        chick: 'Kuřátko má rádo žlutá zrníčka.',
        dog: 'Frený má rád hnědé granulky.',
      },
      yum: {
        sheep: 'Mňam! Bééé, děkuju!',
        chick: 'Mňam! Píp píp, děkuju!',
        dog: 'Mňam! Haf haf, děkuju!',
      },
      full: 'Už jsem najedený, děkuju!',
      success: 'Hurá! Všechna zvířátka jsou najedená a spokojená. Jsi skvělý hospodář!',
    },
    doghouse: {
      title: 'Domeček pro Freného',
      intro:
        'Pejsek Frený potřebuje domeček. Polož kostky tam, kde to svítí: tři stěny a nahoru střechu. Dveře nech otevřené, ať se Frený dostane dovnitř!',
      hint: 'Polož kostky na svítící místa. Tři stěny a střechu.',
      keepFree: 'Nech Frenému dveře a místo uvnitř! Tu kostku můžeš gumou schovat.',
      success: 'Hurá! Domeček je hotový. Frený jde dovnitř. Haf, děkuje ti!',
    },
  } satisfies Record<MissionId, { title: string; intro: string; hint: string; success: string } & Record<string, unknown>>,

  builder: {
    menu: 'Stavitel! Co postavíme? Hrad, domeček, nebo farmu?',
    names: { castle: 'Hrad', house: 'Domeček', farm: 'Farma s ohradou' },
    start: {
      castle: 'Postavíme hrad! Ťukej na svítící místa. Kostky se dají samy. Stavíme zespodu nahoru.',
      house: 'Postavíme domeček! Ťukej na svítící místa. Nejdřív zdi, potom střecha.',
      farm: 'Postavíme farmu s ohradou! Ťukej na svítící místa.',
    },
    nextLayer: 'Patro je hotové! Teď další, nahoru.',
    tapGlow: 'Ťukni na svítící místo.',
    done: {
      castle: 'Hurá! Hrad je hotový. Pošli tam Ondru nebo Lauriskou!',
      house: 'Hurá! Domeček je hotový. Kdo v něm bude bydlet?',
      farm: 'Hurá! Farma je hotová. Zvířátka mají novou ohradu!',
    },
    noRoom: 'Tady už není místo. Ťukni na prázdnou louku, nebo uklid kostky gumou.',
    meadow: 'Prázdná louka',
    meadowAsk: 'Opravdu všechno uklidit? Zůstane jen tráva a řeka.',
    meadowDone: 'Hotovo! Louka je prázdná. Postav, co tě napadne!',
    continue: 'Stavíme dál!',
  },

  quiz: {
    intro: 'Bedna s otazníkem! Tady je úkol.',
    again: 'Skoro! Zkus to ještě jednou.',
    showHelp: 'Podívej, ta správná svítí.',
    opened: 'Bedna je otevřená!',
    numbers: ['nula', 'jedna', 'dvě', 'tři', 'čtyři', 'pět', 'šest'],
    count: {
      apple: 'Kolik je tu jablíček?',
      star: 'Kolik je tu hvězdiček?',
      fish: 'Kolik je tu rybiček?',
      flower: 'Kolik je tu kytiček?',
      balloon: 'Kolik je tu balónků?',
    },
    countEmoji: { apple: '🍎', star: '⭐', fish: '🐟', flower: '🌸', balloon: '🎈' },
    color: (name: string) => `Ťukni na ${name} kostku.`,
    colorNames: { red: 'červenou', blue: 'modrou', sand: 'žlutou', grass: 'zelenou', wood: 'hnědou', stone: 'šedou' } as Record<
      string,
      string
    >,
    shape: (name: string) => `Ťukni na ${name}.`,
    shapeNames: { circle: 'kolečko', square: 'čtverec', triangle: 'trojúhelník', star: 'hvězdu', heart: 'srdíčko' } as Record<
      string,
      string
    >,
    shapeSpoken: { circle: 'Kolečko', square: 'Čtverec', triangle: 'Trojúhelník', star: 'Hvězda', heart: 'Srdíčko' } as Record<
      string,
      string
    >,
    letter: (l: string, word: string) => `Ťukni na písmeno ${l}. ${l} jako ${word}.`,
    letterWords: { O: 'Ondra', L: 'Lauriska', F: 'Frený', M: 'máma', T: 'táta', A: 'auto', P: 'pes', K: 'kočka' } as Record<
      string,
      string
    >,
    letterPics: { O: '👦', L: '👧', F: '🐶', M: '👩', T: '👨', A: '🚗', P: '🐕', K: '🐱' } as Record<string, string>,
  },

  ui: {
    play: 'Hrát',
    go: 'Jdeme na to!',
    continue: 'Stavět dál',
    next: 'Další úkol',
    parents: 'Pro rodiče',
    close: 'Zavřít',
    gateQuestion: (a: number, b: number) => `Kolik je ${a} + ${b}?`,
    gateHint: 'Rodičovská zóna. Napište výsledek.',
    settingsTitle: 'Rodičovské nastavení',
    voice: 'Hlasové pokyny',
    sounds: 'Zvuky',
    voiceRate: 'Rychlost hlasu',
    slow: 'Pomalu',
    normal: 'Normálně',
    autoHints: 'Automatická nápověda',
    breakReminder: 'Připomenutí přestávky',
    off: 'Vypnuto',
    minutes: (n: number) => `${n} min`,
    resetMissions: 'Začít úkoly znovu',
    resetWorld: 'Nový svět',
    meadowParent: 'Prázdná louka (jen země)',
    confirmMeadow: 'Opravdu smazat všechno postavené? Zůstane jen tráva, písek a řeka.',
    walk: 'Chození',
    build: 'Stavění z kostek',
    builder: 'Stavitel',
    keys: 'Klíče k pokladu',
    confirmReset: 'Opravdu smazat stavbu a začít s novým světem?',
    confirmMissions: 'Opravdu vynulovat hvězdičky u úkolů?',
    yes: 'Ano',
    no: 'Ne',
    testVoice: 'Vyzkoušet zvuk a hlas',
    soundHelp:
      'Neslyšíte nic? Zvyšte hlasitost tlačítky na boku. Na iPhonu vypněte tichý režim (přepínač nebo tlačítko Akce na boku). Na iPadu zkontrolujte Ovládací centrum (ikona zvonku).',
    noCzechVoice: 'V zařízení nebyl nalezen český hlas. Na iPadu: Nastavení → Zpřístupnění → Předčítání → Hlasy → Čeština.',
    installTitle: 'Hraní bez internetu',
    installText: 'Safari → Sdílet → Přidat na plochu. Hra pak funguje i offline a vše se ukládá v zařízení.',
    privacy: 'Žádné reklamy, nákupy, registrace ani sběr dat. Vše zůstává jen v tomto zařízení.',
    version: 'Verze',
    breakTitle: 'Pauza?',
    breakOk: 'Dobře',
    rotateHint: 'Otoč zařízení',
  },
};

export type Strings = typeof CS;
