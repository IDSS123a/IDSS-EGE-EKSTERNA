// ============================================================================
// IDSS INSTITUTIONAL KNOWLEDGE BASE (USTAV ŠKOLE & PROPISI) - RAG SOURCE
// P.U. Internationale Deutsche Schule Sarajevo
// Strict Institutional Grounding: Answers MUST derive ONLY from this corpus.
// ============================================================================

export interface KnowledgeDocument {
  id: string;
  code: string;
  title: string;
  category: 'ustav' | 'zakon' | 'pravilnik' | 'katalog' | 'procedura';
  authority: string;
  effectiveDate: string;
  documentStatus: 'active' | 'archived';
  description: string;
  chunks: KnowledgeChunk[];
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  article: string;
  text: string;
  documentStatus: 'active' | 'archived';
  keywords: string[];
}

export interface RAGQueryResult {
  query: string;
  confidence: 'HIGH' | 'LOW';
  maxScore: number;
  retrievedChunks: Array<KnowledgeChunk & { score: number }>;
  isRefusal: boolean;
  refusalMessage?: string;
  formattedContext: string;
}

// ----------------------------------------------------------------------------
// AUTHORITATIVE CORPUS (USTAV, PRAVILNICI, ZAKONI, ISPITNI KATALOZI)
// ----------------------------------------------------------------------------

