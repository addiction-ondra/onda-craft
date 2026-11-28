import type { BlockType } from '../game/blocks';
import type { MissionId } from '../game/missions';

/** Všechny texty a hlasové hlášky hry. Krátké věty, jednoduchá slova. */
export const CS = {
  appName: 'Ondra a Laura Craft',

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
    ice: 'led',
    snow: 'sníh',
    gift: 'dárek',
    crystal: 'krystal',
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
    ice: 'Modrý led',
    snow: 'Bílý sníh',
    gift: 'Dárek',
    crystal: 'Ledový krystal',
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
      lauriska: { name: 'Laura', hello: 'Ahoj, já jsem Laura! Kam půjdeme?' },
    },
    walk: ['Jdu tam!', 'Už běžím!', 'Hned tam budu!', 'Jdeme na to!'],
    cantReach: 'Tam nedojdu. Postav mi schody nebo most!',
    inCastle: 'Hurá, jsem na hradě!',
    petDog: 'Frený, hudlánka!',
    giftNeedsFriend: 'V dárku je úkol! Ťukni na Ondru nebo Lauru a pošli je k dárku.',
    newGift: 'Objevil se nový dárek! Najdeš ho?',
    chooseFriend: 'Ahoj! Vyber si dole Ondru nebo Lauru a pojď se projít po světě.',
    walkMode: 'Chození. Vyber si kamaráda a ťukni, kam má jít.',
    pickFirst: 'Nejdřív si vyber, kdo půjde. Ťukni dole na Ondru nebo Lauru.',
    keyInfo: 'To je klíč k pokladu! Až objevíš další světy, otevřeš s ním poklad.',
    keyAwarded: 'A tady je klíč k pokladu! Ukládám ti ho nahoru.',
    boxNeedsFriend: 'V bedně je úkol! Ťukni na Ondru nebo Lauru a pošli je k bedně.',
    boxCantErase: 'Tuhle bednu otevře jen Ondra nebo Laura.',
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
    snowman: {
      title: 'Postav sněhuláka',
      intro: 'Sněhulák Bobek chce kamaráda! Postav sněhuláka ze tří sněhových koulí. Vyber dole bílý sníh a ťukej na svítící místo.',
      hint: 'Vyber bílý sníh a ťukni na svítící místo. Tři koule na sebe!',
      count: ['Jedna koule!', 'Dvě koule!', 'Tři koule!'],
      wrong: 'Sněhulák je ze sněhu. Vyber dole bílý sníh.',
      success: 'Hurá! Sněhulák je hotový. Bobek má nového kamaráda!',
    },
    tower5: {
      title: 'Věž z pěti kostek',
      intro: 'Postav vysokou věž z pěti kostek. Ťukej na svítící místo a budeme počítat spolu!',
      hint: 'Ťukni na svítící místo. Věž roste nahoru!',
      count: ['Jedna!', 'Dvě!', 'Tři!', 'Čtyři!', 'Pět!'],
      success: 'Hurá! Věž má pět pater. Jedna, dva, tři, čtyři, pět!',
    },
    pattern: {
      title: 'Dokonči řadu',
      intro: 'Podívej se na řadu kostek: led, dřevo, led. Co přijde dál? Dokonči řadu na svítících místech!',
      hint: 'Led, dřevo, led, dřevo… Co přijde teď? Vyber správnou kostku a ťukni na svítící místo.',
      wrongWood: 'Skoro! Po ledu přijde dřevo. Zkus hnědé dřevo.',
      wrongIce: 'Skoro! Po dřevu přijde led. Zkus modrý led.',
      success: 'Hurá! Řada je hotová. Led, dřevo, led, dřevo, led, dřevo. Jsi chytrý!',
    },
    crystals: {
      title: 'Najdi 3 krystaly',
      intro: 'V Ledovém království se schovaly tři ledové krystaly. Najdi je a ťukni na ně! Svět můžeš otáčet.',
      hint: 'Podívej se, kde to třpytí. Zkus otočit svět šipkami.',
      found: ['Jeden krystal!', 'Druhý! Ještě jeden.', ''],
      success: 'Hurá! Našel jsi všechny krystaly. Svítí jako hvězdičky!',
    },
    numbers: {
      title: 'Čísla 1 až 5',
      intro: 'Na sněhových koulích jsou čísla. Ťukni na ně popořadě: jedna, dva, tři, čtyři, pět!',
      hint: 'Hledej kouli s číslem, které přijde teď.',
      next: (n: string) => `Teď hledáme číslo ${n}.`,
      says: ['Jedna!', 'Dvě!', 'Tři!', 'Čtyři!', 'Pět!'],
      success: 'Hurá! Jedna, dva, tři, čtyři, pět. Umíš čísla!',
    },
  } satisfies Record<MissionId, { title: string; intro: string; hint: string; success: string } & Record<string, unknown>>,

  treasure: {
    fresh: 'Hurá! Splnil jsi všechny úkoly a získal jsi klíč k pokladu! Truhla s pokladem má tři zámky. První klíč už je v zámku!',
    done: 'Klíč z tohoto světa už máš! Jdi objevit další svět a získej další klíč.',
    notDone: (left: string) => `Truhla s pokladem má tři zámky. Klíč dostaneš, když splníš všechny úkoly. Zbývá ti ještě ${left}. Ťukni na vlajku a pusť se do toho!`,
    left: ['', 'jeden úkol', 'dva úkoly', 'tři úkoly', 'čtyři úkoly', 'pět úkolů', 'šest úkolů'],
  },

  /** Když se Ondra a Laura potkají – srdíčka, výskok a krátký rozhovor. */
  meet: [
    [
      { who: 'ondra', text: 'Ahoj Lauro! Jak se dneska máš?' },
      { who: 'lauriska', text: 'Ahoj Ondro! Mám se moc dobře. A ty?' },
      { who: 'ondra', text: 'Já taky! Pojď si spolu hrát!' },
    ],
    [
      { who: 'lauriska', text: 'Ahoj Ondro! Co dneska stavíš?' },
      { who: 'ondra', text: 'Stavím hrad! Pomůžeš mi?' },
      { who: 'lauriska', text: 'Jasně! Spolu to půjde líp.' },
    ],
    [
      { who: 'ondra', text: 'Lauro, viděla jsi Freného?' },
      { who: 'lauriska', text: 'Viděla! Běhal u řeky.' },
      { who: 'ondra', text: 'Tak pojďme za ním!' },
    ],
    [
      { who: 'lauriska', text: 'Ondro! Jsem ráda, že tě vidím.' },
      { who: 'ondra', text: 'Já tebe taky, Lauro! Dáme si závod?' },
      { who: 'lauriska', text: 'Jo! Raz, dva, tři, běžíme!' },
    ],
    [
      { who: 'ondra', text: 'Lauro, jakou máš ráda barvu?' },
      { who: 'lauriska', text: 'Růžovou! A ty, Ondro?' },
      { who: 'ondra', text: 'Já mám rád modrou. Jako řeka!' },
    ],
    [
      { who: 'lauriska', text: 'Ondro, víš, kolik je tu stromů?' },
      { who: 'ondra', text: 'Spočítáme je spolu! Jedna, dva, tři…' },
      { who: 'lauriska', text: 'To je spousta stromů!' },
    ],
    [
      { who: 'ondra', text: 'Ahoj Lauro! Mám hlad.' },
      { who: 'lauriska', text: 'Já taky! Co si dáme?' },
      { who: 'ondra', text: 'Jablíčko! Mňam!' },
    ],
    [
      { who: 'lauriska', text: 'Ondro, slyšíš to? Bééé!' },
      { who: 'ondra', text: 'To je ovečka! Jde nás pozdravit.' },
      { who: 'lauriska', text: 'Ahoj ovečko!' },
    ],
    [
      { who: 'ondra', text: 'Lauro, našla jsi bednu s otazníkem?' },
      { who: 'lauriska', text: 'Ještě ne. Pomůžeš mi ji najít?' },
      { who: 'ondra', text: 'Jasně! Hledáme spolu!' },
    ],
    [
      { who: 'lauriska', text: 'Ondro, dneska je krásný den.' },
      { who: 'ondra', text: 'To je! Svítí sluníčko.' },
      { who: 'lauriska', text: 'Pojďme se projít k hradu!' },
    ],
  ] as Array<Array<{ who: 'ondra' | 'lauriska'; text: string }>>,

  /** Cestování lodičkou mezi světy. */
  travel: {
    boatReady: 'Na vodě je lodička! Ťukni na ni a poplujeme do dalšího světa.',
    boatTap: 'Jdeme k lodičce!',
    sailing: 'Plujeme! Houpy hou!',
    welcome: {
      island: 'Jsme zpátky na ostrově s hradem!',
      ice: 'Vítej v Ledovém království! Je tu sníh, led a ledový hrad. Princezna Vločka a sněhulák Bobek potřebují pomoc!',
    },
    noTrip: 'Lodička čeká. Až získáš klíč, poplujeme do dalšího světa!',
  },

  /** Postavy v Ledovém království (vlastní postavy, ne převzaté). */
  npcs: {
    princess: {
      name: 'Princezna Vločka',
      tapNeedsFriend: 'Princezna Vločka potřebuje pomoc! Pošli k ní Ondru nebo Lauru.',
      hello: 'Ahoj děti! Rozbil se mi obrázek mého ledového hradu. Pomůžete mi ho poskládat?',
      done: 'Děkuju! Obrázek je zase celý. Jste skvělí pomocníci!',
    },
    snowman: {
      name: 'Sněhulák Bobek',
      tapNeedsFriend: 'Sněhulák Bobek si chce hrát! Pošli k němu Ondru nebo Lauru.',
      hello: 'Ahoj! Já jsem Bobek. Pořád se rozpadám! Zahrajeme si s prakem? Zbouráme ledový hrad!',
      shoot: 'Zatáhni za prak a pusť!',
      hit: ['Bum!', 'Prásk!', 'Paráda!', 'Trefa!'],
      done: 'Hurá! Hrad je zbouraný! Ťukni na zelenou fajfku a jdeme zpátky.',
    },
  },

  puzzle: {
    title: 'Puzzle',
    hint: 'Vezmi dílek prstem a posuň ho na správné místo.',
    good: ['Sedí!', 'Výborně!', 'Ano!'],
    again: 'Tady ne. Zkus jiné místo.',
  },

  sling: {
    title: 'Prak',
    again: 'Postavit znovu',
    pick: 'Vyber si hrad! Malý, střední, nebo velký?',
    levelsTitle: 'Jiný hrad',
    levels: ['Malý hrad', 'Střední hrad', 'Velký hrad'],
    done: 'Hotovo',
  },

  worlds: {
    title: 'Mapa světů',
    names: ['Ostrov s hradem', 'Ledové království', 'Ostrov s majákem'],
    noKey: 'Tohle je mapa světů. Jsi na ostrově s hradem. Až tu splníš všechny úkoly a získáš klíč, otevře se cesta dál.',
    withKey: 'Tohle je mapa světů. Ťukni na otevřený ostrov a poplujeme lodičkou!',
    here: 'Tady jsi teď!',
    locked: 'Tam se dostaneš s klíčem. Nejdřív splň všechny úkoly.',
    building: 'Tenhle ostrov se ještě staví. Brzy se tam podíváš!',
  },

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
      castle: 'Hurá! Hrad je hotový. Pošli tam Ondru nebo Lauru!',
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
    letterWords: { O: 'Ondra', L: 'Laura', F: 'Frený', M: 'máma', T: 'táta', A: 'auto', P: 'pes', K: 'kočka' } as Record<
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
    treasure: 'Truhla s pokladem',
    toMissions: 'Jdi na úkoly',
    worlds: 'Mapa světů',
    confirmReset: 'Opravdu začít úplně od začátku? Smaže se stavba, splněné úkoly i klíč k pokladu.',
    confirmMissions: 'Opravdu vynulovat hvězdičky u úkolů? Zešedne i klíč k pokladu.',
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
    test: {
      button: '🧪 Testovací režim',
      hide: '🧪 Skrýt testovací režim',
      note: 'Pro rodiče: rychlé zkoušení funkcí. Skok do světa funguje i bez klíče.',
      worlds: 'Skočit do světa',
      completeAll: '⭐ Splnit všechny úkoly (klíč + loďka)',
      quiz: '🎁 Úkol z bedny / dárku',
      puzzle: '🧩 Puzzle princezny',
      sling: '🎯 Prak sněhuláka',
      travel: '⛵ Plavba lodičkou',
    },
  },
};

export type Strings = typeof CS;
