import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, Users, ArrowDownCircle, ArrowUpCircle, LogOut, X, Phone,
  MapPin, Calendar, Wallet, Eye, ChevronRight, UserPlus, LogIn, Check,
  Settings, Loader2, AlertCircle, Moon, Sun, MessageCircle
} from "lucide-react";

const LIGHT = {
  ink: "#16332B", inkSoft: "#20463B", bg: "#F6F1E4", card: "#FFFDF7",
  gold: "#C79A3E", goldDeep: "#A87C24", rust: "#A6472F", sage: "#7C9473",
  text: "#1E2420", textMute: "#5B6660", line: "#DCD3BC",
  rowAlt: "#FBF9F3", rowHighlight: "#F8F2E0",
};

const DARK = {
  ink: "#16332B", inkSoft: "#20463B", bg: "#111613", card: "#1C231E",
  gold: "#D9AE55", goldDeep: "#C79A3E", rust: "#C15A3E", sage: "#8FAF86",
  text: "#EDE7D8", textMute: "#9CA79B", line: "#2E3B33",
  rowAlt: "#20281F", rowHighlight: "#2A2718",
};

const WHATSAPP_LINK = "https://chat.whatsapp.com/JG1WcF7rqyHFxyIDBCE9Qm";

// This should match the public web address your backend is deployed to
// (the one that showed {"status":"ok"} when you visited /health).
// You can also change it from the gear icon on the login screen.
const DEFAULT_API_BASE = "https://celebrated-eagerness-production-36cb.up.railway.app";

