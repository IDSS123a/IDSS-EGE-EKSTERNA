import React, { useState } from 'react';
import { User, UserRole } from '../types/index.ts';
import { api } from '../services/api.ts';
import { useTranslation } from '../i18n/index.tsx';
import { LogIn, UserPlus, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserChange: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [className, setClassName] = useState('IX-1 (9a)');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      const res = await api.login(email, password);
      onUserChange(res.user);
      setMessage({ text: `Uspješno prijavljeni kao ${res.user.fullName}!`, type: 'success' });
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setMessage({ text: err.message || 'Greška pri prijavi.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      const res = await api.register({
        email,
        fullName,
        role,
        className: role === 'student' ? className : undefined,
      });
      onUserChange(res.user);
      setMessage({ text: `Registracija uspješna! Dobrodošli, ${res.user.fullName}.`, type: 'success' });
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setMessage({ text: err.message || 'Greška pri registraciji.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({
      text: 'Uputstvo za ponovno postavljanje lozinke poslano je na navedeni e-mail.',
      type: 'success',
    });
    setTimeout(() => setMode('login'), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'login' && <LogIn className="w-4 h-4 text-indigo-600" />}
            {mode === 'register' && <UserPlus className="w-4 h-4 text-indigo-600" />}
            {mode === 'reset' && <KeyRound className="w-4 h-4 text-indigo-600" />}
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'login' && 'IDSS Prijava na sistem eksterne mature (IX razred)'}
              {mode === 'register' && 'Registracija novog korisničkog računa (IDSS)'}
              {mode === 'reset' && 'Resetovanje lozinke'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Demo Fast Login Accounts */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="text-[11px] font-semibold text-slate-600">Brzi odabir demonstracionih naloga IDSS:</div>
          <div className="flex flex-col gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setEmail('amar.hadzic@ucenik.idss.ba');
                setPassword('matura2026');
              }}
              className="text-left text-slate-700 hover:text-indigo-600 hover:underline cursor-pointer"
            >
              • <strong>Učenik IX razreda:</strong> amar.hadzic@ucenik.idss.ba (IX-1 / 9a)
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('deutsch@idss.ba');
                setPassword('matura2026');
              }}
              className="text-left text-slate-700 hover:text-indigo-600 hover:underline cursor-pointer"
            >
              • <strong>Prof. Njemačkog/DaF:</strong> deutsch@idss.ba (Frau Sabine Müller)
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('pedagog@idss.ba');
                setPassword('matura2026');
              }}
              className="text-left text-slate-700 hover:text-indigo-600 hover:underline cursor-pointer"
            >
              • <strong>Pedagog/Admin:</strong> pedagog@idss.ba (Prof. Lejla Babić)
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('direktor@idss.ba');
                setPassword('matura2026');
              }}
              className="text-left text-slate-700 hover:text-indigo-600 hover:underline cursor-pointer"
            >
              • <strong>Direktor škole:</strong> direktor@idss.ba (Mag. Thomas Weber)
            </button>
          </div>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-mail adresa *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="npr. amar.hadzic@ucenik.idss.ba"
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Lozinka *</label>
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                >
                  Zaboravili ste lozinku?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-xs"
            >
              {loading ? 'Prijavljivanje...' : 'Prijavi se na sistem'}
            </button>

            <div className="text-center pt-2 text-slate-500">
              Nemate račun?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                Registrujte se
              </button>
            </div>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ime i prezime *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ime i prezime"
                className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-mail adresa *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adresa@skola.edu.ba"
                className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uloga *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <option value="student">Učenik</option>
                  <option value="admin">Nastavnik / Pedagog</option>
                </select>
              </div>

              {role === 'student' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Odjeljenje</label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="npr. IX-1 (9a)"
                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer mt-2"
            >
              {loading ? 'Kreiranje naloga...' : 'Kreiraj korisnički račun'}
            </button>

            <div className="text-center pt-2 text-slate-500">
              Već imate nalog?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                Prijavite se
              </button>
            </div>
          </form>
        )}

        {/* Reset Password Form */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vaša e-mail adresa *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adresa@skola.edu.ba"
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
            >
              Pošalji link za reset lozinke
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                ← Nazad na prijavu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