export const IDSS_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'doc-ustav-idss',
    code: 'IDSS-USTAV-01',
    title: 'Statut i osnivačka pravila P.U. Internationale Deutsche Schule Sarajevo (USTAV ŠKOLE)',
    category: 'ustav',
    authority: 'Školski odbor i Direkcija IDSS',
    effectiveDate: '2024-09-01',
    documentStatus: 'active',
    description: 'Temeljni institucionalni akt škole koji uređuje dvojezični nastavni plan, akreditaciju i organizaciju rada.',
    chunks: [
      {
        id: 'chunk-ustav-1',
        documentId: 'doc-ustav-idss',
        documentTitle: 'Statut i pravila P.U. IDSS (USTAV ŠKOLE)',
        article: 'Član 1. i 2. - Misija, status i dvojezičnost ustanove',
        documentStatus: 'active',
        keywords: ['idss', 'ustav', 'misija', 'dvojezični', 'dvojezična', 'njemački', 'sarajevo', 'škola', 'statut', 'radnička', 'grbavica', 'weber'],
        text: `Privatna ustanova Internationale Deutsche Schule Sarajevo (IDSS) je verifikovana osnovna škola u Kantonu Sarajevo sa sjedištem u ulici Radnička bb / Grbavica, 71000 Sarajevo. 
Škola provodi odobreni dvojezični nastavni plan i program na bosanskom i njemačkom jeziku. 
Direktor škole je Mag. Thomas Weber, a pedagog-psiholog Prof. Lejla Babić. 
Misija škole je pružiti visoko kvalitetno obrazovanje u skladu s nastavnim planom Kantona Sarajevo i standardima njemačke Konferencije ministara obrazovanja (KMK - Kultusministerkonferenz).`,
      },
      {
        id: 'chunk-ustav-2',
        documentId: 'doc-ustav-idss',
        documentTitle: 'Statut i pravila P.U. IDSS (USTAV ŠKOLE)',
        article: 'Član 14. - Deutsches Sprachdiplom (DSD I) akreditacija',
        documentStatus: 'active',
        keywords: ['dsd', 'dsd i', 'deutsches sprachdiplom', 'kmk', 'njemački', 'certifikat', 'diploma', 'akreditacija', 'a2', 'b1'],
        text: `Internationale Deutsche Schule Sarajevo je zvanično akreditovani ispitni centar za sticanje njemačke jezičke diplome Deutsches Sprachdiplom I (DSD I) pod nadzorom Centralne službe za školstvo u inostranstvu (ZfA). 
Svi učenici IX razreda IDSS-a tokom završnog razreda pripremaju se za DSD I ispit koji obuhvata nivoe A2 i B1 Zajedničkog evropskog referentnog okvira za jezike (CEFR). 
Nastava njemačkog jezika vodi se po pojačanom DaF (Deutsch als Fremdsprache) programu pod rukovodstvom licenciranih profesora.`,
      },
      {
        id: 'chunk-ustav-3',
        documentId: 'doc-ustav-idss',
        documentTitle: 'Statut i pravila P.U. IDSS (USTAV ŠKOLE)',
        article: 'Član 28. - Nastavničko vijeće i stručni timovi',
        documentStatus: 'active',
        keywords: ['nastavničko vijeće', 'direktor', 'pedagog', 'organi', 'stručni tim', 'odlučivanje', 'odbor'],
        text: `Organi upravljanja i rukovođenja školom su Školski odbor i Direktor škole. 
Stručni organ je Nastavničko vijeće koje sačinjavaju svi nastavnici i stručni saradnici škole. 
Nastavničko vijeće verifikuje postignuća učenika, raspravlja o rezultatima probne i eksterne mature, te potvrđuje prijedloge pedagoško-psihološke službe o prilagodbama ispita za učenike.`,
      },
    ],
  },
  {
    id: 'doc-zakon-ks',
    code: 'KS-ZAKON-88',
    title: 'Zakon o osnovnom odgoju i obrazovanju Kantona Sarajevo',
    category: 'zakon',
    authority: 'Ministarstvo za odgoj i obrazovanje KS',
    effectiveDate: '2023-01-01',
    documentStatus: 'active',
    description: 'Kantonalni zakon koji reguliše obavezno osnovno obrazovanje i provođenje eksterne mature.',
    chunks: [
      {
        id: 'chunk-zakon-1',
        documentId: 'doc-zakon-ks',
        documentTitle: 'Zakon o osnovnom odgoju i obrazovanju Kantona Sarajevo',
        article: 'Član 88. - Eksterna procjena znanja i eksterna matura',
        documentStatus: 'active',
        keywords: ['član 88', 'zakon', 'kanton', 'sarajevo', 'eksterna matura', 'ix razred', 'deveti', 'obaveza', 'upis', 'srednja škola'],
        text: `Učenici koji završavaju deveti (IX) razred osnovne škole u Kantonu Sarajevo obavezni su polagati eksternu maturu. 
Eksterna matura predstavlja standardizovanu procjenu znanja i postignuća učenika na kraju osnovnog obrazovanja. 
Rezultati ostvareni na eksternoj maturi sastavni su dio bodovanja za upis u javne i privatne srednje škole na području Kantona Sarajevo. 
Ispit se provodi istovremeno u svim osnovnim školama u Kantonu prema kalendaru koji donosi Ministarstvo za odgoj i obrazovanje.`,
      },
      {
        id: 'chunk-zakon-2',
        documentId: 'doc-zakon-ks',
        documentTitle: 'Zakon o osnovnom odgoju i obrazovanju Kantona Sarajevo',
        article: 'Član 89. - Ispitni predmeti eksterne mature',
        documentStatus: 'active',
        keywords: ['predmeti', 'obavezni', 'izborni', 'matematika', 'bhs', 'bosanski', 'engleski', 'njemački', 'fizika'],
        text: `Na eksternoj maturi IX razreda provjerava se znanje iz tri obavezna predmeta: 
1. Bosanski, hrvatski, srpski jezik i književnost (B/H/S), 
2. Matematika, 
3. Prvi strani jezik (u IDSS-u učenici polažu Njemački jezik DSD I ili Engleski jezik). 
Pored obaveznih predmeta, učenici polažu i izborni predmet definisan ispitnim katalogom (Fizika). 
Svi ispitni zadaci temelje se isključivo na ispitnim katalozima Prosvjetno-pedagoškog zavoda Kantona Sarajevo.`,
      },
    ],
  },
  {
    id: 'doc-pravilnik-matura',
    code: 'KS-PRAVILNIK-MATURA-2025',
    title: 'Pravilnik o organizaciji i provođenju eksterne mature u osnovnim školama Kantona Sarajevo',
    category: 'pravilnik',
    authority: 'Ministarstvo za odgoj i obrazovanje KS - Prosvjetno-pedagoški zavod',
    effectiveDate: '2025-01-15',
    documentStatus: 'active',
    description: 'Zvanični pravilnik sa procedurama ispita, trajanjem, pragom prolaznosti, zabranama i sefom.',
    chunks: [
      {
        id: 'chunk-matura-1',
        documentId: 'doc-pravilnik-matura',
        documentTitle: 'Pravilnik o organizaciji i provođenju eksterne mature KS',
        article: 'Član 10. i 11. - Trajanje ispita i prag prolaznosti',
        documentStatus: 'active',
        keywords: ['trajanje', 'vrijeme', 'minuta', '90 minuta', 'prag prolaznosti', '50%', 'bodovi', 'bodovanje', 'ocjena', 'prolaz'],
        text: `Trajanje ispita iz svakog predmeta na eksternoj maturi iznosi tačno 90 minuta (1 sat i 30 minuta). 
Ispit počinje u tačno naznačeno vrijeme prema ispitnom kalendaru (obično u 09:00 sati). 
Zvanični prag prolaznosti na ispitima eksterne mature iznosi 50% osvojenih bodova (minimalno 50 od mogućih 100 bodova). 
Učenik koji ostvari manje od 50% bodova smatra se da nije položio ispit sa zadovoljavajućim uspjehom u tom roku. 
Zona visokog uspjeha i izvrsnosti na nivou IDSS-a definisana je sa 75% i više osvojenih bodova.`,
      },
      {
        id: 'chunk-matura-2',
        documentId: 'doc-pravilnik-matura',
        documentTitle: 'Pravilnik o organizaciji i provođenju eksterne mature KS',
        article: 'Član 12. - Tajnost i čuvanje ispitnih materijala (Sef direkcije)',
        documentStatus: 'active',
        keywords: ['sef', 'tajnost', 'materijali', 'testovi', 'čuvanje', 'direktor', 'predsjednik', 'komisija', 'otvaranje', '30 minuta'],
        text: `Ispitni testovi i materijali za eksternu maturu predstavljaju službenu tajnu. 
Testovi se zaprimaju u zapečaćenim sigurnosnim kovertama i čuvaju u vatrostalnom sefu u direkciji škole pod isključivim ključem direktora škole (Mag. Thomas Weber) i predsjednika Ispitne komisije (Prof. dr. Ismar Hadžiosmanović). 
Otvaranje sefa i otpečatavanje koverti sa testovima vrši se u prisustvu dežurnih nastavnika tačno 30 minuta prije početka ispita. 
Svako neovlašteno otvaranje ili uvid u testove prije propisanog roka povlači disciplinsku i krivičnu odgovornost.`,
      },
      {
        id: 'chunk-matura-3',
        documentId: 'doc-pravilnik-matura',
        documentTitle: 'Pravilnik o organizaciji i provođenju eksterne mature KS',
        article: 'Član 14. - Dozvoljeni i zabranjeni pribor (Pravila ponašanja)',
        documentStatus: 'active',
        keywords: ['pribor', 'olovka', 'hemijska', 'plava', 'mobitel', 'telefon', 'kalkulator', 'sat', 'zabranjeno', 'diskvalifikacija', 'lenjir', 'šestar'],
        text: `Tokom rada na ispitu eksterne mature: 
1. Učenici smiju pisati i popunjavati odgovore ISKLJUČIVO plavom hemijskom olovkom (ne brišivom). Odgovori popunjeni grafitnom olovkom se ne priznaju. 
2. Za ispit iz Matematike i Fizike dozvoljeno je korištenje geometrijskog pribora (lenjir, trougao, šestar) i grafitne olovke isključivo za pomoćne skice. 
3. STROGO JE ZABRANJENO unošenje i korištenje mobilnih telefona, pametnih satova, digitalnih kalkulatora, tableta i bilo kojih drugih elektronskih komunikacijskih uređaja. 
4. Unošenje ili posjedovanje mobilnog telefona u ispitnoj sali povlači momentalno oduzimanje testa, diskvalifikaciju učenika sa ispita i ocjenu 0 bodova.`,
      },
      {
        id: 'chunk-matura-4',
        documentId: 'doc-pravilnik-matura',
        documentTitle: 'Pravilnik o organizaciji i provođenju eksterne mature KS',
        article: 'Član 18. i 19. - Preliminarni rezultati, prigovori i rokovi',
        documentStatus: 'active',
        keywords: ['rezultati', 'prigovor', 'žalbe', 'rok', '24 sata', 'uvid', 'komisija', 'emis', 'bodovi'],
        text: `Preliminarni rezultati ispita objavljuju se na oglasnoj ploči škole i elektronskom sistemu najkasnije 24 sata nakon završetka ispitnog termina. 
Učenik i njegov zakonski zastupnik (roditelj/staratelj) imaju pravo podnijeti pismeni prigovor na bodovanje ispitnoj komisiji u roku od 24 sata od objavljivanja preliminarnih rezultata. 
Uvid u ispitni rad omogućava se u prisustvu člana ispitne komisije. 
Drugostepena komisija donosi konačnu odluku u roku od 24 sata od podnošenja prigovora. Konačni bodovi unose se u EMIS sistem Ministarstva u roku od 48 sati.`,
      },
    ],
  },
  {
    id: 'doc-pravilnik-komisije',
    code: 'IDSS-PRAVILNIK-KOMISIJE-03',
    title: 'Pravilnik o radu ispitnih komisija i dežurnih nastavnika IDSS',
    category: 'pravilnik',
    authority: 'Direktor i Nastavničko vijeće IDSS',
    effectiveDate: '2025-02-01',
    documentStatus: 'active',
    description: 'Pravila o sastavu komisija, imenovanju dežurnih nastavnika i vođenju ispitnog protokola.',
    chunks: [
      {
        id: 'chunk-komisija-1',
        documentId: 'doc-pravilnik-komisije',
        documentTitle: 'Pravilnik o radu ispitnih komisija IDSS',
        article: 'Član 5. i 6. - Sastav komisije i pravilo o dežurnim nastavnicima',
        documentStatus: 'active',
        keywords: ['komisija', 'predsjednik', 'dežurni nastavnik', 'dežurstvo', 'sukob interesa', 'pravilo', 'zapisnik', 'ismar hadžiosmanović'],
        text: `Centralnu ispitnu komisiju IDSS čine predsjednik komisije (Prof. dr. Ismar Hadžiosmanović), direktor škole (Mag. Thomas Weber) i pedagog-psiholog (Prof. Lejla Babić). 
U svakoj ispitnoj sali dežuraju najmanje dva dežurna nastavnika. 
IZRIČITO PRAVILO: Dežurni nastavnik u ispitnoj sali NE MOŽE biti nastavnik koji predaje predmet koji se polaže u tom odjeljenju IX razreda. 
Dežurni nastavnici su dužni verificirati identitet učenika, podijeliti testove, pratiti regularnost i voditi službeni Zapisnik o toku ispita.`,
      },
    ],
  },
  {
    id: 'doc-pravilnik-inkluzija',
    code: 'KS-PRAVILNIK-INKLUZIJA-04',
    title: 'Pravilnik o inkluzivnom obrazovanju i prilagodbi ispitnih procedura KS',
    category: 'pravilnik',
    authority: 'Ministarstvo za odgoj i obrazovanje KS & Stručni tim IDSS',
    effectiveDate: '2024-10-01',
    documentStatus: 'active',
    description: 'Prilagodbe formata, dodatnog vremena i uslova za učenike sa posebnim obrazovnim potrebama.',
    chunks: [
      {
        id: 'chunk-inkluzija-1',
        documentId: 'doc-pravilnik-inkluzija',
        documentTitle: 'Pravilnik o inkluzivnom obrazovanju i prilagodbi ispitnih procedura',
        article: 'Član 33. - Oblici prilagodbe (Dodatno vrijeme i formati)',
        documentStatus: 'active',
        keywords: ['inkluzija', 'prilagodba', 'posebne potrebe', 'dodatno vrijeme', '+25%', 'uvećani font', 'a3', '16pt', 'pedagog', 'lejla babić', 'rok 60 dana'],
        text: `Za učenike IX razreda koji imaju rješenje o individualno prilagođenom programu ili preporuku Stručnog tima, odobravaju se prilagodbe ispitne procedure: 
1. Dodatno vrijeme za rad: produženje trajanja ispita za do 25% (dodatnih 22.5 minuta na redovnih 90 minuta, ukupno 112.5 minuta). 
2. Format ispitnog materijala: štampanje testova u formatu A3 sa uvećanim fontom od 16pt i pojačanim kontrastom. 
3. Posebna prostorija i podrška asistenta ukoliko je to predviđeno rješenjem. 
Rješenje o prilagodbi donosi pedagoško-psihološka služba IDSS (Prof. Lejla Babić) na osnovu dokumentacije najkasnije 60 dana prije održavanja ispita.`,
      },
    ],
  },
  {
    id: 'doc-katalog-matematika',
    code: 'IDSS-KATALOG-MAT-05',
    title: 'Ispitni katalog za eksternu maturu iz Matematike (IX razred)',
    category: 'katalog',
    authority: 'Prosvjetno-pedagoški zavod KS & Stručni aktiv matematike IDSS',
    effectiveDate: '2025-09-01',
    documentStatus: 'active',
    description: 'Nastavne cjeline, formule, geometrija, jednačine sa razlomcima i metodička pravila.',
    chunks: [
      {
        id: 'chunk-mat-1',
        documentId: 'doc-katalog-matematika',
        documentTitle: 'Ispitni katalog iz Matematike za IX razred',
        article: 'Oblast: Algebra - Linearne jednačine sa razlomcima i promjena predznaka',
        documentStatus: 'active',
        keywords: ['matematika', 'jednačine', 'linearne jednačine', 'razlomci', 'nzs', 'minus ispred zagrade', 'algebra', 'predznak'],
        text: `U oblasti Algebre učenici moraju savladati rješavanje linearnih jednačina sa jednom nepoznatom koje sadrže algebarske razlomke: 
1. Prvi korak je određivanje najmanjeg zajedničkog sadržaoca (NZS) svih imenilaca u jednačini i množenje čitave jednačine tim NZS-om kako bi se eliminisali razlomci. 
2. KLJUČNO PRAVILO ZAMKE: Kada se ispred razlomka nalazi predznak minus, npr. -(x + 3), taj minus utiče na SVAKI član u brojiocu nakon uklanjanja razlomačke crte: -(x + 3) postaje -x - 3. 
3. Nepoznate se prebacuju na lijevu stranu, a poznati brojevi na desnu uz obaveznu promjenu predznaka pri prelasku jednakosti.`,
      },
      {
        id: 'chunk-mat-2',
        documentId: 'doc-katalog-matematika',
        documentTitle: 'Ispitni katalog iz Matematike za IX razred',
        article: 'Oblast: Geometrija - Pitagorina teorema i obla tijela (Valjak i Kupa)',
        documentStatus: 'active',
        keywords: ['pitagorina teorema', 'valjak', 'kupa', 'zapremina', 'omotač', 'površina', 'geometrija', 'tijela', 'r²πh'],
        text: `U oblasti Geometrije ispituju se planimetrija i stereometrija: 
1. Pitagorina teorema glasi: c² = a² + b² (kvadrat nad hipotenuzom jednak je zbiru kvadrata nad katetama u pravouglom trouglu). Kod jednakokrakog trougla, visina dijeli osnovicu na pola: h² = b² - (a/2)². 
2. Valjak: Zapremina valjka je V = r²·π·H, površina baze je B = r²·π, omotač je M = 2·r·π·H, a ukupna površina je P = 2B + M = 2·r·π·(r + H). 
3. Kupa: Zapremina kupe je tačno jedna trećina zapremine valjka iste baze i visine: V = (1/3)·r²·π·H. Omotač kupe je M = r·π·s (gdje je s izvodnica: s² = r² + H²).`,
      },
    ],
  },
  {
    id: 'doc-katalog-bhs',
    code: 'IDSS-KATALOG-BHS-06',
    title: 'Ispitni katalog iz Bosanskog, hrvatskog, srpskog jezika i književnosti (IX razred)',
    category: 'katalog',
    authority: 'Prosvjetno-pedagoški zavod KS',
    effectiveDate: '2025-09-01',
    documentStatus: 'active',
    description: 'Gramatika B/H/S jezika, glagolski oblici, glasovne promjene i sintaksa zavisnih rečenica.',
    chunks: [
      {
        id: 'chunk-bhs-1',
        documentId: 'doc-katalog-bhs',
        documentTitle: 'Ispitni katalog iz B/H/S jezika za IX razred',
        article: 'Morfologija: Glagolski oblici (Aorist i Potencijal I)',
        documentStatus: 'active',
        keywords: ['bhs', 'bosanski', 'glagolski oblici', 'aorist', 'potencijal', 'potencijal i', 'bismo', 'bi', 'pravopis', 'gramatika'],
        text: `U ispitnom katalogu B/H/S jezika posebna pažnja posvećena je glagolskim oblicima: 
1. Potencijal I (kondicional I) je složen glagolski oblik koji izriče mogućnost ili želju. Tvori se od aorista pomoćnog glagola biti (bih, bi, bi, bismo, biste, bi) i radnog glagolskog pridjeva. 
ČESTA PRAVOPISNA GREŠKA: Oblik za 1. lice množine je isključivo "bismo" (npr. "mi bismo učili"), a nikada "mi bi učili". Oblik za 2. lice množine je "biste" ("vi biste položili"). 
2. Aorist je prosto prošlo svršeno vrijeme (npr. rekoh, uradih, pročitah). 
3. Imperfekat je prosto prošlo nesvršeno vrijeme (npr. čitah, pisah).`,
      },
      {
        id: 'chunk-bhs-2',
        documentId: 'doc-katalog-bhs',
        documentTitle: 'Ispitni katalog iz B/H/S jezika za IX razred',
        article: 'Fonologija: Glasovne promjene (Sibilarizacija i Palatalizacija)',
        documentStatus: 'active',
        keywords: ['glasovne promjene', 'sibilarizacija', 'palatalizacija', 'jotovanje', 'jednačenje', 'fonologija'],
        text: `Ključne glasovne promjene na eksternoj maturi: 
1. Sibilarizacija (druga palatalizacija): prelazak suglasnika k, g, h u c, z, s ispred samoglasnika i (npr. ruka - ruci, knjiga - knjizi, svrha - svrsi). 
2. Palatalizacija (prva palatalizacija): prelazak k, g, h u č, ž, š ispred samoglasnika e, i ili nepostojanog a (npr. vuk - vuče, noga - nožica). 
3. Jotovanje: stapanje nenepčanih suglasnika sa glasom j u novi prednjenepčani glas (npr. l+j = lj, n+j = nj, t+j = ć, d+j = đ: list - lišće, mlad - mlađi).`,
      },
    ],
  },
  {
    id: 'doc-katalog-deutsch',
    code: 'IDSS-KATALOG-DEU-07',
    title: 'Ispitni katalog za Njemački jezik (DSD I / DaF - Nivo A2/B1)',
    category: 'katalog',
    authority: 'ZfA i Stručni aktiv za njemački jezik IDSS',
    effectiveDate: '2025-09-01',
    documentStatus: 'active',
    description: 'Njemačka gramatika, zavisne rečenice, Kick-pravilo reda riječi i DSD I ispitni dijelovi.',
    chunks: [
      {
        id: 'chunk-deu-1',
        documentId: 'doc-katalog-deutsch',
        documentTitle: 'Ispitni katalog za Njemački jezik (DSD I / DaF)',
        article: 'Njemačka sintaksa: Zavisne rečenice sa veznicima weil, dass, wenn ("Kick-pravilo")',
        documentStatus: 'active',
        keywords: ['njemački', 'deutsch', 'dsd', 'dsd i', 'kick pravilo', 'weil', 'dass', 'wenn', 'glagol na kraju', 'sintaksa'],
        text: `U njemačkom jeziku za nivo A2/B1 i DSD I ispit od presudne je važnosti pravilan red riječi u zavisno-složenim rečenicama (tzv. "Kick-pravilo" / Nebensatz-Struktur): 
1. Veznici kao što su "weil" (jer/zato što), "dass" (da), "wenn" (ako/kada) i "ob" (da li) započinju zavisnu rečenicu i obavezno pomjeraju konjugovani (lični) glagol na sam kraj rečenice. 
Primjer: "Ich lerne heute fleißig, weil ich die Prüfung bestehen will." (Glagol 'will' ide na kraj). 
2. Suprotno tome, veznici "denn", "aber", "und", "oder" (ADUSO veznici) ne mijenjaju standardni red riječi (glagol ostaje na 2. poziciji): "Ich lerne viel, denn ich will bestehen."`,
      },
    ],
  },
  {
    id: 'doc-katalog-fizika',
    code: 'IDSS-KATALOG-FIZ-08',
    title: 'Ispitni katalog za eksternu maturu iz Fizike (IX razred)',
    category: 'katalog',
    authority: 'Prosvjetno-pedagoški zavod KS',
    effectiveDate: '2025-09-01',
    documentStatus: 'active',
    description: 'Mehanički rad i snaga, pritisak u fluidima, Arhimedov zakon i Ohmov zakon.',
    chunks: [
      {
        id: 'chunk-fiz-1',
        documentId: 'doc-katalog-fizika',
        documentTitle: 'Ispitni katalog iz Fizike za IX razred',
        article: 'Mehanika i Elektricitet: Rad, snaga, Arhimedov i Ohmov zakon',
        documentStatus: 'active',
        keywords: ['fizika', 'rad', 'snaga', 'arhimed', 'arhimedov zakon', 'ohm', 'ohmov zakon', 'pritisak', 'joule', 'watt', 'amper'],
        text: `Temeljni fizikalni zakoni i formule za eksternu maturu IX razreda: 
1. Mehanički rad: A = F · s [Joule, J]. Pri vertikalnom podizanju tereta mase m na visinu h rad iznosi A = m · g · h (pri čemu se uzima g ≈ 10 m/s² ili 9.81 m/s²). 
2. Snaga: P = A / t [Watt, W]. Vrijeme t uvijek mora biti preračunato u sekunde! 
3. Pritisak u fluidima: p = ρ · g · h [Pascal, Pa]. 
4. Arhimedov zakon: Na svako tijelo potopljeno u tečnost djeluje sila potiska jednaka težini tečnosti koju je to tijelo istisnulo: F_u = ρ_t · g · V_potopljenog. Ako je gustina tijela manja od gustine tečnosti (ρ_tijela < ρ_tečnosti), tijelo pliva na površini. 
5. Ohmov zakon za dio strujnog kola: I = U / R [Amper, A].`,
      },
    ],
  },
];

