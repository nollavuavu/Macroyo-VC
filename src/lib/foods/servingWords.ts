/**
 * Word tables for serving labels ("1 cup, chopped", "1 can (12 fl oz)") in Vietnamese and Finnish.
 * The parser in servingLabel.ts turns a label into tokens and looks every word up here.
 * A word that is missing makes that label fall back to English (never a partial translation).
 *
 * Finnish nouns carry their forms because numbers need them: "1 viipale", "2 viipaletta" (partitive after a
 * number other than one), "palat" (plural) and "paloja" (partitive plural, after a measure: "1 kuppi paloja").
 */

export type Lang = 'vi' | 'fi';

export interface Noun {
  kind: 'noun';
  vi: string;
  fi: string;
  /** Finnish partitive singular ("viipaletta"), used after a number other than 1 and after a measure. */
  fiPart: string;
  /** Finnish nominative plural ("viipaleet"). */
  fiPl?: string;
  /** Finnish partitive plural ("viipaleita"). */
  fiPartPl?: string;
  /** The English word is a plural form ("slices"). */
  plural?: boolean;
  /** A measure of something: a following noun is the thing measured ("1 cup spaghetti", "3 pieces shrimp"). */
  measure?: boolean;
}
export interface Adj {
  kind: 'adj';
  vi: string;
  fi: string;
  fiPart: string;
}
/** Invariable words: participles ("chopped"), connectors, abbreviations and fixed phrases. */
export interface Fixed {
  kind: 'fixed';
  vi?: string;
  fi?: string;
}
/** "very": goes before an adjective in both languages. */
export interface Adverb {
  kind: 'adv';
  vi: string;
  fi: string;
}
export type Entry = Noun | Adj | Fixed | Adverb;

type NounRow = [vi: string, fi: string, fiPart: string, fiPl?: string, fiPartPl?: string];

