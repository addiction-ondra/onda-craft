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
    animals: {
      dog: 'Haf haf! Já jsem pejsek Freny.',
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
      intro: 'Pejsek Freny chce na druhou stranu řeky. Postav most! Polož kostky na vodu, až budou spojovat oba břehy.',
      hint: 'Polož kostky tam, kde svítí. Ťukni na vodu.',
      half: 'Super, kus mostu už máš! Ještě jednu kostku vedle.',
      success: 'Hurá! Most je hotový. Freny může přejít řeku. Děkuje ti!',
    },
  } satisfies Record<MissionId, { title: string; intro: string; hint: string; success: string } & Record<string, unknown>>,

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
