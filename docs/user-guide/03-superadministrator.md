# Uputstvo za superadministratora

Superadministrator (direktor) ima sva prava, za sve predmete. Sve radnje se bilježe u dnevnik.

## Upravljanje nalozima (Dostupno)
- **Novi nalog**: korisničko ime (osoblje: službeni e-mail; učenik: ime.prezime bez e-maila), ime i prezime, uloga i
  početna lozinka. Lozinka iz poznatih curenja podataka se odbija.
- Status naloga (aktivan, suspendovan, blokiran, deaktiviran, arhiviran), prava (npr. nastavnik predmeta za jedan
  predmet) i reset lozinke. Vlastiti nalog i nalozi superadministratora ne mijenjaju se ovdje.

## Registar kanonskih dokumenata (Dostupno)
Učitavanje službenih dokumenata (PDF), provjera otiska (SHA-256), aktivacija, vraćanje ranije verzije, arhiviranje i
preuzimanje. Svaka verzija ima trajnu historiju.

## Probni ispiti (Dostupno)
- **Planovi ispita**: kliknite **Učitaj plan 2026-10-03.1** za svaki predmet; nastavnik predmeta ga potvrđuje. Možete i
  sami potvrditi ili odbiti.
- Odobravanje setova, ocjenjivanje i odgovori iz vježbe za sve predmete, kao u uputstvu za nastavnike.

## Pregled pitanja i pravila (Dostupno)
Kao nastavnik, za sve predmete; uključuje greške u katalogu i naknadne preglede. Upis greške za DEU-4.3.34 radi se ovdje.

## Praćenje učenika (Dostupno)
Pregled, profil učenika, analiza grupe i izvoz kao u uputstvu za pedagoga i psihologa, bez bilješki podrške: njih
superadministrator ne čita ni ne piše (odluka D2).

## Direktorski pregled (Dostupno)
Na početnoj stranici kliknite **Direktorski pregled**. Pregled škole u brojkama, bez praćenja pojedinaca:
- **Pregled**: aktivni učenici, ko je vježbao, odgovori po sedmicama, probni ispiti, zadaci i pokloni.
- **Predmeti**: provjerena pitanja, pokrivenost, tačnost, spremnost za ispit i bodovi na probnim ispitima po predmetu.
- **Nastavnici**: urađeni posao po nastavniku (pregledi, ocjenjivanje, zadaci, pokloni, bilješke) i šta čeka. Ovo je
  pregled rada, ne ocjena nastavnika.
- **Sadržaj**: stanje kataloga po predmetu, plan ispita, otvorene ispravke i najčešće netačna pitanja.
- **Sistem**: šta čeka na vas (migracija 030, push ključevi), sigurnosni događaji, indeks pretrage, migracije.
- **Dnevnik**: sve zabilježene radnje, filter po radnji, osobi i datumu; ne može se mijenjati.

Razdoblje birate gore: zadnjih 7, 30 ili 90 dana, ili školska godina (kad je aktivna). Brojka izračunata iz manje od 3
učenika prikazuje se kao "premalo učenika" (zaštita privatnosti). Svaku karticu možete štampati ili sačuvati kao PDF;
Nastavnici i Dnevnik imaju i **Izvoz CSV**. Svaki izvoz se bilježi.

## Postavke (Dostupno)
- **Boje uvodnog ekrana**: udio svake IDSS boje u procentima, zbir 100 %.
- **Dnevni cilj misije**: broj odgovora dnevno (sada 5).
- **Najmanja grupa**: ispod ovog broja učenika brojke se ne prikazuju (sada 3).
- **IDSS bodovi i značke**: bodovi za odgovore, misiju, dan vježbe i probni ispit; pravila značaka.
Svaka promjena se bilježi i vidi se u **Historija promjena**. Pravila ispita i bodovanje ispita nisu postavke: dolaze iz
kataloga.

## Šta radi samo superadministrator izvan aplikacije
- Migracije baze koje traže potvrdu brisanja pokreću se u Supabase SQL editoru (uputstvo dobijete uz svaku takvu
  migraciju).
- Ključevi (Supabase, Gemini) su samo u lokalnoj datoteci `.env.local`; nikad se ne šalju u razgovor ni u repozitorij.