const fmt = (n) => Number(n || 0).toLocaleString("en-US") + " FCFA";
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function NjangiApp() {
  const [dark, setDark] = useState(false);
  const C = dark ? DARK : LIGHT;

  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [showAuthSettings, setShowAuthSettings] = useState(false);

  const [screen, setScreen] = useState("auth");
  const [authMode, setAuthMode] = useState("login");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);

  const [members, setMembers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [deposits, setDeposits] = useState([]);

  const [modal, setModal] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const pollRef = useRef(null);

  const [login, setLogin] = useState({ id: "", password: "" });
  const [signup, setSignup] = useState({
    firstName: "", lastName: "", phone: "", email: "", password: "", address: "",
  });
  const [depForm, setDepForm] = useState({ number: "", amount: "", method: "MTN" });
  const [wdForm, setWdForm] = useState({ amount: "", number: "" });

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    },
    [apiBase, token]
  );

  const refreshAll = useCallback(async () => {
    try {
      const [me, mem, board, dep] = await Promise.all([
        apiFetch("/api/auth/me"),
        apiFetch("/api/members"),
        apiFetch("/api/members/leaderboard"),
        apiFetch("/api/deposits"),
      ]);
      setUser(me.user);
      setBalance(me.balance);
      setTotalDeposited(me.totalDeposited);
      setMembers(mem.members);
      setLeaderboard(board.leaderboard);
      setDeposits(dep.deposits);
    } catch (e) {
      console.error(e);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (token && screen !== "auth") refreshAll();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignup(e) {
    e.preventDefault();
    setErr("");
    const { firstName, lastName, phone, email, password, address } = signup;
    if (!firstName || !lastName || !phone || !email || !password || !address) {
      setErr("Please fill in every field.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(signup),
      });
      setToken(data.token);
      setScreen("home");
      flash(`Welcome, ${data.user.firstName}. Your account is live.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    if (!login.id || !login.password) {
      setErr("Please enter your phone/email and password.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: login.id, password: login.password }),
      });
      setToken(data.token);
      setScreen("home");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setScreen("auth");
    setLogin({ id: "", password: "" });
    setModal(null);
    if (pollRef.current) clearTimeout(pollRef.current);
  }

  function openDeposit() {
    setDepForm({ number: user.phone, amount: "", method: "MTN" });
    setErr("");
    setModal("deposit");
  }
  function openWithdraw() {
    setWdForm({ amount: "", number: user.phone });
    setErr("");
    setModal("withdraw");
  }

  async function submitDeposit(e) {
    e.preventDefault();
    setErr("");
    const amt = Number(depForm.amount);
    if (!depForm.number || !amt) {
      setErr("Please complete every field.");
      return;
    }
    setBusy(true);
    try {
      const path = depForm.method === "MTN" ? "/api/deposits/mtn" : "/api/deposits/orange";
      const data = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ amount: amt, phone: depForm.number }),
      });
      setModal(null);
      flash(data.message || "Deposit initiated.");
      if (data.paymentUrl) window.open(data.paymentUrl, "_blank");
      pollDeposit(data.deposit.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function pollDeposit(depositId, attempts = 0) {
    if (attempts > 20) return;
    pollRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/deposits/${depositId}/status`);
        if (data.deposit.status === "pending") {
          pollDeposit(depositId, attempts + 1);
        } else {
          flash(
            data.deposit.status === "successful"
              ? `Deposit of ${fmt(data.deposit.amount)} confirmed!`
              : "That deposit did not go through."
          );
          refreshAll();
        }
      } catch (e) {
        console.error(e);
      }
    }, 6000);
  }

  async function submitWithdraw(e) {
    e.preventDefault();
    setErr("");
    const amt = Number(wdForm.amount);
    if (!wdForm.number || !amt) {
      setErr("Please complete every field.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify({ amount: amt, phone: wdForm.number }),
      });
      setModal(null);
      flash(data.message || "Withdrawal requested.");
      refreshAll();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, minHeight: "100vh", color: C.text, transition: "background 0.2s, color 0.2s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Inter:wght@400;500;600;700&display=swap');
        .disp { font-family: 'Fraunces', serif; }
        .ledger-row { position: relative; border-bottom: 1px dashed ${C.line}; }
        .ledger-row:last-child { border-bottom: none; }
        .stamp {
          display: inline-flex; align-items: center; justify-content: center;
          border: 2px solid currentColor; border-radius: 999px; transform: rotate(-6deg);
          font-family: 'Fraunces', serif; font-weight: 700; letter-spacing: 0.02em;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pulse-text { animation: pulseText 1.6s ease-in-out infinite; }
        @keyframes pulseText { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.03); } }
      `}</style>

      {toast && (
        <div style={{ background: C.ink, color: LIGHT.bg }} className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2 max-w-[90vw] text-center">
          <Check size={16} /> {toast}
        </div>
      )}

      {screen === "auth" && (
        <AuthScreen
          C={C}
          authMode={authMode} setAuthMode={setAuthMode}
          login={login} setLogin={setLogin}
          signup={signup} setSignup={setSignup}
          handleLogin={handleLogin} handleSignup={handleSignup}
          err={err} busy={busy}
          apiBase={apiBase} setApiBase={setApiBase}
          showSettings={showAuthSettings} setShowSettings={setShowAuthSettings}
        />
      )}

      {screen !== "auth" && user && (
        <div className="max-w-5xl mx-auto pb-24 md:pb-10">
          <Header C={C} user={user} onOpenSettings={() => setModal("settings")} />

          <div className="px-4 md:px-8 mt-2 flex gap-2">
            <NavPill C={C} active={screen === "home"} onClick={() => setScreen("home")} icon={<Home size={16} />} label="Home" />
            <NavPill C={C} active={screen === "members"} onClick={() => setScreen("members")} icon={<Users size={16} />} label="Members" />
          </div>

          {screen === "home" && (
            <HomeScreen
              C={C}
              user={user} leaderboard={leaderboard} balance={balance}
              onDeposit={openDeposit} onWithdraw={openWithdraw}
              onSeeDeposits={() => setModal("mydeposits")}
            />
          )}

          {screen === "members" && <MembersScreen C={C} members={members} leaderboard={leaderboard} />}

          <div className="fixed bottom-0 left-0 right-0 md:hidden border-t flex justify-around py-2" style={{ borderColor: C.line, background: C.card }}>
            <BottomTab C={C} icon={<Home size={20} />} label="Home" active={screen === "home"} onClick={() => setScreen("home")} />
            <BottomTab C={C} icon={<Users size={20} />} label="Members" active={screen === "members"} onClick={() => setScreen("members")} />
            <BottomTab C={C} icon={<ArrowDownCircle size={20} />} label="Deposit" onClick={openDeposit} color={C.sage} />
            <BottomTab C={C} icon={<ArrowUpCircle size={20} />} label="Withdraw" onClick={openWithdraw} color={C.rust} />
          </div>
        </div>
      )}

      {modal === "settings" && (
        <Modal C={C} title="Settings" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: C.line }}>
              <span className="flex items-center gap-2 text-sm font-medium">
                {dark ? <Moon size={16} /> : <Sun size={16} />} Dark mode
              </span>
              <button
                onClick={() => setDark(!dark)}
                className="w-11 h-6 rounded-full relative transition-colors"
                style={{ background: dark ? C.sage : C.line }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: dark ? "22px" : "2px" }}
                />
              </button>
            </div>

            <div>
              <a
                href={WHATSAPP_LINK} target="_blank" rel="noreferrer"
                className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium"
                style={{ borderColor: C.line }}
              >
                <span className="flex items-center gap-2"><MessageCircle size={16} style={{ color: C.sage }} /> Join our WhatsApp community</span>
                <ChevronRight size={16} style={{ color: C.textMute }} />
              </a>
              <p className="pulse-text text-center text-xs font-medium mt-2" style={{ color: C.sage }}>
                👋 Join our WhatsApp group
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold"
              style={{ background: C.rust, color: "white" }}
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </Modal>
      )}

      {modal === "deposit" && (
        <Modal C={C} title="Make a deposit" onClose={() => setModal(null)}>
          <form onSubmit={submitDeposit} className="space-y-3">
            <Field C={C} label="Phone number" value={depForm.number} onChange={(v) => setDepForm({ ...depForm, number: v })} />
            <Field C={C} label="Amount (min. 500 FCFA)" value={depForm.amount} onChange={(v) => setDepForm({ ...depForm, amount: v })} type="number" />
            <div>
              <label className="text-xs font-medium" style={{ color: C.textMute }}>Payment method</label>
              <div className="flex gap-2 mt-1">
                {["MTN", "Orange"].map((m) => (
                  <button type="button" key={m} onClick={() => setDepForm({ ...depForm, method: m })}
                    className="flex-1 py-2 rounded-lg border text-sm font-medium"
                    style={{
                      borderColor: depForm.method === m ? C.ink : C.line,
                      background: depForm.method === m ? C.ink : "transparent",
                      color: depForm.method === m ? "white" : C.text,
                    }}>
                    {m} Mobile Money
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: C.textMute }}>
                You'll get a payment prompt on your phone once you confirm. Your balance updates automatically once it clears.
              </p>
            </div>
            {err && <p className="text-sm flex items-center gap-1" style={{ color: C.rust }}><AlertCircle size={14} /> {err}</p>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.sage }}>
              {busy && <Loader2 size={16} className="spin" />} Confirm deposit
            </button>
          </form>
        </Modal>
      )}

      {modal === "withdraw" && (
        <Modal C={C} title="Request a withdrawal" onClose={() => setModal(null)}>
          <form onSubmit={submitWithdraw} className="space-y-3">
            <p className="text-sm" style={{ color: C.textMute }}>
              Available balance: <strong style={{ color: C.text }}>{fmt(balance)}</strong>
            </p>
            <Field C={C} label="Amount (min. 2,000 FCFA)" value={wdForm.amount} onChange={(v) => setWdForm({ ...wdForm, amount: v })} type="number" />
            <Field C={C} label="Phone number to receive funds" value={wdForm.number} onChange={(v) => setWdForm({ ...wdForm, number: v })} />
            {err && <p className="text-sm flex items-center gap-1" style={{ color: C.rust }}><AlertCircle size={14} /> {err}</p>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.rust }}>
              {busy && <Loader2 size={16} className="spin" />} Submit withdrawal
            </button>
          </form>
        </Modal>
      )}

      {modal === "mydeposits" && (
        <Modal C={C} title="My deposits" onClose={() => setModal(null)}>
          <DepositLedger C={C} rows={deposits} />
        </Modal>
      )}
    </div>
  );
}

function Header({ C, user, onOpenSettings }) {
  return (
    <div className="px-4 md:px-8 pt-6 pb-3 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: C.goldDeep }}>Njangi Savings</p>
        <h1 className="disp text-2xl font-semibold" style={{ color: C.text }}>
          {user.firstName} {user.lastName}
        </h1>
      </div>
      <button onClick={onOpenSettings} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border" style={{ borderColor: C.line, color: C.textMute }}>
        <Settings size={16} />
      </button>
    </div>
  );
}

function NavPill({ C, active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className="hidden md:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full mb-2"
      style={{ background: active ? C.ink : "transparent", color: active ? "white" : C.textMute }}>
      {icon} {label}
    </button>
  );
}

function BottomTab({ C, icon, label, active, onClick, color }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center text-[11px] gap-0.5 px-3" style={{ color: active ? C.text : color || C.textMute }}>
      {icon} {label}
    </button>
  );
}

function HomeScreen({ C, user, leaderboard, balance, onDeposit, onWithdraw, onSeeDeposits }) {
  return (
    <div className="px-4 md:px-8 mt-2 space-y-5">
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${C.ink}, ${C.inkSoft})` }}>
        <p className="text-xs uppercase tracking-widest opacity-70">Your balance</p>
        <p className="disp text-3xl font-bold mt-1">{fmt(balance)}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onDeposit} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-sm" style={{ background: C.sage }}>
            <ArrowDownCircle size={16} /> Deposit
          </button>
          <button onClick={onWithdraw} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-sm" style={{ background: C.rust }}>
            <ArrowUpCircle size={16} /> Withdraw
          </button>
        </div>
      </div>

      <button onClick={onSeeDeposits} className="w-full flex items-center justify-between rounded-xl p-4 border" style={{ borderColor: C.line, background: C.card }}>
        <span className="flex items-center gap-2 font-medium"><Eye size={18} style={{ color: C.goldDeep }} /> See all my deposits</span>
        <ChevronRight size={18} style={{ color: C.textMute }} />
      </button>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.line, background: C.card }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: C.line }}>
          <Wallet size={16} style={{ color: C.goldDeep }} />
          <h2 className="disp font-semibold">Group savings sheet</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: C.textMute }} className="text-left">
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium text-right">Total deposited</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((m, i) => (
              <tr key={m.id} style={{ background: m.id === user.id ? C.rowHighlight : i % 2 ? C.rowAlt : "transparent" }}>
                <td className="px-4 py-2">{m.firstName} {m.lastName}{m.id === user.id ? " (you)" : ""}</td>
                <td className="px-4 py-2 text-right font-semibold" style={{ color: C.text }}>{fmt(m.totalDeposited)}</td>
              </tr>
            ))}
            {!leaderboard.length && (
              <tr><td colSpan={2} className="px-4 py-4 text-center" style={{ color: C.textMute }}>No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MembersScreen({ C, members, leaderboard }) {
  const totalsById = Object.fromEntries(leaderboard.map((m) => [m.id, m.totalDeposited]));
  return (
    <div className="px-4 md:px-8 mt-2 space-y-3">
      <h2 className="disp text-xl font-semibold" style={{ color: C.text }}>Community members</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {members.map((m) => (
          <div key={m.id} className="rounded-xl border p-4" style={{ borderColor: C.line, background: C.card }}>
            <p className="font-semibold disp text-lg">{m.firstName} {m.lastName}</p>
            <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: C.textMute }}><Phone size={14} /> {m.phone}</p>
            <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: C.textMute }}><MapPin size={14} /> {m.address}</p>
            <p className="text-xs mt-2" style={{ color: C.goldDeep }}>Total deposited: {fmt(totalsById[m.id] || 0)}</p>
          </div>
        ))}
        {!members.length && <p style={{ color: C.textMute }}>No members yet.</p>}
      </div>
    </div>
  );
}