const NOUN_ROWS: Record<string, NounRow> = {
  serving: ['phần', 'annos', 'annosta', 'annokset', 'annoksia'],
  portion: ['phần', 'annos', 'annosta', 'annokset', 'annoksia'],
  item: ['cái', 'kpl', 'kpl'],
  slice: ['lát', 'viipale', 'viipaletta', 'viipaleet', 'viipaleita'],
  piece: ['miếng', 'pala', 'palaa', 'palat', 'paloja'],
  fillet: ['miếng phi lê', 'filee', 'fileetä', 'fileet', 'fileitä'],
  bar: ['thanh', 'patukka', 'patukkaa', 'patukat', 'patukoita'],
  can: ['lon', 'tölkki', 'tölkkiä', 'tölkit', 'tölkkejä'],
  bottle: ['chai', 'pullo', 'pulloa', 'pullot', 'pulloja'],
  sandwich: ['bánh sandwich', 'voileipä', 'voileipää', 'voileivät', 'voileipiä'],
  egg: ['trứng', 'kananmuna', 'kananmunaa', 'kananmunat', 'kananmunia'],
  'egg white': ['lòng trắng trứng', 'munanvalkuainen', 'munanvalkuaista', 'munanvalkuaiset', 'munanvalkuaisia'],
  'egg yolk': ['lòng đỏ trứng', 'munankeltuainen', 'munankeltuaista', 'munankeltuaiset', 'munankeltuaisia'],
  'egg roll': ['chả giò', 'egg roll', 'egg rollia', 'egg rollit', 'egg rolleja'],
  patty: ['miếng patty', 'pihvi', 'pihviä', 'pihvit', 'pihvejä'],
  pattie: ['miếng patty', 'pihvi', 'pihviä', 'pihvit', 'pihvejä'],
  pakora: ['bánh pakora', 'pakora', 'pakoraa', 'pakorat', 'pakoroja'],
  roll: ['cuốn', 'rulla', 'rullaa', 'rullat', 'rullia'],
  fruit: ['quả', 'hedelmä', 'hedelmää', 'hedelmät', 'hedelmiä'],
  cookie: ['bánh quy', 'keksi', 'keksiä', 'keksit', 'keksejä'],
  container: ['hộp', 'rasia', 'rasiaa', 'rasiat', 'rasioita'],
  drink: ['đồ uống', 'juoma', 'juomaa', 'juomat', 'juomia'],
  cracker: ['bánh quy giòn', 'suolakeksi', 'suolakeksiä', 'suolakeksit', 'suolakeksejä'],
  biscuit: ['bánh biscuit', 'biscuit', 'biscuitia', 'biscuitit', 'biscuiteja'],
  pouch: ['gói', 'pussi', 'pussia', 'pussit', 'pusseja'],
  bag: ['túi', 'pussi', 'pussia', 'pussit', 'pusseja'],
  packet: ['gói', 'paketti', 'pakettia', 'paketit', 'paketteja'],
  package: ['gói', 'paketti', 'pakettia', 'paketit', 'paketteja'],
  envelope: ['gói', 'annospussi', 'annospussia', 'annospussit', 'annospusseja'],
  cake: ['bánh', 'kakku', 'kakkua', 'kakut', 'kakkuja'],
  cupcake: ['bánh cupcake', 'kuppikakku', 'kuppikakkua', 'kuppikakut', 'kuppikakkuja'],
  strip: ['dải', 'suikale', 'suikaletta', 'suikaleet', 'suikaleita'],
  stick: ['que', 'tikku', 'tikkua', 'tikut', 'tikkuja'],
  shot: ['ly nhỏ', 'shotti', 'shottia', 'shotit', 'shotteja'],
  jigger: ['ly đong', 'jigger', 'jiggeriä', 'jiggerit', 'jiggereitä'],
  glass: ['ly', 'lasi', 'lasia', 'lasit', 'laseja'],
  'espresso cup': ['tách espresso', 'espressokuppi', 'espressokuppia', 'espressokupit', 'espressokuppeja'],
  bagel: ['bánh bagel', 'bagel', 'bagelia', 'bagelit', 'bageleita'],
  chop: ['miếng sườn', 'kyljys', 'kyljystä', 'kyljykset', 'kyljyksiä'],
  wing: ['cánh', 'siipi', 'siipeä', 'siivet', 'siipiä'],
  thigh: ['đùi', 'reisi', 'reittä', 'reidet', 'reisiä'],
  drumstick: ['đùi tỏi', 'koipi', 'koipea', 'koivet', 'koipia'],
  drummette: ['cánh gà (phần gốc)', 'siiven ylälyhty', 'siiven ylälyhtyä', 'siiven ylälyhdyt', 'siiven ylälyhtyjä'],
  breast: ['ức', 'rinta', 'rintaa', 'rinnat', 'rintoja'],
  link: ['cây xúc xích', 'makkara', 'makkaraa', 'makkarat', 'makkaroita'],
  frankfurter: ['xúc xích', 'nakki', 'nakkia', 'nakit', 'nakkeja'],
  hamburger: ['hamburger', 'hampurilainen', 'hampurilaista', 'hampurilaiset', 'hampurilaisia'],
  chiliburger: ['chiliburger', 'chiliburgeri', 'chiliburgeria', 'chiliburgerit', 'chiliburgereita'],
  corndog: ['corn dog', 'corn dog', 'corn dogia', 'corn dogit', 'corn dogeja'],
  burrito: ['burrito', 'burrito', 'burritoa', 'burritot', 'burritoja'],
  taco: ['taco', 'taco', 'tacoa', 'tacot', 'tacoja'],
  'taco salad': ['salad taco', 'tacosalaatti', 'tacosalaattia', 'tacosalaatit', 'tacosalaatteja'],
  enchilada: ['enchilada', 'enchilada', 'enchiladaa', 'enchiladat', 'enchiladoja'],
  fajita: ['fajita', 'fajita', 'fajitaa', 'fajitat', 'fajitoja'],
  quesadilla: ['quesadilla', 'quesadilla', 'quesadillaa', 'quesadillat', 'quesadilloja'],
  wrap: ['bánh wrap', 'wrap', 'wrapia', 'wrapit', 'wrapeja'],
  tortilla: ['bánh tortilla', 'tortilla', 'tortillaa', 'tortillat', 'tortilloja'],
  pita: ['bánh pita', 'pitaleipä', 'pitaleipää', 'pitaleivät', 'pitaleipiä'],
  paratha: ['bánh paratha', 'paratha', 'parathaa', 'parathat', 'parathoja'],
  matzo: ['bánh matzo', 'matzo', 'matzoa', 'matzot', 'matzoja'],
  manicotti: ['manicotti', 'manicotti', 'manicottia', 'manicottit', 'manicotteja'],
  flatbread: ['bánh mì dẹt', 'lättäleipä', 'lättäleipää', 'lättäleivät', 'lättäleipiä'],
  breadstick: ['bánh mì que', 'leipätikku', 'leipätikkua', 'leipätikut', 'leipätikkuja'],
  doughnut: ['bánh donut', 'donitsi', 'donitsia', 'donitsit', 'donitseja'],
  muffin: ['bánh muffin', 'muffini', 'muffinia', 'muffinit', 'muffineja'],
  pancake: ['bánh pancake', 'pannukakku', 'pannukakkua', 'pannukakut', 'pannukakkuja'],
  'silver dollar pancake': ['bánh pancake mini', 'minipannukakku', 'minipannukakkua', 'minipannukakut', 'minipannukakkuja'],
  hotcake: ['bánh hotcake', 'lettu', 'lettua', 'letut', 'lettuja'],
  waffle: ['bánh waffle', 'vohveli', 'vohvelia', 'vohvelit', 'vohveleita'],
  croissant: ['bánh croissant', 'voisarvi', 'voisarvea', 'voisarvet', 'voisarvia'],
  'cabbage roll': ['cuốn bắp cải', 'kaalikääryle', 'kaalikäärylettä', 'kaalikääryleet', 'kaalikääryleitä'],
  'doughnut stick': ['que bánh donut', 'donitsitikku', 'donitsitikkua', 'donitsitikut', 'donitsitikkuja'],
  'bagel chip': ['miếng bánh bagel giòn', 'bagelchips', 'bagelchipsiä', 'bagelchipsit', 'bagelchipsejä'],
  scoop: ['muỗng múc', 'kauha', 'kauhaa', 'kauhat', 'kauhoja'],
  pie: ['bánh nướng', 'piirakka', 'piirakkaa', 'piirakat', 'piirakoita'],
  sundae: ['ly kem sundae', 'jäätelöannos', 'jäätelöannosta', 'jäätelöannokset', 'jäätelöannoksia'],
  milkshake: ['ly sữa lắc', 'pirtelö', 'pirtelöä', 'pirtelöt', 'pirtelöitä'],
  soda: ['soda', 'limsa', 'limsaa', 'limsat', 'limsoja'],
  cone: ['ốc quế', 'tötterö', 'tötteröä', 'tötteröt', 'tötteröitä'],
  bowl: ['tô', 'kulho', 'kulhoa', 'kulhot', 'kulhoja'],
  clove: ['tép', 'kynsi', 'kynttä', 'kynnet', 'kynsiä'],
  leaf: ['lá', 'lehti', 'lehteä', 'lehdet', 'lehtiä'],
  spear: ['cọng', 'varsi', 'vartta', 'varret', 'varsia'],
  sprout: ['mầm', 'idu', 'itua', 'idut', 'ituja'],
  sprig: ['cành', 'oksa', 'oksaa', 'oksat', 'oksia'],
  ear: ['bắp', 'tähkä', 'tähkää', 'tähkät', 'tähkiä'],
  grape: ['quả nho', 'viinirypäle', 'viinirypälettä', 'viinirypäleet', 'viinirypäleitä'],
  olive: ['quả ô liu', 'oliivi', 'oliivia', 'oliivit', 'oliiveja'],
  date: ['quả chà là', 'taateli', 'taatelia', 'taatelit', 'taateleita'],
  clam: ['con nghêu', 'simpukka', 'simpukkaa', 'simpukat', 'simpukoita'],
  crab: ['con cua', 'rapu', 'rapua', 'ravut', 'rapuja'],
  crayfish: ['con tôm càng', 'jokirapu', 'jokirapua', 'jokiravut', 'jokirapuja'],
  lobster: ['con tôm hùm', 'hummeri', 'hummeria', 'hummerit', 'hummereita'],
  oyster: ['con hàu', 'osteri', 'osteria', 'osterit', 'ostereita'],
  anchovy: ['con cá cơm', 'anjovis', 'anjovista', 'anjovikset', 'anjovisia'],
  tail: ['đuôi', 'pyrstö', 'pyrstöä', 'pyrstöt', 'pyrstöjä'],
  rib: ['xương sườn', 'kylkiluu', 'kylkiluuta', 'kylkiluut', 'kylkiluita'],
  steak: ['miếng bít tết', 'pihvi', 'pihviä', 'pihvit', 'pihvejä'],
  liver: ['lá gan', 'maksa', 'maksaa', 'maksat', 'maksoja'],
  shell: ['vỏ', 'kuori', 'kuorta', 'kuoret', 'kuoria'],
  pat: ['viên', 'nokare', 'nokaretta', 'nokareet', 'nokareita'],
  square: ['miếng vuông', 'neliö', 'neliötä', 'neliöt', 'neliöitä'],
  circle: ['vòng tròn', 'ympyrä', 'ympyrää', 'ympyrät', 'ympyröitä'],
  ball: ['viên', 'pallo', 'palloa', 'pallot', 'palloja'],
  sheet: ['tờ', 'arkki', 'arkkia', 'arkit', 'arkkeja'],
  fry: ['miếng khoai tây chiên', 'ranskalainen', 'ranskalaista', 'ranskalaiset', 'ranskalaisia'],
  twist: ['cái xoắn', 'kierre', 'kierrettä', 'kierteet', 'kierteitä'],
  chip: ['miếng', 'sipsi', 'sipsiä', 'sipsit', 'sipsejä'],
  cube: ['khối', 'kuutio', 'kuutiota', 'kuutiot', 'kuutioita'],
  chunk: ['miếng lớn', 'kimpale', 'kimpaletta', 'kimpaleet', 'kimpaleita'],
  half: ['nửa', 'puolikas', 'puolikasta', 'puolikkaat', 'puolikkaita'],
  section: ['múi', 'lohko', 'lohkoa', 'lohkot', 'lohkoja'],
  pulp: ['cùi', 'hedelmäliha', 'hedelmälihaa', 'hedelmäliha', 'hedelmälihaa'],
  artichoke: ['quả atisô', 'artisokka', 'artisokkaa', 'artisokat', 'artisokkia'],
  leek: ['cây tỏi tây', 'purjo', 'purjoa', 'purjot', 'purjoja'],
  banana: ['quả chuối', 'banaani', 'banaania', 'banaanit', 'banaaneja'],
  onion: ['củ hành tây', 'sipuli', 'sipulia', 'sipulit', 'sipuleita'],
  potato: ['củ khoai tây', 'peruna', 'perunaa', 'perunat', 'perunoita'],
  pepper: ['quả ớt', 'paprika', 'paprikaa', 'paprikat', 'paprikoita'],
  tomato: ['quả cà chua', 'tomaatti', 'tomaattia', 'tomaatit', 'tomaatteja'],
  'cherry tomato': ['cà chua bi', 'kirsikkatomaatti', 'kirsikkatomaattia', 'kirsikkatomaatit', 'kirsikkatomaatteja'],
  spaghetti: ['mì spaghetti', 'spagetti', 'spagettia', 'spagetit', 'spagetteja'],
  shrimp: ['tôm', 'katkarapu', 'katkarapua', 'katkaravut', 'katkarapuja'],
  ham: ['giăm bông', 'kinkku', 'kinkkua', 'kinkut', 'kinkkuja'],
  juice: ['nước ép', 'mehu', 'mehua', 'mehut', 'mehuja'],
  oil: ['dầu', 'öljy', 'öljyä', 'öljyt', 'öljyjä'],
  sauce: ['sốt', 'kastike', 'kastiketta', 'kastikkeet', 'kastikkeita'],
  size: ['cỡ', 'koko', 'kokoa'],
  // Units of measure. Abbreviations are the same in every number.
  cup: ['cốc', 'kuppi', 'kuppia', 'kupit', 'kuppeja'],
  tablespoon: ['muỗng canh', 'rkl', 'rkl', 'rkl', 'rkl'],
  teaspoon: ['muỗng cà phê', 'tl', 'tl', 'tl', 'tl'],
  oz: ['oz', 'oz', 'oz', 'oz', 'oz'],
  'fl oz': ['fl oz', 'fl oz', 'fl oz', 'fl oz', 'fl oz'],
  g: ['g', 'g', 'g', 'g', 'g'],
  ml: ['ml', 'ml', 'ml', 'ml', 'ml'],
  dl: ['dl', 'dl', 'dl', 'dl', 'dl'],
};