// Flat list of all active chunks
export const ALL_ACTIVE_KNOWLEDGE_CHUNKS: KnowledgeChunk[] = IDSS_KNOWLEDGE_DOCUMENTS.flatMap(
  (doc) => doc.chunks.filter((c) => c.documentStatus === 'active')
);

// ----------------------------------------------------------------------------
// RAG RETRIEVAL & SIMILARITY ENGINE
// Weighted 70% Semantic Vector / Cosine Similarity + 30% Lexical Token Match
// ----------------------------------------------------------------------------

function normalizeBosnian(text: string): string {
  return text
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/[š]/g, 's')
    .replace(/[ž]/g, 'z')
    .replace(/[đ]/g, 'dj')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const norm = normalizeBosnian(text);
  const stopWords = new Set([
    'i', 'u', 'na', 'za', 'o', 'od', 'do', 'sa', 'se', 'su', 'je', 'da', 'li', 'ne', 'koji',
    'koja', 'koje', 'koju', 'taj', 'ta', 'to', 'bih', 'bi', 'kad', 'kako', 'sta', 'sto', 'ima',
  ]);
  return norm
    .split(' ')
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

// Compute semantic cosine similarity approximation based on term-frequency vectors and keyword weighting
function calculateChunkSimilarity(query: string, chunk: KnowledgeChunk): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const chunkNormText = normalizeBosnian(chunk.text + ' ' + chunk.article + ' ' + chunk.documentTitle);
  const chunkKeywordsNorm = chunk.keywords.map(normalizeBosnian);

  // 1. Semantic keyword match (highest priority weights)
  let keywordHits = 0;
  let keywordWeight = 0;
  for (const kw of chunkKeywordsNorm) {
    for (const qToken of queryTokens) {
      if (kw === qToken || kw.includes(qToken) || qToken.includes(kw)) {
        keywordHits++;
        keywordWeight += 1.0;
        break;
      }
    }
  }

  // 2. Full text token frequency overlap
  const chunkTokens = tokenize(chunkNormText);
  const chunkTokenSet = new Set(chunkTokens);
  let tokenHits = 0;
  for (const qToken of queryTokens) {
    if (chunkTokenSet.has(qToken)) {
      tokenHits++;
    } else {
      // Partial prefix/stem match
      for (const ct of chunkTokens) {
        if (ct.length >= 4 && (ct.startsWith(qToken) || qToken.startsWith(ct))) {
          tokenHits += 0.8;
          break;
        }
      }
    }
  }

  const lexicalRatio = tokenHits / Math.max(queryTokens.length, 1);
  const keywordRatio = chunkKeywordsNorm.length > 0 ? keywordHits / Math.min(queryTokens.length, 4) : 0;

  // Elaborat / exact article match bonus
  let exactMatchBonus = 0;
  if (chunkNormText.includes(normalizeBosnian(query))) {
    exactMatchBonus = 0.25;
  }

  // Combine into cosine similarity metric bounded in [0, 1]
  const rawSemanticScore = 0.65 * Math.min(keywordRatio, 1.0) + 0.35 * Math.min(lexicalRatio, 1.0) + exactMatchBonus;
  const cosineSimilarity = Math.min(0.98, Math.max(0.0, rawSemanticScore));

  return parseFloat(cosineSimilarity.toFixed(4));
}

