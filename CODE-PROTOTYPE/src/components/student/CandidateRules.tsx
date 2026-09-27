import React from 'react';
import { useTranslation } from '../../i18n/index.tsx';
import { Shield, AlertTriangle, Clock, CheckCircle2, FileText, Ban } from 'lucide-react';

export const CandidateRules: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            Internationale Deutsche Schule Sarajevo
          </span>
          <span className="text-xs font-mono text-slate-500">· IX razred (9. Klasse)</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Vodič za kandidate i pravila polaganja eksterne mature
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Izvod iz Pravilnika o organizaciji i provođenju eksterne mature u osnovnim školama Kantona Sarajevo i Pravila IDSS
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dolazak i identifikacija */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <Clock className="w-4 h-4" />
            1. Dolazak i identifikacija kandidata
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Kandidati su obavezni doći pred ispitnu prostoriju najkasnije <strong>30 minuta</strong> prije početka ispita.
            Ulazak u ispitnu salu moguć je isključivo uz predočenje važećeg identifikacionog dokumenta (lična karta ili đačka knjižica sa fotografijom).
          </p>
        </div>

        {/* Dozvoljeni pribor */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            2. Dozvoljeni pribor za rad
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zadaci se rješavaju isključivo hemijskom olovkom plave boje. Za ispit iz Matematike i Fizike dozvoljen je osnovni geometrijski pribor (lenjir, trougao, šestar). Upotreba kalkulatora je dozvoljena samo ukoliko je izričito navedeno u uputstvu testa.
          </p>
        </div>

        {/* Zabrane i diskvalifikacija */}
        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <Ban className="w-4 h-4" />
            3. Stroge zabrane i sankcije
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Strogo je zabranjeno unošenje mobilnih telefona, pametnih satova, kamera i drugih elektronskih uređaja u ispitnu salu. Posjedovanje uređaja ili prepisivanje povlači momentalno udaljavanje sa ispita i ocjenu 0 bodova.
          </p>
        </div>

        {/* Žalbeni postupak */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <FileText className="w-4 h-4" />
            4. Prigovori i žalbeni rokovi (Član 27.)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Učenik ili roditelj/staratelj ima zakonsko pravo uvida u ocijenjeni test i podnošenja pismenog prigovora Drugostepenoj komisiji u roku od <strong>24 sata</strong> od zvaničnog objavljivanja preliminarnih rezultata.
          </p>
        </div>
      </div>

      {/* Official Advice Quote */}
      <div className="p-6 rounded-xl bg-slate-900 text-white space-y-2 border border-slate-800">
        <div className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">
          Poruka Pedagoško-psihološke službe
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          "Eksterna matura je kruna vašeg dosadašnjeg školovanja i prilika da pokažete stečeno znanje u fer i jednakim uslovima. Pripremite se na vrijeme, redovno rješavajte simulacije na ovom portalu i pristupite ispitima s povjerenjem u svoje sposobnosti."
        </p>
      </div>
    </div>
  );
};
