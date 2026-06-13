import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Trophy, TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const DOC_REF = doc(db, 'wc2026', 'shared');

const HANDICAP_OPTIONS = [
  '0', '0-0.5', '0.5', '0.5-1', '1', '1-1.5', '1.5', '1.5-2',
  '2', '2-2.5', '2.5', '2.5-3', '3', '3-3.5', '3.5', '3.5-4', '4',
];

const WC2026_TEAMS = [
  'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bosnia and Herzegovina',
  'Brazil', 'Canada', 'Cape Verde', 'Colombia', 'Croatia', 'Curaçao', 'Czechia',
  "Côte d'Ivoire", 'DR Congo', 'Ecuador', 'Egypt', 'England', 'France', 'Germany',
  'Ghana', 'Haiti', 'Iran', 'Iraq', 'Japan', 'Jordan', 'Korea Republic', 'Mexico',
  'Morocco', 'Netherlands', 'New Zealand', 'Norway', 'Panama', 'Paraguay', 'Portugal',
  'Qatar', 'Saudi Arabia', 'Scotland', 'Senegal', 'South Africa', 'Spain', 'Sweden',
  'Switzerland', 'Tunisia', 'Turkey', 'United States', 'Uruguay', 'Uzbekistan',
];

function getSideOptions(teamA, teamB) {
  const a = teamA || 'ทีม A';
  const b = teamB || 'ทีม B';
  return [
    { value: 'A_give', label: `${a} (ต่อ)` },
    { value: 'A_get', label: `${a} (รอง)` },
    { value: 'B_give', label: `${b} (ต่อ)` },
    { value: 'B_get', label: `${b} (รอง)` },
  ];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyForm(players) {
  return {
    date: new Date().toISOString().slice(0, 10),
    teamA: '',
    teamB: '',
    scoreA: '',
    scoreB: '',
    picks: players.map((p) => ({ name: p, side: 'A_give', handicap: '0', odds: '', stake: '' })),
  };
}

// แยกคาแฮนดิแคพ เช่น "0.5" -> [0.5], "0-0.5" -> [0, 0.5] (เตง 2 ใบ)
function parseHandicap(str) {
  if (str === '' || str === null || str === undefined) return [0];
  const parts = String(str)
    .split('-')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
  return parts.length ? parts : [0];
}

// คำนวณผล: คืน { profit, label } หรือ null ถ้ายังไม่รู้ผล
function computeResult(pick, scoreA, scoreB) {
  if (scoreA === '' || scoreB === '' || scoreA === null || scoreB === null) return null;
  if (!pick.stake) return { profit: 0, label: '-' };
  const sa = Number(scoreA);
  const sb = Number(scoreB);
  const team = pick.side.startsWith('A') ? 'A' : 'B';
  const isGive = pick.side.endsWith('give'); // ต่อ
  const diff = team === 'A' ? sa - sb : sb - sa;
  const segs = parseHandicap(pick.handicap);
  const sign = isGive ? -1 : 1; // ต่อ = หักแฮนดิแคพ, รอง = บวกแฮนดิแคพ
  const segStake = pick.stake / segs.length;
  const odds = Number(pick.odds) || 0;

  let totalProfit = 0;
  const results = [];
  segs.forEach((h) => {
    const adj = diff + sign * h;
    if (adj > 0) {
      totalProfit += segStake * odds;
      results.push('win');
    } else if (adj === 0) {
      results.push('push');
    } else {
      totalProfit += -segStake;
      results.push('lose');
    }
  });

  let label;
  if (results.every((r) => r === 'win')) label = 'ชนะ';
  else if (results.every((r) => r === 'lose')) label = 'แพ้';
  else if (results.every((r) => r === 'push')) label = 'เสมอ';
  else if (results.includes('win') && results.includes('push')) label = 'ชนะครึ่ง';
  else if (results.includes('push') && results.includes('lose')) label = 'เสียครึ่ง';
  else label = 'ผสม';

  return { profit: totalProfit, label };
}

export default function App() {
  const [players, setPlayers] = useState(['Boom', 'Ob']);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(emptyForm(['Boom', 'Ob']));
  const [loaded, setLoaded] = useState(false);
  const [editingPlayers, setEditingPlayers] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [pwInput, setPwInput] = useState('');
  const [editingMatchId, setEditingMatchId] = useState(null);

  const remoteUpdate = useRef(false);

  // ฟัง realtime จาก Firestore
  useEffect(() => {
    const unsub = onSnapshot(DOC_REF, (snap) => {
      const data = snap.data();
      if (data) {
        remoteUpdate.current = true;
        if (data.players) setPlayers(data.players);
        if (data.matches) setMatches(data.matches);
        if (data.players) setForm((f) => emptyForm(data.players));
      }
      setLoaded(true);
    }, (err) => {
      console.error('Firestore error:', err);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  // บันทึกขึ้น Firestore เมื่อมีการเปลี่ยนแปลงจากผู้ใช้ (ไม่ใช่จาก remote)
  useEffect(() => {
    if (!loaded) return;
    if (remoteUpdate.current) {
      remoteUpdate.current = false;
      return;
    }
    setDoc(DOC_REF, { players, matches }).catch((e) => {
      console.error('บันทึกข้อมูลไม่สำเร็จ:', e);
    });
  }, [players, matches, loaded]);

  useEffect(() => {
    setForm((f) => {
      const picks = players.map((p) => {
        const existing = f.picks.find((x) => x.name === p);
        return existing || { name: p, side: 'A_give', handicap: '0', odds: '', stake: '' };
      });
      return { ...f, picks };
    });
  }, [players]);

  function updatePickField(idx, field, value) {
    setForm((f) => {
      const picks = [...f.picks];
      picks[idx] = { ...picks[idx], [field]: value };
      return { ...f, picks };
    });
  }

  function addMatch() {
    if (!form.teamA.trim() || !form.teamB.trim()) {
      alert('กรุณากรอกชื่อทีมให้ครบค่ะ');
      return;
    }
    const pw = window.prompt('กรุณากรอกรหัสยืนยันเพื่อบันทึกแมตช์');
    if (pw === null) return;
    if (pw !== '8888') {
      alert('รหัสไม่ถูกต้อง');
      return;
    }
    const cleanedPicks = form.picks.map((p) => ({
      ...p,
      odds: parseFloat(p.odds) || 0,
      stake: parseFloat(p.stake) || 0,
    }));
    if (editingMatchId) {
      setMatches((m) =>
        m
          .map((x) =>
            x.id === editingMatchId
              ? {
                  ...x,
                  date: form.date,
                  teamA: form.teamA.trim(),
                  teamB: form.teamB.trim(),
                  scoreA: form.scoreA,
                  scoreB: form.scoreB,
                  picks: cleanedPicks,
                }
              : x
          )
          .sort((a, b) => (a.date > b.date ? 1 : -1))
      );
      setEditingMatchId(null);
    } else {
      const newMatch = {
        id: uid(),
        date: form.date,
        teamA: form.teamA.trim(),
        teamB: form.teamB.trim(),
        scoreA: form.scoreA,
        scoreB: form.scoreB,
        picks: cleanedPicks,
      };
      setMatches((m) => [...m, newMatch].sort((a, b) => (a.date > b.date ? 1 : -1)));
    }
    setForm(emptyForm(players));
  }

  function startEdit(match) {
    const pw = window.prompt('กรุณากรอกรหัสเพื่อแก้ไขรายการนี้');
    if (pw === null) return;
    if (pw !== '8888') {
      alert('รหัสไม่ถูกต้อง');
      return;
    }
    setEditingMatchId(match.id);
    setForm({
      date: match.date,
      teamA: match.teamA,
      teamB: match.teamB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      picks: players.map((p) => {
        const existing = match.picks.find((x) => x.name === p);
        return existing
          ? { ...existing }
          : { name: p, side: 'A_give', handicap: '0', odds: '', stake: '' };
      }),
    });
  }

  function cancelEdit() {
    setEditingMatchId(null);
    setForm(emptyForm(players));
  }

  function requestDelete(id) {
    try {
      const pw = window.prompt('กรุณากรอกรหัสผ่านเพื่อลบรายการ');
      if (pw === null) return;
      if (pw !== '8888') {
        alert('รหัสผ่านไม่ถกต้อง');
        return;
      }
      setMatches((m) => m.filter((x) => x.id !== id));
    } catch (e) {
      setConfirmDeleteId(id);
      setPwInput('');
    }
  }

  function confirmDeleteWithInput() {
    if (pwInput !== '8888') {
      alert('รหัสผ่านไม่ถูกต้อง');
      return;
    }
    setMatches((m) => m.filter((x) => x.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    setPwInput('');
  }

  const sortedMatches = [...matches].sort((a, b) => (a.date > b.date ? 1 : -1));
  const cumulative = {};
  players.forEach((p) => (cumulative[p] = 0));
  sortedMatches.forEach((m) => {
    players.forEach((p) => {
      const pick = m.picks.find((x) => x.name === p);
      const result = pick ? computeResult(pick, m.scoreA, m.scoreB) : null;
      if (result) cumulative[p] += result.profit;
    });
  });

  function fmt(n) {
    if (n === null || n === undefined) return '-';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
  }

  function colorClass(n) {
    if (n === null || n === undefined) return 'text-stone-600';
    if (n > 0) return 'text-emerald-400';
    if (n < 0) return 'text-rose-400';
    return 'text-stone-600';
  }

  function updatePlayerName(idx, value) {
    setPlayers((ps) => {
      const next = [...ps];
      next[idx] = value;
      return next;
    });
  }

  function addPlayer() {
    if (players.length >= 5) return;
    setPlayers((ps) => [...ps, `คนที่ ${ps.length + 1}`]);
  }

  function removePlayer(idx) {
    if (players.length <= 1) return;
    setPlayers((ps) => ps.filter((_, i) => i !== idx));
  }

  return (
    <div className="min-h-screen bg-white text-stone-900 px-4 py-6 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-3 mb-6">
          <div className="bg-amber-600 text-white rounded-full p-2">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-700">
              คนซัวๆ World Cup 2026
            </h1>
            <p className="text-sm text-stone-600 font-medium">โดย Feejung ⚽</p>
          </div>
        </header>

        <section className="bg-stone-50 rounded-2xl p-4 mb-5 border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-amber-700">ผู้ทายผล</h2>
            <button
              onClick={() => setEditingPlayers((e) => !e)}
              className="text-xs px-3 py-1 rounded-full bg-stone-200 hover:bg-stone-300 transition"
            >
              {editingPlayers ? 'เสร็จแล้ว' : 'แก้ไขชื่อ'}
            </button>
          </div>
          {editingPlayers ? (
            <div className="space-y-2">
              {players.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={p}
                    onChange={(e) => updatePlayerName(i, e.target.value)}
                    className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {players.length > 1 && (
                    <button onClick={() => removePlayer(i)} className="text-rose-400 hover:text-rose-300">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {players.length < 5 && (
                <button
                  onClick={addPlayer}
                  className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-700 mt-1"
                >
                  <Plus size={14} /> เพิ่มผู้ทาย
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((p, i) => (
                <span key={i} className="text-sm bg-stone-200 px-3 py-1 rounded-full">
                  {p}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="bg-stone-50 rounded-2xl p-4 mb-5 border border-stone-200">
          <h2 className="font-semibold text-amber-700 mb-3">
            {editingMatchId ? 'แก้ไขแมตช์' : 'เพิ่มแมตช์ใหม่'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-stone-600 mb-1">วันที่</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">ทีม A</label>
              <select
                value={form.teamA}
                onChange={(e) => setForm((f) => ({ ...f, teamA: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">- เลือกทีม -</option>
                {WC2026_TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">ทีม B</label>
              <select
                value={form.teamB}
                onChange={(e) => setForm((f) => ({ ...f, teamB: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">- เลือกทีม -</option>
                {WC2026_TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 mb-3">
            {form.picks.map((pick, i) => (
              <div
                key={i}
                className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-stone-100 rounded-xl p-3 border border-stone-200"
              >
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-stone-600 mb-1">ผู้ทาย</label>
                  <div className="text-sm font-medium text-amber-700">{pick.name}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-stone-600 mb-1">ทีม / ต่อ-รอง</label>
                  <select
                    value={pick.side}
                    onChange={(e) => updatePickField(i, 'side', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {getSideOptions(form.teamA, form.teamB).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">ค่าแฮนดิแคพ</label>
                  <select
                    value={pick.handicap}
                    onChange={(e) => updatePickField(i, 'handicap', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {HANDICAP_OPTIONS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">ราคาคูณ</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pick.odds}
                    onChange={(e) => updatePickField(i, 'odds', e.target.value)}
                    placeholder="-"
                    className="w-full bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">ยอดพนัน (บาท)</label>
                  <input
                    type="number"
                    step="1"
                    value={pick.stake}
                    onChange={(e) => updatePickField(i, 'stake', e.target.value)}
                    placeholder="-"
                    className="w-full bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-600"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <label className="block text-xs text-stone-600 mb-1">
              ผลสกอร์จริง (กรอกตอนรู้ผลแล้ว — เว้นว่างไว้ก่อนได้)
            </label>
            <div className="flex items-center gap-2 w-full sm:w-64">
              <input
                type="number"
                value={form.scoreA}
                onChange={(e) => setForm((f) => ({ ...f, scoreA: e.target.value }))}
                placeholder="A"
                className="w-1/2 bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-600"
              />
              <span className="text-stone-600">-</span>
              <input
                type="number"
                value={form.scoreB}
                onChange={(e) => setForm((f) => ({ ...f, scoreB: e.target.value }))}
                placeholder="B"
                className="w-1/2 bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-600"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={addMatch}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl px-5 py-2.5 transition"
            >
              <Plus size={18} /> {editingMatchId ? 'บันทึกการแก้ไข' : 'เพิ่มแมตช์'}
            </button>
            {editingMatchId && (
              <button
                onClick={cancelEdit}
                className="flex-1 sm:flex-none bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold rounded-xl px-5 py-2.5 transition"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </section>

        <section className="bg-stone-50 rounded-2xl p-4 mb-5 border border-stone-200">
          <h2 className="font-semibold text-amber-700 mb-3">ยอดได้-เสียสะสม</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            {players.map((p) => (
              <div key={p} className="bg-stone-100 rounded-xl p-3 border border-stone-200">
                <div className="text-xs text-stone-600 mb-1">{p}</div>
                <div className={`text-lg font-bold flex items-center gap-1 ${colorClass(cumulative[p])}`}>
                  {cumulative[p] > 0 ? <TrendingUp size={16} /> : cumulative[p] < 0 ? <TrendingDown size={16} /> : null}
                  {fmt(cumulative[p])} บาท
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
          <h2 className="font-semibold text-amber-700 mb-3">รายการทายผล</h2>
          {sortedMatches.length === 0 ? (
            <p className="text-sm text-stone-600">ยังไม่มีข้อมูลการทาย เริ่มเพิ่มแมตช์แรกได้เลยค่ะ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-stone-600 text-left border-b border-stone-200">
                    <th className="py-2 pr-2">วันที่</th>
                    <th className="py-2 pr-2">คู่</th>
                    <th className="py-2 pr-2">สกอร์จริง</th>
                    {players.map((p) => (
                      <th key={p} className="py-2 pr-2">{p}</th>
                    ))}
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches.map((m) => (
                    <tr key={m.id} className="border-b border-stone-200">
                      <td className="py-2 pr-2 whitespace-nowrap">{m.date}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{m.teamA} vs {m.teamB}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-sm font-medium">
                        {m.scoreA === '' && m.scoreB === '' ? '- : -' : `${m.scoreA} - ${m.scoreB}`}
                      </td>
                      {players.map((p) => {
                        const pick = m.picks.find((x) => x.name === p);
                        const result = pick ? computeResult(pick, m.scoreA, m.scoreB) : null;
                        const sideLabel = pick ? getSideOptions(m.teamA, m.teamB).find((o) => o.value === pick.side)?.label : '-';
                        const oddsDisplay = pick && pick.odds ? pick.odds : '-';
                        const stakeDisplay = pick && pick.stake ? pick.stake : '-';
                        if (pick && !pick.stake) {
                          return (
                            <td key={p} className="py-2 pr-2 whitespace-nowrap text-stone-600 font-medium">
                              --
                            </td>
                          );
                        }
                        return (
                          <td key={p} className="py-2 pr-2 whitespace-nowrap">
                            <div className="text-xs text-stone-600">
                              {pick ? `${sideLabel} (${pick.handicap}) @${oddsDisplay} / ${stakeDisplay}฿` : '-'}
                            </div>
                            <div className={`font-medium ${colorClass(result ? result.profit : null)}`}>
                              {result ? `${fmt(result.profit)} (${result.label})` : '-'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(m)} className="text-amber-600 hover:text-amber-500">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => requestDelete(m.id)} className="text-rose-400 hover:text-rose-300">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-stone-50 border border-stone-300 rounded-2xl p-5 w-full max-w-xs">
              <h3 className="font-semibold text-amber-700 mb-2">ใส่รหัสผ่านเพื่อลบ</h3>
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmDeleteWithInput()}
                autoFocus
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteWithInput}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl px-3 py-2 text-sm"
                >
                  ยืนยันลบ
                </button>
                <button
                  onClick={() => { setConfirmDeleteId(null); setPwInput(''); }}
                  className="flex-1 bg-stone-200 hover:bg-stone-300 rounded-xl px-3 py-2 text-sm"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