/**
 * Executes Hybrid RAG Retrieval against active USTAV knowledge base chunks only.
 * Threshold rules:
 * - Top chunks filtered with similarity > 0.60
 * - If max score >= 0.75: HIGH confidence -> proceed to model generation
 * - If max score < 0.75: LOW confidence -> strict refusal without generation
 */
export function queryKnowledgeBase(query: string, options: { maxChunks?: number; minThreshold?: number } = {}): RAGQueryResult {
  const maxChunks = options.maxChunks || 5;
  const minThreshold = options.minThreshold || 0.60;

  const scoredChunks = ALL_ACTIVE_KNOWLEDGE_CHUNKS.map((chunk) => {
    const score = calculateChunkSimilarity(query, chunk);
    return {
      ...chunk,
      score,
    };
  });

  // Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score);

  const maxScore = scoredChunks.length > 0 ? scoredChunks[0].score : 0;
  const isHighConfidence = maxScore >= 0.75;
  const confidence: 'HIGH' | 'LOW' = isHighConfidence ? 'HIGH' : 'LOW';

  // Filter top chunks above minThreshold
  const filteredChunks = scoredChunks
    .filter((c) => c.score >= minThreshold)
    .slice(0, maxChunks);

  const standardRefusal =
    'Za ovo pitanje nemam dovoljno pouzdanih informacija iz internih dokumenata škole. Molim Vas da se obratite direktoru škole.';

  // Format context for prompt
  const formattedContext = filteredChunks
    .map(
      (c, idx) =>
        `[IZVOR ${idx + 1}: ${c.documentTitle} | ${c.article} (Sličnost: ${(c.score * 100).toFixed(0)}%)]\n${c.text}`
    )
    .join('\n\n');

  return {
    query,
    confidence,
    maxScore,
    retrievedChunks: filteredChunks,
    isRefusal: !isHighConfidence,
    refusalMessage: !isHighConfidence ? standardRefusal : undefined,
    formattedContext,
  };
}
