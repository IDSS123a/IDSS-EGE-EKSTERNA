import React from 'react';
import { GeneratedDocument, SchoolSettings, DocumentType } from '../../types/index.ts';
import { Printer, ArrowLeft, Download, ShieldCheck } from 'lucide-react';

interface OfficialDocumentViewProps {
  document: GeneratedDocument;
  settings: SchoolSettings;
  onBack: () => void;
}

export const OfficialDocumentView: React.FC<OfficialDocumentViewProps> = ({
  document,
  settings,
  onBack,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top action bar (hidden during print) */}
      <div className="flex items-center justify-between no-print bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Nazad na spisak akata
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Štampaj službeni akt (PDF)
          </button>
        </div>
      </div>

      {/* Official A4 Sheet Container */}
      <div className="bg-white border border-slate-300 p-8 sm:p-12 shadow-md rounded-lg text-slate-900 font-serif leading-relaxed relative print:border-none print:shadow-none print:p-0">
        {/* Official Letterhead */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 flex items-start justify-between gap-6">
          <div className="space-y-1 text-xs uppercase tracking-wider font-sans font-semibold text-slate-700">
            <div>Bosna i Hercegovina</div>
            <div>Federacija Bosne i Hercegovine / Kanton Sarajevo</div>
            <div className="font-bold text-slate-900 text-sm">{settings.cantonMinistry}</div>
            <div className="font-bold text-slate-900 text-base">{settings.schoolName}</div>
            <div className="text-[11px] text-slate-500 lowercase font-normal">{settings.address} · {settings.contactEmail}</div>
          </div>

          <div className="text-right shrink-0">
            <img
              src="/src/assets/images/idss_school_crest_1790457688577.jpg"
              alt="Grb škole IDSS"
              className="w-16 h-16 object-contain mx-auto border border-slate-200 p-1 rounded-sm"
            />
            <div className="text-[10px] font-mono text-slate-500 mt-1">ID: {settings.schoolCode}</div>
          </div>
        </div>

        {/* Protocol Metadata */}
        <div className="flex justify-between items-center text-xs font-mono text-slate-600 mb-8 border-b border-slate-200 pb-3">
          <div>Broj protokola: <strong className="text-slate-900">{document.protocolNumber}</strong></div>
          <div>Sarajevo, {new Date(document.generatedAt).toLocaleDateString('bs')}. godine</div>
        </div>

        {/* Document Body according to type */}
        <div className="space-y-6 my-8">
          <div className="text-center space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase text-slate-900 font-sans">
              {document.title}
            </h1>
            <div className="text-xs font-sans text-slate-500 uppercase tracking-widest">
              Školska godina {document.academicYear} · {settings.examPeriodTitle}
            </div>
          </div>

          {/* Legal preamble */}
          <p className="text-xs text-justify indent-6 text-slate-700">
            Na osnovu člana 88. Zakona o osnovnom odgoju i obrazovanju Kantona Sarajevo ("Službene novine Kantona Sarajevo", broj: 23/17, 33/21 i 30/22), člana 12. i 19. Pravilnika o organizaciji i provođenju eksterne mature u osnovnim školama Kantona Sarajevo, te Pravila ustanove {settings.schoolName} (privatna osnovna škola), Ispitni odbor za eksternu maturu IX razreda sačinjava i izdaje sljedeći službeni akt:
          </p>

          {/* Conditional rendering for document types */}
          {document.documentType === 'minutes' && (
            <div className="space-y-4 text-xs">
              <div className="font-bold font-sans text-slate-900 uppercase">I. Podaci o ispitnoj sesiji</div>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>Ispitni predmet: {document.metadata.sessionTitle || 'Bosanski, hrvatski, srpski jezik i književnost'}</li>
                <li>Ispitna prostorija: {document.metadata.room || 'Učionica 101'}</li>
                <li>Vrijeme početka ispita: 09:00 sati | Vrijeme završetka: 10:30 sati</li>
                <li>Ukupno prijavljenih kandidata: 24 | Pristupilo: 24 | Odsutno: 0</li>
              </ul>

              <div className="font-bold font-sans text-slate-900 uppercase pt-2">II. Tok provođenja ispita</div>
              <p className="text-justify indent-6">
                Predsjednik ispitne komisije je u prisustvu dežurnih nastavnika u 08:35 sati preuzeo zapečaćene ispitne koverte iz službenog sefa direktora škole. Pečati na kovertama su bili neoštećeni. Otvaranje testova izvršeno je u 08:55 sati pred kandidatima.
              </p>
              <p className="text-justify indent-6">
                Tokom ispita nije zabilježeno narušavanje ispitnog reda, korištenje nedozvoljenih tehničkih pomagala niti ometanje procesa. Svi kandidati su testove predali u propisanom roku. Ispitni materijali su zapečaćeni i predati na ocjenjivanje.
              </p>
            </div>
          )}

          {document.documentType === 'commission_resolution' && (
            <div className="space-y-4 text-xs">
              <div className="font-bold font-sans text-slate-900 uppercase">R J E Š E N J E</div>
              <p className="text-justify indent-6">
                O imenovanju Centralne ispitne komisije i dežurnih nastavnika za provođenje eksterne mature u školskoj {document.academicYear}. godini:
              </p>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div>1. <strong>{settings.commissionPresident}</strong> - Predsjednik Centralne ispitne komisije</div>
                <div>2. <strong>Prof. Lejla Babić</strong> - Član / Koordinator pedagoške službe</div>
                <div>3. <strong>Prof. Damir Kovačević</strong> - Predmetni ispitivač za oblast prirodnih nauka i matematike</div>
                <div>4. <strong>Prof. Amra Softić</strong> - Dežurni nastavnik u ispitnoj sali I</div>
                <div>5. <strong>Prof. Denis Karić</strong> - Dežurni nastavnik u ispitnoj sali II</div>
              </div>
              <p className="text-justify indent-6">
                Zadatak imenovane komisije je osigurati zakonitost, tajnost ispitnih materijala, dosljedno poštivanje satnice i nepristrasno vrednovanje postignuća učenika.
              </p>
            </div>
          )}

          {document.documentType === 'certificate' && (
            <div className="space-y-6 text-center py-6">
              <img
                src="/src/assets/images/certificate_seal_gold_1790446563618.jpg"
                alt="Zlatni pečat"
                className="w-20 h-20 object-contain mx-auto"
              />
              <div className="text-xl font-bold font-sans uppercase tracking-widest text-slate-900">
                U V J E R E N J E
              </div>
              <p className="text-sm">
                Kojim se potvrđuje da je učenik/učenica:
              </p>
              <div className="text-2xl font-bold text-slate-900 underline uppercase font-sans">
                Amar Hadžić
              </div>
              <p className="text-xs text-slate-700 max-w-lg mx-auto leading-relaxed">
                rođen/a 14.05.2011. godine u Sarajevu, učenik/ca IX razreda (odjeljenje IX-1 / 9a) ustanove Internationale Deutsche Schule Sarajevo (privatna osnovna škola), sa uspjehom položio/la eksternu maturu za učenike devetog razreda osnovne škole u redovnom ispitnom roku sa ukupnim uspjehom:
              </p>
              <div className="text-lg font-bold text-slate-900 font-sans">
                ODLIČAN (5.00) · 94.33 BODOVA
              </div>
            </div>
          )}

          {/* Generic fallback if document type is candidate list or results summary */}
          {(document.documentType === 'candidate_list' || document.documentType === 'results_summary') && (
            <div className="space-y-4 text-xs">
              <div className="font-bold font-sans text-slate-900 uppercase">Pregled kandidata IX razreda i evidencije uspjeha</div>
              <table className="w-full border-collapse border border-slate-300 text-left">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 p-2">R. br.</th>
                    <th className="border border-slate-300 p-2">Kandidat</th>
                    <th className="border border-slate-300 p-2">Odjeljenje (9. Klasse)</th>
                    <th className="border border-slate-300 p-2">Predmet</th>
                    <th className="border border-slate-300 p-2">Status / Bodovi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-2 font-mono">1.</td>
                    <td className="border border-slate-300 p-2 font-semibold">Amar Hadžić</td>
                    <td className="border border-slate-300 p-2 font-mono">IX-1 (9a)</td>
                    <td className="border border-slate-300 p-2">Matematika</td>
                    <td className="border border-slate-300 p-2 font-mono text-emerald-700 font-bold">92.00 / Položio</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-mono">2.</td>
                    <td className="border border-slate-300 p-2 font-semibold">Sarah Mešić</td>
                    <td className="border border-slate-300 p-2 font-mono">IX-1 (9a)</td>
                    <td className="border border-slate-300 p-2">Engleski jezik</td>
                    <td className="border border-slate-300 p-2 font-mono text-emerald-700 font-bold">95.00 / Položio</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-mono">3.</td>
                    <td className="border border-slate-300 p-2 font-semibold">Felix Schneider</td>
                    <td className="border border-slate-300 p-2 font-mono">IX-1 (9a)</td>
                    <td className="border border-slate-300 p-2">Njemački jezik / DSD I</td>
                    <td className="border border-slate-300 p-2 font-mono text-emerald-700 font-bold">98.00 / Položio</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-mono">4.</td>
                    <td className="border border-slate-300 p-2 font-semibold">Dino Begić</td>
                    <td className="border border-slate-300 p-2 font-mono">IX-2 (9b)</td>
                    <td className="border border-slate-300 p-2">B/H/S jezik</td>
                    <td className="border border-slate-300 p-2 font-mono text-emerald-700 font-bold">85.00 / Položio</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Official Signatures & Seal Footer */}
        <div className="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs font-sans">
          <div className="text-center space-y-12">
            <div>Predsjednik ispitne komisije:</div>
            <div className="border-t border-slate-400 pt-2 font-semibold text-slate-800">
              {settings.commissionPresident}
            </div>
          </div>

          <div className="text-center space-y-12">
            <div>Direktor škole:</div>
            <div className="border-t border-slate-400 pt-2 font-semibold text-slate-800">
              {settings.schoolDirector}
            </div>
          </div>
        </div>

        {/* Seal Stamp placeholder */}
        <div className="mt-8 text-center text-[10px] font-sans text-slate-400 uppercase tracking-widest">
          (M.P. - Službeni pečat ustanove)
        </div>
      </div>
    </div>
  );
};
