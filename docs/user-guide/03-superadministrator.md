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

## Postavke (Dostupno)
**Boje uvodnog ekrana**: udio svake IDSS boje u procentima, zbir 100 %.

## Šta radi samo superadministrator izvan aplikacije
- Migracije baze koje traže potvrdu brisanja pokreću se u Supabase SQL editoru (uputstvo dobijete uz svaku takvu
  migraciju).
- Ključevi (Supabase, Gemini) su samo u lokalnoj datoteci `.env.local`; nikad se ne šalju u razgovor ni u repozitorij.
