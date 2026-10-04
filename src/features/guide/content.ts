import type { SubjectCode } from "@/features/knowledge/types";

/**
 * Personal user guide (PDL-031): one guide per participant, chosen by the signed-in account (role, subjects, bundles).
 * Every step has a screenshot of the real screen (tools/guide-screens, public/guide/<image>.webp). Text marks screen
 * labels as **label**; the labels are the app's own Bosnian labels. Bosnian only for now (Director's language).
 */
export type GuideKind = "student" | "teacher" | "pedagogue" | "psychologist" | "director";
export type GuideStep = { title: string; text: string; image: string };
export type GuideSection = { id: string; title: string; intro?: string; steps: GuideStep[] };
export type Guide = { kind: GuideKind; title: string; intro: string; sections: GuideSection[] };
export type GuideReader = { kind: GuideKind; name: string; username: string | null; subjects: SubjectCode[] };

/** Public path of a guide screenshot. */
export const guideImage = (image: string) => `/guide/${image}.webp`;

const SUBJECT_NAMES: Record<SubjectCode, string> = { bhs_language_literature: "B/H/S jezik i književnost", mathematics: "Matematika", german: "Njemački jezik" };
const SUBJECT_SHORT: Record<SubjectCode, string> = { bhs_language_literature: "bhs", mathematics: "mat", german: "deu" };

const step = (title: string, text: string, image: string): GuideStep => ({ title, text, image });

function firstDay(reader: GuideReader, lozinka: string, home: GuideStep): GuideSection {
  const student = reader.kind === "student";
  const login = reader.username
    ? `U polje **Korisničko ime** upišite **${reader.username}**.`
    : student
      ? "U polje **Korisničko ime** upiši korisničko ime koje ti je dala škola (bez e-maila)."
      : "U polje **Korisničko ime** upišite svoju službenu e-mail adresu (npr. ime.prezime@idss.ba).";
  return {
    id: "prvi-dan",
    title: student ? "Prvi dan" : "Prvi dan: prijava i lozinka",
    steps: [
      step(student ? "Otvori aplikaciju" : "Otvorite aplikaciju", student
        ? "Upiši adresu aplikacije u preglednik (radi na računaru, tabletu i mobitelu). Pri prvom otvaranju kratko se prikaže uvodni ekran. Klikni **Prijava**."
        : "Upišite adresu aplikacije u preglednik (Chrome, Edge, Safari ili Firefox; radi i na tabletu i mobitelu). Pri prvom otvaranju kratko se prikaže uvodni ekran. Kliknite **Prijava**.", "c-pocetna"),
      step(student ? "Prijavi se" : "Prijavite se", `${login} ${student ? "Upiši lozinku koju ti je dala škola i klikni" : "Upišite lozinku koju ste dobili od škole i kliknite"} **Prijavi se**. Nakon pet pogrešnih pokušaja u 15 minuta prijava se privremeno blokira; ${student ? "sačekaj" : "sačekajte"} 15 minuta.`, "c-prijava"),
      step(student ? "Promijeni lozinku" : "Promijenite lozinku", `${student ? "Na početnoj stranici klikni" : "Kliknite"} **Moj nalog**. U dijelu **Promjena lozinke** ${student ? "upiši" : "upišite"} **Trenutna lozinka**, zatim dva puta novu lozinku i ${student ? "klikni" : "kliknite"} **Promijeni lozinku**. Lozinka koja se pojavila u poznatim curenjima podataka se odbija.`, lozinka),
      home,
    ],
  };
}