/** Nouns that are measures: a noun right after them is the thing measured. */
const MEASURES = new Set(['cup', 'tablespoon', 'teaspoon', 'oz', 'fl oz', 'g', 'ml', 'dl', 'piece', 'slice']);

/** English plural or variant spellings that map to a row above. */
const PLURAL_OF: Record<string, string> = {
  pieces: 'piece', slices: 'slice', eggs: 'egg', biscuits: 'biscuit', crackers: 'cracker', rolls: 'roll', balls: 'ball',
  cubes: 'cube', chunks: 'chunk', halves: 'half', sections: 'section', sprigs: 'sprig', leaves: 'leaf', anchovies: 'anchovy',
  tomatoes: 'tomato', fries: 'fry', twists: 'twist', chips: 'chip', cookies: 'cookie', hotcakes: 'hotcake',
  'cherry tomatoes': 'cherry tomato', clams: 'clam', links: 'link', sheets: 'sheet', cups: 'cup', bars: 'bar',
};
const ALIAS_OF: Record<string, string> = { tbsp: 'tablespoon', tsp: 'teaspoon', 'tablespoons': 'tablespoon', teaspoons: 'teaspoon', 'fl. oz': 'fl oz', 'oz.': 'oz' };

type AdjRow = [vi: string, fi: string, fiPart: string];
const ADJ_ROWS: Record<string, AdjRow> = {
  small: ['nhỏ', 'pieni', 'pientä'],
  medium: ['vừa', 'keskikokoinen', 'keskikokoista'],
  large: ['lớn', 'iso', 'isoa'],
  regular: ['thường', 'tavallinen', 'tavallista'],
  thin: ['mỏng', 'ohut', 'ohutta'],
  thick: ['dày', 'paksu', 'paksua'],
  long: ['dài', 'pitkä', 'pitkää'],
  high: ['cao', 'korkea', 'korkeaa'],
  miniature: ['mini', 'minikokoinen', 'minikokoista'],
  miniatures: ['mini', 'minikokoinen', 'minikokoista'],
  single: ['đơn', 'yksittäinen', 'yksittäistä'],
  individual: ['riêng lẻ', 'yksittäinen', 'yksittäistä'],
  junior: ['junior', 'junior', 'junior'],
  whole: ['nguyên', 'kokonainen', 'kokonaista'],
  white: ['trắng', 'valkoinen', 'valkoista'],
  solid: ['đặc', 'kiinteä', 'kiinteää'],
  full: ['đầy', 'täysi', 'täyttä'],
  boneless: ['không xương', 'luuton', 'luutonta'],
  creamy: ['mịn', 'kermainen', 'kermaista'],
  liquid: ['lỏng', 'nestemäinen', 'nestemäistä'],
  crunchy: ['giòn', 'rapea', 'rapeaa'],
  round: ['tròn', 'pyöreä', 'pyöreää'],
  sq: ['vuông', 'neliö', 'neliötä'],
};

