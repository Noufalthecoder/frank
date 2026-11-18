import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Settings → Users & Roles. Active users appear in the Billing cashier dropdown. */
export default function UsersPanel({ showAlert, showConfirm, showToast }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Staff');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!(window.api && window.api.getUsers)) return;
    setUsers((await window.api.getUsers()) || []);
  };
  useEffect(() => { load(); }, []);

  const changed = async () => {
    await load();
    window.dispatchEvent(new CustomEvent('users-updated'));
  };
  const fail = (msg) => showAlert({ title: t('us_error'), message: msg, tone: 'warning' });

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await window.api.addUser({ name, role });
    setBusy(false);
    if (!res || res.success === false) return fail((res && res.error) || t('us_error'));
    setName('');
    setRole('Staff');
    showToast(t('us_added'));
    changed();
  };

  const update = async (u, patch) => {
    const res = await window.api.updateUser({ id: u.id, ...patch });
    if (!res || res.success === false) return fail((res && res.error) || t('us_error'));
    changed();
  };

  const remove = async (u) => {
    const ok = await showConfirm({
      title: t('us_remove'),
      message: t('us_remove_confirm', { name: u.name }),
      confirmLabel: t('us_remove'),
      tone: 'danger',
    });
    if (!ok) return;
    const res = await window.api.deleteUser(u.id);
    if (!res || res.success === false) return fail((res && res.error) || t('us_error'));
    changed();
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">{t('st_users_title')}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{t('us_hint')}</p>
      </div>

      <form onSubmit={add} className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('us_name')}</label>
          <input
            type="text"
            data-rule="text"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('us_name_ph')}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('us_role')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800">
            <option value="Staff">{t('st_role_staff')}</option>
            <option value="Admin">{t('st_role_admin')}</option>
          </select>
        </div>
        <button type="submit" disabled={!name.trim() || busy} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
          <UserPlus className="w-4 h-4" /> {t('us_add')}
        </button>
      </form>

      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className={`flex items-center gap-4 px-4 py-3.5 ${u.active ? '' : 'bg-slate-50/70'}`}>
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center flex-shrink-0">
              {u.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold truncate ${u.active ? 'text-slate-900' : 'text-slate-400'}`}>{u.name}</p>
              <p className="text-xs text-slate-400">{u.active ? t('us_active') : t('us_inactive')}</p>
            </div>
            <select
              value={u.role}
              onChange={(e) => update(u, { role: e.target.value })}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700"
              aria-label={t('us_role')}
            >
              <option value="Staff">{t('st_role_staff')}</option>
              <option value="Admin">{t('st_role_admin')}</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={u.active} onChange={(e) => update(u, { active: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              {t('us_active')}
            </label>
            <button type="button" onClick={() => remove(u)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title={t('us_remove')}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