// ---------------------------------------------------------------- student
function studentGuide(reader: GuideReader): Guide {
  return {
    kind: "student",
    title: "Uputstvo za učenike",
    intro: `Zdravo${reader.name ? `, ${reader.name}` : ""}! Ovdje je sve što ti treba za pripremu eksterne mature iz B/H/S jezika i književnosti, Matematike i Njemačkog jezika. Svi zadaci i rješenja su iz službenih ispitnih kataloga, tačno kako su štampani.`,
    sections: [
      firstDay(reader, "s-lozinka", step("Tvoja početna stranica", "Na početnoj stranici su obavijesti, niz dana vježbanja, dnevna misija, tvoja vitrina, zadaci nastavnika, IDSS bodovi i značke, probni ispit i tvoji predmeti.", "s-hub")),
      {
        id: "vjezba",
        title: "Vježba",
        steps: [
          step("Izaberi predmet i oblast", "Na početnoj stranici, kod predmeta, klikni **Vježbaj** za cijeli predmet ili otvori predmet i izaberi oblast. Uz svaku oblast vidiš koliko si pitanja odgovorio i koliko tačno.", "s-predmet"),
          step("Odgovori na pitanje", "Pitanje je prikazano tačno kako je štampano u katalogu. Izaberi odgovor ili ga napiši i klikni **Predaj odgovor**. Vježba nema vremensko ograničenje.", "s-vjezba"),
          step("Pogledaj rješenje", "Nakon odgovora vidiš da li je tačno i službeno rješenje iz kataloga. Otvorene zadatke pregleda nastavnik. Klikni **Sljedeće pitanje** za novo pitanje.", "s-rezultat"),
          step("Dnevna misija i niz dana", "Svaki dan riješi zadani broj zadataka i ispuni **Dnevnu misiju**. Ako vježbaš više dana zaredom, raste tvoj niz dana vježbanja.", "s-misija"),
        ],
      },
      {
        id: "zadaci",
        title: "Zadaci nastavnika",
        steps: [
          step("Kartica Zadaci nastavnika", "Kad ti nastavnik zada zadatak, vidiš ga na početnoj stranici: naziv, predmet, rok, ko ga je zadao i koliko si odgovorio. Klikni **Nastavi zadatak**.", "s-zadaci"),
          step("Rješavanje zadatka", "Pitanja zadatka rješavaš jedno za drugim, kao u vježbi. Gore piše koliko si već odgovorio. Zadatak je završen kad odgovoriš na sva pitanja.", "s-zadatak"),
        ],
      },
      {
        id: "probni-ispit",
        title: "Probni ispit",
        intro: "Probni ispit ima isti broj zadataka, bodove i trajanje kao eksterna matura. Nastavnik ti može poslati i cijeli test ili samo dio testa.",
        steps: [
          step("Probni ispiti", "Na početnoj stranici klikni **Probni ispiti**. Kod predmeta klikni **Zatraži probni ispit**, ili otvori test koji ti je poslao nastavnik.", "s-ispiti"),
          step("Čekanje na odobrenje", "Nastavnik prvo pregleda i odobri tvoj set zadataka. Dok čekaš, zadatke još ne vidiš. Kad nastavnik odobri set, dobiješ obavijest.", "s-ispit-ceka"),
          step("Početak ispita", "Prije početka vidiš koliko imaš vremena, koliko bodova možeš osvojiti i poruku nastavnika. Klikni **Počni ispit**; vrijeme počinje teći odmah.", "s-ispit-pocetak"),
          step("Pisanje", "Gore je **Preostalo vrijeme** i koliko si zadataka odgovorio. Odgovori se spremaju sami. Kad završiš, klikni **Predaj ispit**. Kad vrijeme istekne, ispit se predaje sam.", "s-ispit-pisanje"),
          step("Rezultat", "Kad nastavnik ocijeni ispit, dobiješ obavijest i vidiš bodove po zadatku, službeno rješenje i napomene nastavnika.", "s-ispit-rezultat"),
        ],
      },
      {
        id: "motivacija",
        title: "Obavijesti, IDSS bodovi i vitrina",
        steps: [
          step("Obavijesti", "Na vrhu početne stranice su obavijesti: novi test, zadatak, ocijenjen ispit ili poklon. Klik na obavijest otvara ono na što se odnosi.", "s-obavijesti"),
          step("IDSS bodovi i značke", "Za vježbu, dnevne misije i probne ispite dobijaš IDSS bodove i značke. Oni su za motivaciju; nisu ocjena i ne mijenjaju bodove na ispitu.", "s-bodovi"),
          step("Moja vitrina", "Nastavnik ti može poslati poseban poklon s porukom. Otvaraš ga u **Moja vitrina** na početnoj stranici.", "s-vitrina"),
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------- teacher
function subjectPlanText(code: SubjectCode): string {
  switch (code) {
    case "mathematics":
      return "Matematika ima deset pozicija po jedan bod: pozicije 1 do 4 osnovni nivo (zadaci 1 do 5 svake oblasti), 5 do 8 srednji (6 do 15), 9 i 10 napredni (16 do 20). Katalog ne propisuje oblast po poziciji, pa svaka pozicija uzima zadatke iz svih oblasti.";
    case "bhs_language_literature":
      return "B/H/S ima 18 pozicija: 12 izbora odgovora i 4 dopunjavanja po 0,5 boda i 2 povezivanja po 1 bod. Povezivanje se ocjenjuje brojem tačnih parova po službenom pravilu (2 ili 3 para 0,5 boda, 4 para 1 bod).";
    default:
      return "Njemački jezik ima pet pozicija po 2 boda, ocjenjuju se pojedine stavke zadatka. Pitanja koja se odnose na slušanje prikazuju službeni transkript.";
  }
}

function teacherSubject(code: SubjectCode): GuideSection[] {
  const s = SUBJECT_SHORT[code];
  const name = SUBJECT_NAMES[code];
  return [
    {
      id: `plan-${s}`,
      title: `Plan ispita: ${name}`,
      intro: "Plan ispita kaže koje zadatke iz kataloga aplikacija smije staviti na koju poziciju probnog ispita i koliko bodova nose. Dok plan nije potvrđen, probni ispit iz predmeta nije dostupan.",
      steps: [
        step("Otvorite plan", `Na početnoj stranici kliknite **Probni ispiti: ocjenjivanje** i spustite se do **Planovi ispita**. Otvorite **Pozicije** i uporedite ih sa službenim testovima. ${subjectPlanText(code)}`, `t-plan-${s}`),
        step("Potvrdite plan", "Ako plan odgovara službenim testovima i katalogu, kliknite **Potvrdi plan**. Ako ne odgovara, upišite napomenu i kliknite **Odbij plan**. Odluku možete kasnije promijeniti.", `t-potvrda-${s}`),
      ],
    },
    {
      id: `pracenje-${s}`,
      title: "Praćenje učenika",
      steps: [
        step("Pregled svih učenika", "Kliknite **Praćenje učenika**. Za svakog učenika vidite zadnju aktivnost, dane vježbe, savladana pitanja, tačnost, zadnje probne ispite i spremnost, samo za vaš predmet. Filtere i redoslijed birate sami.", `t-pracenje-${s}`),
        step("Profil učenika i slabe oblasti", "Klik na ime otvara profil. Oblasti kataloga su poredane od najslabije. Kod svake oblasti su prečice **Zadaj vježbu iz ove oblasti** i **Pošalji dio testa**: forma se otvori s učenikom i oblasti već izabranim.", `t-profil-${s}`),
        step("Bilješka nastavnika", "U dijelu svog predmeta upišite akademsku bilješku (npr. šta treba ponoviti) i kliknite **Sačuvaj bilješku nastavnika**. Vide je nastavnici predmeta, pedagog, psiholog i direktor; učenik je ne vidi.", `t-biljeska-${s}`),
        step("Poseban poklon", "Na dnu profila izaberite poklon, upišite poruku i kliknite **Pošalji poklon**. Poklon je priznanje, ne ocjena; učenik ga otvara u svojoj vitrini.", `t-poklon-${s}`),
        step("Dnevni sažetak", "Dugme **Dnevni sažetak** pokazuje ko je jučer vježbao, ko nije i od kada, oblasti dana od najniže tačnosti i šta čeka vašu ocjenu.", `t-dan-${s}`),
      ],
    },
    {
      id: `zadaci-${s}`,
      title: "Zadaci za učenike",
      steps: [
        step("Novi zadatak", "Kliknite **Zadaci za učenike**. Upišite naziv i rok, izaberite **Pitanja koja ja biram** (oznake iz kataloga) ili **Pitanja iz oblasti koja bira aplikacija**, zatim svim učenicima ili izabranim, i kliknite **Zadaj zadatak**. Učenici dobiju obavijest.", `t-zadaci-${s}`),
        step("Stanje zadataka", "U listi **Zadani zadaci** vidite koliko je učenika u toku, završilo u roku, nakon roka ili propustilo rok.", `t-zadaci-lista-${s}`),
        step("Detalji zadatka", "Klik na zadatak pokazuje pitanja i svakog učenika: koliko je odgovorio, koliko tačno i kada je završio. Tabelu možete štampati ili izvesti u CSV.", `t-zadatak-${s}`),
      ],
    },
    {
      id: `posalji-${s}`,
      title: "Pošalji test",
      intro: "Vi šaljete cijeli probni ispit ili samo dio testa grupi ili pojedinim učenicima. Učenici i dalje mogu sami zatražiti probni ispit.",
      steps: [
        step("Cijeli test ili dio testa", "U **Probni ispiti: ocjenjivanje** kliknite **Pošalji test**. Izaberite predmet i **Cijeli test** (vrijeme i bodovi po katalogu) ili **Dio testa**.", `t-posalji-${s}`),
        step("Pozicije, vrijeme i učenici", "Za dio testa označite pozicije službenog testa i upišite **Vrijeme za izradu**. Izaberite sve učenike ili pojedine, po želji upišite poruku i kliknite **Složi setove**. Dio testa ne daje pokazatelj spremnosti ni značku za cijeli ispit; IDSS bodovi za odgovore ostaju.", `t-pozicije-${s}`),
        step("Poslani testovi", "Ispod forme je lista **Poslani testovi** sa stanjem seta svakog učenika. Klik na ime otvara set.", `t-poslani-${s}`),
      ],
    },
    {
      id: `odobravanje-${s}`,
      title: "Odobravanje seta",
      intro: "Svaki set, i onaj koji je učenik zatražio i onaj koji ste vi poslali, učenik vidi tek kad ga odobrite.",
      steps: [
        step("Setovi koji čekaju odobrenje", "Na stranici **Probni ispiti: ocjenjivanje** je lista **Setovi koji čekaju odobrenje**. Uz test piše da li je cijeli test ili dio testa i da li ste ga vi poslali. Na vrhu su vaše obavijesti.", `t-red-${s}`),
        step("Pregled i odobrenje", "Otvorite set. Vidite svaki zadatak kako je štampan i službeno rješenje. Kliknite **Odobri set**; učenik tada dobije obavijest i može početi.", `t-set-${s}`),
        step("Odbacivanje seta", "Ako set ne odgovara, otvorite **Odbaci set**, upišite razlog i po želji ostavite uključeno **Odmah sastavi novi set za istog učenika**.", `t-odbaci-${s}`),
      ],
    },
    {
      id: `ocjenjivanje-${s}`,
      title: "Ocjenjivanje",
      steps: [
        step("Bodovi po zadatku", "Predani ispit otvorite iz liste **Predani ispiti za ocjenjivanje**. Uz svaki odgovor je službeno rješenje; zadaci izbora imaju prijedlog bodova. Izaberite **Bodovi**, po želji **Napomena za učenika**, i kliknite **Sačuvaj bodove**.", `t-ocjena-${s}`),
        step("Potvrda rezultata", "Kad su svi zadaci ocijenjeni, kliknite **Potvrdi rezultat**. Učenik tada vidi bodove, rješenja i napomene; rezultat se više ne mijenja.", `t-potvrdi-${s}`),
        step("Odgovori iz vježbe", "Otvorene zadatke iz vježbe ocjenjujete u **Odgovori iz vježbe koji čekaju nastavnika**: **Tačno**, **Djelimično tačno** ili **Netačno**, pa **Sačuvaj ocjenu**. Ova ocjena se računa samo u napretku iz vježbe.", `t-vjezba-${s}`),
      ],
    },
    {
      id: `pregled-${s}`,
      title: "Pregled pitanja i greške u katalogu",
      steps: [
        step("Pregled pitanja i pravila", `Kliknite **Pregled pitanja i pravila**. Lista zapisa iz kataloga ima filtere i pretragu po oznaci.${code === "german" ? " Šest pitanja njemačkog čeka vaš pregled, a za DEU-4.3.34 je upisana greška u katalogu." : ""} Zapis se otvara pored izvorne stranice kataloga; prihvatate ga ili vraćate s razlogom. Grešku u katalogu upisujete s opisom i dokazom; zadatak i službeno rješenje se ne mijenjaju.`, `t-pregled-${s}`),
      ],
    },
  ];
}

function teacherGuide(reader: GuideReader): Guide {
  const subjects = reader.subjects.length > 0 ? reader.subjects : (["mathematics"] as SubjectCode[]);
  const s = SUBJECT_SHORT[subjects[0]];
  return {
    kind: "teacher",
    title: `Uputstvo za nastavnike: ${subjects.map((code) => SUBJECT_NAMES[code]).join(", ")}`,
    intro: `${reader.name ? `${reader.name}, v` : "V"}i ste vlasnik pripreme učenika u svom predmetu: pratite napredak svakog učenika, zadajete vježbu, šaljete cijeli test ili dio testa gdje je učenik slabiji, odobravate svaki test i ocjenjujete. Vidite i mijenjate samo svoj predmet; to provjerava server i baza.`,
    sections: [
      firstDay(reader, `c-lozinka-${s}`, step("Vaša početna stranica", "Na početnoj stranici su dugmad za sve što radite: **Praćenje učenika**, **Dnevni sažetak**, **Zadaci za učenike**, **Probni ispiti: ocjenjivanje**, **Pregled pitanja i pravila**, **Moj nalog**. Gore desno birate jezik (BS, DE, EN) i **Odjava**.", `t-pocetna-${s}`)),
      ...subjects.flatMap(teacherSubject),
    ],
  };
}

// ---------------------------------------------------------------- pedagogue and psychologist
function supportGuide(reader: GuideReader, kind: "pedagogue" | "psychologist"): Guide {
  const p = kind === "pedagogue" ? "pedagog" : "psiholog";
  const visibility = kind === "pedagogue"
    ? "Vaše bilješke po zadanom vidi i psiholog (**Pedagog i psiholog**); možete izabrati i **Samo ja**."
    : "Vaše bilješke su po zadanom **Samo ja**; možete izabrati i **Pedagog i psiholog**.";
  return {
    kind,
    title: kind === "pedagogue" ? "Uputstvo za pedagoga" : "Uputstvo za psihologa",
    intro: `${reader.name ? `${reader.name}, v` : "V"}i pratite rad svih učenika u sva tri predmeta. Aplikacija pokazuje izmjerene činjenice iz vježbe i probnih ispita, bez oznaka o učeniku; zaključke donosite vi. Svako otvaranje profila učenika bilježi se u dnevnik pristupa.`,
    sections: [
      firstDay(reader, `c-lozinka-${p}`, step("Vaša početna stranica", "Na početnoj stranici su **Praćenje učenika**, **Dnevni sažetak** i **Moj nalog**. Gore desno birate jezik i **Odjava**.", `p-pocetna-${p}`)),
      {
        id: "pracenje",
        title: "Praćenje učenika",
        steps: [
          step("Tabela učenika", "Kliknite **Praćenje učenika**. Za svakog učenika: zadnja aktivnost, dani vježbe (7 i 30 dana) i po predmetu savladano, tačnost u zadnjih 30 dana, zadnji ocijenjeni ispit, šta čeka nastavnika i spremnost.", "p-pracenje"),
          step("Filteri", "**Predmet**, **Bez vježbe zadnjih N dana** (broj upisujete vi), **Zadnji probni ispit slabiji od prethodnog** i **Poredaj po**. Tako brzo vidite ko je zastao.", "p-filteri"),
          step("Dogovoreni sljedeći koraci", "Na vrhu su datumi sljedećih koraka iz vaših bilješki (i zajedničkih bilješki), od jučer nadalje.", "p-koraci"),
        ],
      },
      {
        id: "profil",
        title: "Profil učenika",
        steps: [
          step("Pokazatelji po predmetu", "Klik na ime otvara profil: kalendar aktivnosti, dani vježbanja, ispunjene misije i po predmetu **Obuhvat**, **Tačnost**, **Savladanost**, **Probni ispiti** i **Spremnost** (interni pokazatelj IDSS-a, nije službena procjena).", "p-profil"),
          step("Oblasti i ponovljene greške", "Oblasti kataloga su poredane od najniže tačnosti. **Ponovljene greške** su pitanja odgovorena pogrešno bar dva puta, a zadnji odgovor je i dalje netačan.", "p-oblasti"),
          step("Probni ispiti, zadaci i pokloni", "Tabela probnih ispita pokazuje bodove i promjenu prema prethodnom ispitu iste vrste, vrijeme i zadatke bez odgovora. Ispod su zadaci nastavnika i posebni pokloni učenika.", "p-ispiti"),
          step("Bilješke nastavnika", "Akademske bilješke nastavnika vidite u dijelu svakog predmeta i možete upisati svoju. Učenik ih ne vidi.", "p-biljeske-nastavnika"),
        ],
      },
      {
        id: "biljeske",
        title: "Bilješke podrške",
        steps: [
          step("Nova bilješka", `Na dnu profila izaberite **Vrsta**, **Datum sljedećeg koraka** i **Ko vidi**, upišite bilješku i kliknite **Sačuvaj bilješku**. ${visibility} Bilješke podrške ne vide nastavnici, učenici ni direktor i ne idu u štampu ni u izvoz.`, `p-biljeska-${p}`),
          step("Upisane bilješke", "Upisana bilješka se ne mijenja; ispravka se upisuje kao nova bilješka. Pišite činjenice i dogovore, ne procjene ličnosti.", "p-biljeske"),
        ],
      },
      {
        id: "analiza",
        title: "Analiza grupe, dnevni sažetak, štampa",
        steps: [
          step("Analiza grupe", "**Analiza grupe** pokazuje aktivnost po sedmicama, tačnost po oblastima, raspodjelu bodova probnih ispita i najčešće pogrešna pitanja. Samo zbirni podaci, bez imena i bez rangiranja.", "p-analiza"),
          step("Dnevni sažetak", "**Dnevni sažetak** pokazuje za jedan dan i svaki predmet ko je vježbao, ko nije i od kada, i oblasti dana od najniže tačnosti.", "p-dan"),
          step("Štampa i izvoz", "**Štampaj ili sačuvaj PDF** štampa u IDSS formatu, **Izvoz CSV** preuzima tabelu za tabelarni program. Bilješke podrške nisu u izvozu.", "p-stampa"),
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------- director
function directorGuide(reader: GuideReader): Guide {
  return {
    kind: "director",
    title: "Uputstvo za direktora",
    intro: `${reader.name ? `${reader.name}, v` : "V"}i ste superadministrator: vidite cijelu školu, upravljate nalozima i postavkama i imate sva prava nastavnika u sva tri predmeta. Uputstva svih drugih učesnika možete otvoriti i odštampati ovdje, izborom iznad.`,
    sections: [
      firstDay(reader, "c-lozinka-direktor", step("Vaša početna stranica", "Na početnoj stranici su **Upravljanje nalozima**, **Direktorski pregled**, **Registar kanonskih dokumenata**, **Praćenje učenika**, **Dnevni sažetak**, **Zadaci za učenike**, **Probni ispiti: ocjenjivanje**, **Pregled pitanja i pravila**, **Postavke** i **Moj nalog**.", "d-pocetna")),
      {
        id: "direktorski-pregled",
        title: "Direktorski pregled",
        intro: "Šest kartica sa stanjem škole. Podaci iz manje grupe učenika od zadanog najmanjeg broja prikazuju se kao \"premalo učenika\". Svaka kartica se štampa u IDSS formatu.",
        steps: [
          step("Pregled", "Aktivni učenici, ko je vježbao, odgovori po sedmicama, probni ispiti, zadaci i pokloni u izabranom periodu (7, 30, 90 dana ili školska godina).", "d-pregled"),
          step("Predmeti", "Po predmetu: provjerena pitanja, obuhvat, tačnost, spremnost i raspodjela bodova probnih ispita.", "d-predmeti"),
          step("Nastavnici", "Rad svakog nastavnika: pregledana pitanja, odobreni setovi, ocijenjeni ispiti, zadaci, pokloni, bilješke i šta čeka.", "d-nastavnici"),
          step("Sadržaj", "Stanje kataloga po predmetu: prihvaćeni i vraćeni zapisi, greške u katalogu, naknadni pregledi, plan ispita i najčešće pogrešna pitanja.", "d-sadrzaj"),
          step("Sistem", "Tehničko stanje: obavijesti, push obavijesti, sigurnosni događaji, indeks pretrage i izvršene migracije.", "d-sistem"),
          step("Dnevnik", "Svaka važna radnja s vremenom i osobom; filtriranje po radnji, osobi i datumu, izvoz u CSV.", "d-dnevnik"),
        ],
      },
      {
        id: "nalozi",
        title: "Upravljanje nalozima",
        steps: [
          step("Novi nalog", "Kliknite **Upravljanje nalozima**. U **Novi nalog** upišite korisničko ime (osoblje: službena e-mail adresa; učenik: npr. ime.prezime), ime i prezime, ulogu i početnu lozinku, pa **Kreiraj nalog**. Lozinku lično predajte korisniku.", "d-novi-nalog"),
          step("Status, prava i lozinka", "U listi **Nalozi** mijenjate status (npr. suspendovan, deaktiviran), dodjeljujete prava (pedagog, psiholog, predmetni nastavnik s predmetom) i postavljate novu lozinku. Svaka promjena se bilježi.", "d-nalozi"),
        ],
      },
      {
        id: "postavke",
        title: "Postavke",
        steps: [
          step("Postavke aplikacije", "U **Postavke** mijenjate dnevnu misiju, najmanju grupu učenika za prikaz, IDSS bodove i značke i boje uvodnog ekrana. Pravila ispita, trajanje i bodovanje dolaze iz kataloga i nisu postavke.", "d-postavke"),
        ],
      },
      {
        id: "kao-nastavnik",
        title: "Rad u predmetima",
        steps: [
          step("Sve što radi nastavnik", "Imate sva prava nastavnika u sva tri predmeta: plan ispita, odobravanje i ocjenjivanje, zadaci, slanje testova i pregled pitanja. Korake opisuje uputstvo za nastavnike, koje otvarate izborom iznad.", "d-ocjenjivanje"),
          step("Praćenje učenika", "Vidite praćenje kao pedagog i psiholog, ali ne i njihove bilješke podrške.", "p-pracenje"),
        ],
      },
    ],
  };
}

/** The guide of one reader. */
export function buildGuide(reader: GuideReader): Guide {
  switch (reader.kind) {
    case "student":
      return studentGuide(reader);
    case "teacher":
      return teacherGuide(reader);
    case "pedagogue":
    case "psychologist":
      return supportGuide(reader, reader.kind);
    default:
      return directorGuide(reader);
  }
}

/** Guides the Director can open and print for others (key used in ?vodic=). */
export const GUIDE_CHOICES: { key: string; label: string; reader: GuideReader }[] = [
  { key: "ucenik", label: "Učenik", reader: { kind: "student", name: "", username: null, subjects: [] } },
  { key: "nastavnik-bhs", label: "Nastavnik: B/H/S jezik i književnost", reader: { kind: "teacher", name: "", username: null, subjects: ["bhs_language_literature"] } },
  { key: "nastavnik-mat", label: "Nastavnik: Matematika", reader: { kind: "teacher", name: "", username: null, subjects: ["mathematics"] } },
  { key: "nastavnik-deu", label: "Nastavnik: Njemački jezik", reader: { kind: "teacher", name: "", username: null, subjects: ["german"] } },
  { key: "pedagog", label: "Pedagog", reader: { kind: "pedagogue", name: "", username: null, subjects: [] } },
  { key: "psiholog", label: "Psiholog", reader: { kind: "psychologist", name: "", username: null, subjects: [] } },
  { key: "direktor", label: "Direktor", reader: { kind: "director", name: "", username: null, subjects: [] } },
];

/** Every screenshot the guides use (checked against public/guide by a unit test). */
export function allGuideImages(): string[] {
  const images = new Set<string>();
  for (const choice of GUIDE_CHOICES) for (const section of buildGuide(choice.reader).sections) for (const entry of section.steps) images.add(entry.image);
  return [...images].sort();
}