const FIXED_ROWS: Record<string, [vi: string | undefined, fi: string | undefined]> = {
  // Preparation (participles, the same for any number).
  chopped: ['băm nhỏ', 'pilkottu'],
  diced: ['thái hạt lựu', 'kuutioitu'],
  cubed: ['thái khối', 'kuutioitu'],
  sliced: ['thái lát', 'viipaloitu'],
  shredded: ['xé sợi', 'raastettu'],
  drained: ['để ráo', 'valutettu'],
  cooked: ['nấu chín', 'kypsennetty'],
  packed: ['nén chặt', 'pakattu'],
  'well packed': ['nén thật chặt', 'tiiviisti pakattu'],
  'not packed': ['không nén', 'pakkaamaton'],
  unpacked: ['không nén', 'pakkaamaton'],
  crumbled: ['vụn', 'murennettu'],
  crushed: ['nghiền', 'murskattu'],
  mashed: ['nghiền nhuyễn', 'muussattu'],
  whipped: ['đánh bông', 'vatkattu'],
  thawed: ['đã rã đông', 'sulatettu'],
  unthawed: ['chưa rã đông', 'sulattamaton'],
  pitted: ['bỏ hạt', 'kivetön'],
  flaked: ['tách miếng', 'hiutaloitu'],
  unsifted: ['chưa rây', 'seulomaton'],
  prepared: ['đã chế biến', 'valmistettu'],
  ground: ['xay', 'jauhettu'],
  refrigerated: ['ướp lạnh', 'jääkaappikylmä'],
  // With / without.
  'with skin': ['có da', 'ihoineen'],
  'without skin': ['không da', 'ihaton'],
  'without skin and seed': ['bỏ vỏ và hạt', 'kuoreton ja siemenetön'],
  'with pits': ['có hạt', 'kivineen'],
  'without pits': ['không hạt', 'kivetön'],
  'without shell': ['không vỏ', 'kuoreton'],
  'with juice': ['có nước ép', 'mehuineen'],
  'with sauce': ['có sốt', 'kastikkeineen'],
  'with gravy': ['có sốt thịt', 'kastikkeineen'],
  'with onions': ['có hành', 'sipuleineen'],
  'with sauerkraut': ['có dưa cải muối', 'hapankaalineen'],
  'with ham and sauce': ['có giăm bông và sốt', 'kinkun ja kastikkeen kanssa'],
  'with sauce and cheese': ['có sốt và phô mai', 'kastikkeen ja juuston kanssa'],
  'no membranes': ['không màng', 'ilman kalvoja'],
  'regular size': ['cỡ thường', 'tavallinen koko'],
  'inch sub': ['inch sub', 'tuuman subi'], // "6 inch sub": the number stays in front
  'any size': ['cỡ bất kỳ', 'mikä tahansa koko'],
  // Small words.
  or: ['hoặc', 'tai'],
  and: ['và', 'ja'],
  about: ['khoảng', 'noin'],
  approx: ['xấp xỉ', 'noin'],
  to: ['đến', '–'],
  x: ['x', 'x'],
  dia: ['đk', 'halk.'],
  of: ['của', undefined], // only after a fraction ("1/12 of 9" dia"); see servingLabel.ts
};