function DepositLedger({ C, rows }) {
  if (!rows.length) return <p className="text-sm" style={{ color: C.textMute }}>No deposits yet.</p>;
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.line, background: C.card }}>
      {rows.map((t) => (
        <div key={t.id} className="ledger-row flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="stamp w-11 h-11 text-[10px]" style={{ color: t.status === "successful" ? C.sage : t.status === "failed" ? C.rust : C.textMute }}>
              {t.method}
            </span>
            <div>
              <p className="font-semibold" style={{ color: C.text }}>{fmt(t.amount)}</p>
              <p className="text-xs flex items-center gap-1" style={{ color: C.textMute }}><Calendar size={12} /> {fmtDate(t.createdAt)} · {t.status}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({ C, title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4" onClick={onClose}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" style={{ background: C.card, color: C.text }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="disp text-lg font-semibold" style={{ color: C.text }}>{title}</h3>
          <button onClick={onClose}><X size={20} style={{ color: C.textMute }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ C, label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="text-xs font-medium" style={{ color: C.textMute }}>{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: C.line, background: C.card, color: C.text }}
      />
    </div>
  );
}

function AuthScreen({ C, authMode, setAuthMode, login, setLogin, signup, setSignup, handleLogin, handleSignup, err, busy, apiBase, setApiBase, showSettings, setShowSettings }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 relative">
          <p className="text-xs uppercase tracking-widest" style={{ color: C.goldDeep }}>Njangi Savings</p>
          <h1 className="disp text-3xl font-bold" style={{ color: C.text }}>Save together</h1>
          <button onClick={() => setShowSettings(!showSettings)} className="absolute right-0 top-0 p-1.5 rounded-full border" style={{ borderColor: C.line, color: C.textMute }}>
            <Settings size={14} />
          </button>
        </div>

        {showSettings && (
          <div className="rounded-xl border p-3 mb-3" style={{ borderColor: C.line, background: C.card }}>
            <label className="text-xs font-medium" style={{ color: C.textMute }}>Backend web address</label>
            <input
              value={apiBase} onChange={(e) => setApiBase(e.target.value.replace(/\/$/, ""))}
              className="w-full mt-1 px-3 py-2 rounded-lg border text-xs outline-none font-mono"
              style={{ borderColor: C.line, background: "transparent", color: C.text }}
              placeholder="https://your-app.up.railway.app"
            />
          </div>
        )}

        <div className="rounded-2xl border p-5" style={{ borderColor: C.line, background: C.card }}>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAuthMode("login")} className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              style={{ background: authMode === "login" ? C.ink : "transparent", color: authMode === "login" ? "white" : C.textMute }}>
              <LogIn size={14} /> Log in
            </button>
            <button onClick={() => setAuthMode("signup")} className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              style={{ background: authMode === "signup" ? C.ink : "transparent", color: authMode === "signup" ? "white" : C.textMute }}>
              <UserPlus size={14} /> Sign up
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field C={C} label="Phone number or email" value={login.id} onChange={(v) => setLogin({ ...login, id: v })} />
              <Field C={C} label="Password" type="password" value={login.password} onChange={(v) => setLogin({ ...login, password: v })} />
              {err && <p className="text-sm flex items-center gap-1" style={{ color: C.rust }}><AlertCircle size={14} /> {err}</p>}
              <button disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.ink }}>
                {busy && <Loader2 size={16} className="spin" />} Log in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field C={C} label="First name" value={signup.firstName} onChange={(v) => setSignup({ ...signup, firstName: v })} />
                <Field C={C} label="Last name" value={signup.lastName} onChange={(v) => setSignup({ ...signup, lastName: v })} />
              </div>
              <Field C={C} label="Phone number" value={signup.phone} onChange={(v) => setSignup({ ...signup, phone: v })} />
              <Field C={C} label="Email" type="email" value={signup.email} onChange={(v) => setSignup({ ...signup, email: v })} />
              <Field C={C} label="Password" type="password" value={signup.password} onChange={(v) => setSignup({ ...signup, password: v })} />
              <Field C={C} label="Address" value={signup.address} onChange={(v) => setSignup({ ...signup, address: v })} />
              {err && <p className="text-sm flex items-center gap-1" style={{ color: C.rust }}><AlertCircle size={14} /> {err}</p>}
              <button disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.ink }}>
                {busy && <Loader2 size={16} className="spin" />} Create account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
