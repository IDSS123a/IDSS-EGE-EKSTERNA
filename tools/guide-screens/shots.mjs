/**
 * Screenshot list of the user guide (PDL-031). Each entry: the guide screen (tools/guide-screens/page.tsx, served at
 * /zz-guide/<screen>), the element the step talks about (highlighted in IDSS yellow) and optionally the region to show
 * (`focus`, default: the viewport around the highlight) and elements to click first (`click`, e.g. to open details).
 * Image names match src/features/guide/content.ts (a unit test checks both directions).
 */
const SUBJECTS = { mat: "mathematics", bhs: "bhs_language_literature", deu: "german" };
const card = (heading) => `section:has(> h2:has-text("${heading}"))`;

const shots = [
  // common
  { image: "c-pocetna", path: "/", highlight: 'a:has-text("Prijava")', real: true },
  { image: "c-prijava", path: "/prijava", highlight: "main form", focus: "main", real: true },
  { image: "c-lozinka-mat", path: "/zz-guide/nalog?ime=Haris%20Hamzi%C4%87&korisnik=haris.hamzic@idss.ba", highlight: card("Promjena lozinke") },
  { image: "c-lozinka-bhs", path: "/zz-guide/nalog?ime=Nizama%20Memija&korisnik=nizama.memija@idss.ba", highlight: card("Promjena lozinke") },
  { image: "c-lozinka-deu", path: "/zz-guide/nalog?ime=Nikolina%20Todorovi%C4%87&korisnik=nikolina.todorovic@idss.ba", highlight: card("Promjena lozinke") },
  { image: "c-lozinka-pedagog", path: "/zz-guide/nalog?ime=Adnana%20Agi%C4%87&korisnik=pedagog@idss.ba", highlight: card("Promjena lozinke") },
  { image: "c-lozinka-psiholog", path: "/zz-guide/nalog?ime=Medina%20Karaga&korisnik=psiholog@idss.ba", highlight: card("Promjena lozinke") },
  { image: "c-lozinka-direktor", path: "/zz-guide/nalog?ime=Davor%20Mulali%C4%87&korisnik=direktor@idss.ba", highlight: card("Promjena lozinke") },

  // student
  { image: "s-lozinka", path: "/zz-guide/nalog?ime=Lana%20Begi%C4%87&korisnik=lana.begic&min=10", highlight: card("Promjena lozinke") },
  { image: "s-hub", path: "/zz-guide/hub", highlight: "h1", focus: "main", maxHeight: 1500 },
  { image: "s-predmet", path: "/zz-guide/predmet", highlight: "main ul, main table, main .hub-subjects", focus: "main" },
  { image: "s-vjezba", path: "/zz-guide/vjezba", highlight: "main form", focus: "main" },
  { image: "s-rezultat", path: "/zz-guide/vjezba-rezultat", highlight: ".practice-feedback", focus: "main" },
  { image: "s-misija", path: "/zz-guide/hub", highlight: 'section:has(h2:has-text("Dnevna misija"))' },
  { image: "s-zadaci", path: "/zz-guide/hub", highlight: 'section:has(h2:has-text("Zadaci nastavnika"))' },
  { image: "s-zadatak", path: "/zz-guide/vjezba-zadatak", highlight: ".form__hint >> nth=0", focus: "main" },
  { image: "s-ispiti", path: "/zz-guide/ispiti", highlight: ".hub-subjects", focus: "main" },
  { image: "s-ispit-ceka", path: "/zz-guide/ispit-ceka", highlight: ".notice[role=status]", focus: "main" },
  { image: "s-ispit-pocetak", path: "/zz-guide/ispit-pocetak", highlight: 'button:has-text("Počni ispit")', focus: "main" },
  { image: "s-ispit-pisanje", path: "/zz-guide/ispit-pisanje", highlight: 'button:has-text("Predaj ispit")', focus: "main", maxHeight: 1400 },
  { image: "s-ispit-rezultat", path: "/zz-guide/ispit-rezultat", highlight: 'section:has(h2:has-text("Rezultat"))', focus: "main", maxHeight: 1400 },
  { image: "s-obavijesti", path: "/zz-guide/hub", highlight: 'section:has(h2:has-text("Obavijesti"))' },
  { image: "s-bodovi", path: "/zz-guide/hub", highlight: 'section:has(h2:has-text("IDSS bodovi"))' },
  { image: "s-vitrina", path: "/zz-guide/vitrina", highlight: "main section >> nth=0", focus: "main", wait: 2500 },

  // pedagogue, psychologist
  { image: "p-pocetna-pedagog", path: "/zz-guide/pocetna-podrska?ime=Adnana%20Agi%C4%87", highlight: ".link-row", focus: "main" },
  { image: "p-pocetna-psiholog", path: "/zz-guide/pocetna-podrska?ime=Medina%20Karaga", highlight: ".link-row", focus: "main" },
  { image: "p-pracenje", path: "/zz-guide/pracenje", highlight: "main section:has(table) >> nth=-1", focus: "main", maxHeight: 1400 },
  { image: "p-filteri", path: "/zz-guide/pracenje", highlight: 'section:has(label:has-text("Bez vježbe zadnjih N dana"))' },
  { image: "p-koraci", path: "/zz-guide/pracenje", highlight: 'section:has(h2:has-text("Dogovoreni"))' },
  { image: "p-profil", path: "/zz-guide/profil", highlight: ".support-dimensions >> nth=0", maxHeight: 1100 },
  { image: "p-oblasti", path: "/zz-guide/profil", highlight: "main details >> nth=0" },
  { image: "p-ispiti", path: "/zz-guide/profil", highlight: 'h3:has-text("Probni ispiti") >> nth=0 >> xpath=following-sibling::*[1]' },
  { image: "p-biljeske-nastavnika", path: "/zz-guide/profil", highlight: 'div:has(> h3:has-text("Bilješke nastavnika"))' },
  { image: "p-biljeska-pedagog", path: "/zz-guide/profil?uloga=pedagog", highlight: 'section:has(h2:has-text("Bilješke podrške")) form' },
  { image: "p-biljeska-psiholog", path: "/zz-guide/profil?uloga=psiholog", highlight: 'section:has(h2:has-text("Bilješke podrške")) form' },
  { image: "p-biljeske", path: "/zz-guide/profil?uloga=pedagog", highlight: 'section:has(h2:has-text("Bilješke podrške")) ul, section:has(h2:has-text("Bilješke podrške")) ol' },
  { image: "p-analiza", path: "/zz-guide/analiza", highlight: "main section >> nth=0", focus: "main", maxHeight: 1300 },
  { image: "p-dan", path: "/zz-guide/dan?uloga=podrska", highlight: "main section >> nth=1", focus: "main", maxHeight: 1300 },
  { image: "p-stampa", path: "/zz-guide/pracenje", highlight: 'button:has-text("Štampaj"), a:has-text("Izvoz CSV")' },

  // director
  { image: "d-pocetna", path: "/zz-guide/pocetna-direktor", highlight: ".link-row", focus: "main" },
  ...["pregled", "predmeti", "nastavnici", "sadrzaj", "sistem", "dnevnik"].map((tab) => ({ image: `d-${tab}`, path: `/zz-guide/direktor?tab=${tab}`, highlight: "nav.director-tabs a[aria-current=page]", focus: "main", maxHeight: 1300 })),
  { image: "d-novi-nalog", path: "/zz-guide/nalozi", highlight: 'section:has(h2:has-text("Novi nalog"))' },
  { image: "d-nalozi", path: "/zz-guide/nalozi", highlight: 'section:has(h2:has-text("Nalozi"))' },
  { image: "d-postavke", path: "/zz-guide/postavke", highlight: "main form >> nth=1", focus: "main", maxHeight: 1300 },
  { image: "d-ocjenjivanje", path: "/zz-guide/ocjenjivanje?predmet=mathematics&potvrdjen=1", highlight: 'a:has-text("Pošalji test")', focus: "main", maxHeight: 1200 },
];