function buildEntries(): Map<string, Entry> {
  const map = new Map<string, Entry>();
  const nounFor = (key: string, plural: boolean): Noun => {
    const row = NOUN_ROWS[key];
    const noun: Noun = { kind: 'noun', vi: row[0], fi: row[1], fiPart: row[2], fiPl: row[3] ?? row[1], fiPartPl: row[4] ?? row[2] };
    if (plural) noun.plural = true;
    if (MEASURES.has(key)) noun.measure = true;
    return noun;
  };
  for (const key of Object.keys(NOUN_ROWS)) map.set(key, nounFor(key, false));
  for (const [word, key] of Object.entries(PLURAL_OF)) map.set(word, nounFor(key, true));
  for (const [word, key] of Object.entries(ALIAS_OF)) map.set(word, nounFor(key, false));
  for (const [key, row] of Object.entries(ADJ_ROWS)) map.set(key, { kind: 'adj', vi: row[0], fi: row[1], fiPart: row[2] });
  for (const [key, row] of Object.entries(FIXED_ROWS)) map.set(key, { kind: 'fixed', vi: row[0], fi: row[1] });
  map.set('very', { kind: 'adv', vi: 'rất', fi: 'hyvin' });
  map.set('not', { kind: 'adv', vi: 'không', fi: 'ei' });
  return map;
}

export const ENTRIES: ReadonlyMap<string, Entry> = buildEntries();

/** Longest multi-word entry, so the parser can try phrases before single words. */
export const MAX_PHRASE_WORDS = Math.max(...[...ENTRIES.keys()].map((key) => key.split(' ').length));