for (const [s, code] of Object.entries(SUBJECTS)) {
  const q = `predmet=${code}`;
  shots.push(
    { image: `t-pocetna-${s}`, path: `/zz-guide/pocetna-nastavnik?${q}`, highlight: ".link-row", focus: "main" },
    { image: `t-plan-${s}`, path: `/zz-guide/ocjenjivanje?${q}`, highlight: ".hub-subject", click: ".hub-subject details >> nth=0 >> summary", maxHeight: 1300 },
    { image: `t-potvrda-${s}`, path: `/zz-guide/ocjenjivanje?${q}`, highlight: 'button:has-text("Potvrdi plan")' },
    { image: `t-pracenje-${s}`, path: `/zz-guide/pracenje-nastavnik?${q}`, highlight: "main section:has(table) >> nth=-1", focus: "main", maxHeight: 1400 },
    { image: `t-profil-${s}`, path: `/zz-guide/profil-nastavnik?${q}`, highlight: "details >> nth=0 >> table" },
    { image: `t-biljeska-${s}`, path: `/zz-guide/profil-nastavnik?${q}`, highlight: 'div:has(> h3:has-text("Bilješke nastavnika"))' },
    { image: `t-poklon-${s}`, path: `/zz-guide/profil-nastavnik?${q}`, highlight: 'section:has(h2:has-text("Posebni pokloni"))' },
    { image: `t-dan-${s}`, path: `/zz-guide/dan?${q}`, highlight: "main section >> nth=1", focus: "main", maxHeight: 1300 },
    { image: `t-zadaci-${s}`, path: `/zz-guide/zadaci?${q}`, highlight: 'section:has(h2:has-text("Novi zadatak"))' },
    { image: `t-zadaci-lista-${s}`, path: `/zz-guide/zadaci?${q}`, highlight: 'section:has(h2:has-text("Zadani zadaci"))' },
    { image: `t-zadatak-${s}`, path: `/zz-guide/zadatak?${q}`, highlight: "table >> nth=-1", focus: "main", maxHeight: 1300 },
    { image: `t-posalji-${s}`, path: `/zz-guide/posalji?${q}`, highlight: "main form fieldset >> nth=0" },
    { image: `t-pozicije-${s}`, path: `/zz-guide/posalji?${q}`, highlight: "main form", click: 'main label:has-text("Dio testa") input', check: ["form fieldset.assignment-students input >> nth=0", "form fieldset.assignment-students input >> nth=1"], fill: { "#send-minutes": "20" }, maxHeight: 1300 },
    { image: `t-poslani-${s}`, path: `/zz-guide/posalji?${q}`, highlight: 'section:has(h2:has-text("Poslani testovi"))', click: 'section:has(h2:has-text("Poslani testovi")) summary' },
    { image: `t-red-${s}`, path: `/zz-guide/ocjenjivanje?${q}&potvrdjen=1`, highlight: 'section:has(h2:has-text("Setovi koji čekaju odobrenje"))', focus: "main", maxHeight: 1200 },
    { image: `t-set-${s}`, path: `/zz-guide/set-odobrenje?${q}`, highlight: 'button:has-text("Odobri set")', focus: "main", maxHeight: 1400 },
    { image: `t-odbaci-${s}`, path: `/zz-guide/set-odobrenje?${q}`, highlight: 'details:has(summary:has-text("Odbaci set"))', click: 'summary:has-text("Odbaci set")' },
    { image: `t-ocjena-${s}`, path: `/zz-guide/ocjenjivanje-ispita?${q}`, highlight: "select >> nth=0", focus: "main", maxHeight: 1400 },
    { image: `t-potvrdi-${s}`, path: `/zz-guide/ocjenjivanje-ispita?${q}`, highlight: 'button:has-text("Potvrdi rezultat")' },
    { image: `t-vjezba-${s}`, path: `/zz-guide/odgovori-vjezba?${q}`, highlight: "main form >> nth=0", focus: "main", maxHeight: 1300 },
    { image: `t-pregled-${s}`, path: `/zz-guide/pregled?${q}`, highlight: "main ul, main table >> nth=0", focus: "main", maxHeight: 1300 },
  );
}

export default shots;
