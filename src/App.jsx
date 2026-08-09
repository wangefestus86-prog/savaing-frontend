import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, Users, ArrowDownCircle, ArrowUpCircle, LogOut, X, Phone,
  MapPin, Calendar, Wallet, Eye, ChevronRight, UserPlus, LogIn, Check,
  Settings, Loader2, AlertCircle
} from "lucide-react";

const COLOR = {
  ink: "#16332B",
  inkSoft: "#20463B",
  parchment: "#F6F1E4",
  card: "#FFFDF7",
  gold: "#C79A3E",
  goldDeep: "#A87C24",
  rust: "#A6472F",
  sage: "#7C9473",
  text: "#1E2420",
  textMute: "#5B6660",
  line: "#DCD3BC",
};

// This should match the public web address Railway gave your backend
// (the one that showed {"status":"ok"} when you visited /health).
// You can also change it from the gear icon on the login screen.
const DEFAULT_API_BASE = "https://celebrated-eagerness-production-36cb.up.railway.app";

const fmt = (n) => Number(n || 0).toLocaleString("en-US") + " FCFA";
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function NjangiApp() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [showSettings, setShowSettings] = useState(false);

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
      } catch (_) {
        // non-JSON response (e.g. a proxy error page)
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
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
    if (attempts > 20) return; // stop after ~2 minutes
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
    <div style={{ fontFamily: "Inter, sans-serif", background: COLOR.parchment, minHeight: "100vh", color: COLOR.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Inter:wght@400;500;600;700&display=swap');
        .disp { font-family: 'Fraunces', serif; }
        .ledger-row { position: relative; border-bottom: 1px dashed ${COLOR.line}; }
        .ledger-row:last-child { border-bottom: none; }
        .stamp {
          display: inline-flex; align-items: center; justify-content: center;
          border: 2px solid currentColor; border-radius: 999px; transform: rotate(-6deg);
          font-family: 'Fraunces', serif; font-weight: 700; letter-spacing: 0.02em;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {toast && (
        <div style={{ background: COLOR.ink, color: COLOR.parchment }} className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2 max-w-[90vw] text-center">
          <Check size={16} /> {toast}
        </div>
      )}

      {screen === "auth" && (
        <AuthScreen
          authMode={authMode} setAuthMode={setAuthMode}
          login={login} setLogin={setLogin}
          signup={signup} setSignup={setSignup}
          handleLogin={handleLogin} handleSignup={handleSignup}
          err={err} busy={busy}
          apiBase={apiBase} setApiBase={setApiBase}
          showSettings={showSettings} setShowSettings={setShowSettings}
        />
      )}

      {screen !== "auth" && user && (
        <div className="max-w-5xl mx-auto pb-24 md:pb-10">
          <Header user={user} onLogout={handleLogout} />

          <div className="px-4 md:px-8 mt-2 flex gap-2">
            <NavPill active={screen === "home"} onClick={() => setScreen("home")} icon={<Home size={16} />} label="Home" />
            <NavPill active={screen === "members"} onClick={() => setScreen("members")} icon={<Users size={16} />} label="Members" />
          </div>

          {screen === "home" && (
            <HomeScreen
              user={user} leaderboard={leaderboard} balance={balance}
              onDeposit={openDeposit} onWithdraw={openWithdraw}
              onSeeDeposits={() => setModal("mydeposits")}
            />
          )}

          {screen === "members" && <MembersScreen members={members} leaderboard={leaderboard} />}

          <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t flex justify-around py-2" style={{ borderColor: COLOR.line }}>
            <BottomTab icon={<Home size={20} />} label="Home" active={screen === "home"} onClick={() => setScreen("home")} />
            <BottomTab icon={<Users size={20} />} label="Members" active={screen === "members"} onClick={() => setScreen("members")} />
            <BottomTab icon={<ArrowDownCircle size={20} />} label="Deposit" onClick={openDeposit} color={COLOR.sage} />
            <BottomTab icon={<ArrowUpCircle size={20} />} label="Withdraw" onClick={openWithdraw} color={COLOR.rust} />
          </div>
        </div>
      )}

      {modal === "deposit" && (
        <Modal title="Make a deposit" onClose={() => setModal(null)}>
          <form onSubmit={submitDeposit} className="space-y-3">
            <Field label="Phone number" value={depForm.number} onChange={(v) => setDepForm({ ...depForm, number: v })} />
            <Field label="Amount (min. 500 FCFA)" value={depForm.amount} onChange={(v) => setDepForm({ ...depForm, amount: v })} type="number" />
            <div>
              <label className="text-xs font-medium" style={{ color: COLOR.textMute }}>Payment method</label>
              <div className="flex gap-2 mt-1">
                {["MTN", "Orange"].map((m) => (
                  <button type="button" key={m} onClick={() => setDepForm({ ...depForm, method: m })}
                    className="flex-1 py-2 rounded-lg border text-sm font-medium"
                    style={{
                      borderColor: depForm.method === m ? COLOR.ink : COLOR.line,
                      background: depForm.method === m ? COLOR.ink : "white",
                      color: depForm.method === m ? "white" : COLOR.text,
                    }}>
                    {m} Mobile Money
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: COLOR.textMute }}>
                You'll get a payment prompt on your phone once you confirm. Your balance updates automatically once it clears.
              </p>
            </div>
            {err && <p className="text-sm flex items-center gap-1" style={{ color: COLOR.rust }}><AlertCircle size={14} /> {err}</p>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: COLOR.sage }}>
              {busy && <Loader2 size={16} className="spin" />} Confirm deposit
            </button>
          </form>
        </Modal>
      )}

      {modal === "withdraw" && (
        <Modal title="Request a withdrawal" onClose={() => setModal(null)}>
          <form onSubmit={submitWithdraw} className="space-y-3">
            <p className="text-sm" style={{ color: COLOR.textMute }}>
              Available balance: <strong style={{ color: COLOR.ink }}>{fmt(balance)}</strong>
            </p>
            <Field label="Amount (min. 2,000 FCFA)" value={wdForm.amount} onChange={(v) => setWdForm({ ...wdForm, amount: v })} type="number" />
            <Field label="Phone number to receive funds" value={wdForm.number} onChange={(v) => setWdForm({ ...wdForm, number: v })} />
            {err && <p className="text-sm flex items-center gap-1" style={{ color: COLOR.rust }}><AlertCircle size={14} /> {err}</p>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: COLOR.rust }}>
              {busy && <Loader2 size={16} className="spin" />} Submit withdrawal
            </button>
          </form>
        </Modal>
      )}

      {modal === "mydeposits" && (
        <Modal title="My deposits" onClose={() => setModal(null)}>
          <DepositLedger rows={deposits} />
        </Modal>
      )}
    </div>
  );
}

function Header({ user, onLogout }) {
  return (
    <div className="px-4 md:px-8 pt-6 pb-3 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: COLOR.goldDeep }}>Njangi Savings</p>
        <h1 className="disp text-2xl font-semibold" style={{ color: COLOR.ink }}>
          {user.firstName} {user.lastName}
        </h1>
      </div>
      <button onClick={onLogout} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border" style={{ borderColor: COLOR.line, color: COLOR.textMute }}>
        <LogOut size={14} /> Log out
      </button>
    </div>
  );
}

function NavPill({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className="hidden md:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full mb-2"
      style={{ background: active ? COLOR.ink : "transparent", color: active ? "white" : COLOR.textMute }}>
      {icon} {label}
    </button>
  );
}

function BottomTab({ icon, label, active, onClick, color }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center text-[11px] gap-0.5 px-3" style={{ color: active ? COLOR.ink : color || COLOR.textMute }}>
      {icon} {label}
    </button>
  );
}

function HomeScreen({ user, leaderboard, balance, onDeposit, onWithdraw, onSeeDeposits }) {
  return (
    <div className="px-4 md:px-8 mt-2 space-y-5">
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${COLOR.ink}, ${COLOR.inkSoft})` }}>
        <p className="text-xs uppercase tracking-widest opacity-70">Your balance</p>
        <p className="disp text-3xl font-bold mt-1">{fmt(balance)}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onDeposit} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-sm" style={{ background: COLOR.sage }}>
            <ArrowDownCircle size={16} /> Deposit
          </button>
          <button onClick={onWithdraw} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-sm" style={{ background: COLOR.rust }}>
            <ArrowUpCircle size={16} /> Withdraw
          </button>
        </div>
      </div>

      <button onClick={onSeeDeposits} className="w-full flex items-center justify-between rounded-xl p-4 bg-white border" style={{ borderColor: COLOR.line }}>
        <span className="flex items-center gap-2 font-medium"><Eye size={18} style={{ color: COLOR.goldDeep }} /> See all my deposits</span>
        <ChevronRight size={18} style={{ color: COLOR.textMute }} />
      </button>

      <div className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: COLOR.line }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: COLOR.line }}>
          <Wallet size={16} style={{ color: COLOR.goldDeep }} />
          <h2 className="disp font-semibold">Group savings sheet</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLOR.textMute }} className="text-left">
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium text-right">Total deposited</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((m, i) => (
              <tr key={m.id} style={{ background: m.id === user.id ? "#F8F2E0" : i % 2 ? "#FBF9F3" : "white" }}>
                <td className="px-4 py-2">{m.firstName} {m.lastName}{m.id === user.id ? " (you)" : ""}</td>
                <td className="px-4 py-2 text-right font-semibold" style={{ color: COLOR.ink }}>{fmt(m.totalDeposited)}</td>
              </tr>
            ))}
            {!leaderboard.length && (
              <tr><td colSpan={2} className="px-4 py-4 text-center" style={{ color: COLOR.textMute }}>No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MembersScreen({ members, leaderboard }) {
  const totalsById = Object.fromEntries(leaderboard.map((m) => [m.id, m.totalDeposited]));
  return (
    <div className="px-4 md:px-8 mt-2 space-y-3">
      <h2 className="disp text-xl font-semibold" style={{ color: COLOR.ink }}>Community members</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {members.map((m) => (
          <div key={m.id} className="rounded-xl bg-white border p-4" style={{ borderColor: COLOR.line }}>
            <p className="font-semibold disp text-lg">{m.firstName} {m.lastName}</p>
            <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: COLOR.textMute }}><Phone size={14} /> {m.phone}</p>
            <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: COLOR.textMute }}><MapPin size={14} /> {m.address}</p>
            <p className="text-xs mt-2" style={{ color: COLOR.goldDeep }}>Total deposited: {fmt(totalsById[m.id] || 0)}</p>
          </div>
        ))}
        {!members.length && <p style={{ color: COLOR.textMute }}>No members yet.</p>}
      </div>
    </div>
  );
}

function DepositLedger({ rows }) {
  if (!rows.length) return <p className="text-sm" style={{ color: COLOR.textMute }}>No deposits yet.</p>;
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: COLOR.line, background: COLOR.card }}>
      {rows.map((t) => (
        <div key={t.id} className="ledger-row flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="stamp w-11 h-11 text-[10px]" style={{ color: t.status === "successful" ? COLOR.sage : t.status === "failed" ? COLOR.rust : COLOR.textMute }}>
              {t.method}
            </span>
            <div>
              <p className="font-semibold" style={{ color: COLOR.ink }}>{fmt(t.amount)}</p>
              <p className="text-xs flex items-center gap-1" style={{ color: COLOR.textMute }}><Calendar size={12} /> {fmtDate(t.createdAt)} · {t.status}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="disp text-lg font-semibold" style={{ color: COLOR.ink }}>{title}</h3>
          <button onClick={onClose}><X size={20} style={{ color: COLOR.textMute }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="text-xs font-medium" style={{ color: COLOR.textMute }}>{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: COLOR.line }}
      />
    </div>
  );
}

function AuthScreen({ authMode, setAuthMode, login, setLogin, signup, setSignup, handleLogin, handleSignup, err, busy, apiBase, setApiBase, showSettings, setShowSettings }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 relative">
          <p className="text-xs uppercase tracking-widest" style={{ color: COLOR.goldDeep }}>Njangi Savings</p>
          <h1 className="disp text-3xl font-bold" style={{ color: COLOR.ink }}>Save together</h1>
          <button onClick={() => setShowSettings(!showSettings)} className="absolute right-0 top-0 p-1.5 rounded-full border" style={{ borderColor: COLOR.line, color: COLOR.textMute }}>
            <Settings size={14} />
          </button>
        </div>

        {showSettings && (
          <div className="rounded-xl bg-white border p-3 mb-3" style={{ borderColor: COLOR.line }}>
            <label className="text-xs font-medium" style={{ color: COLOR.textMute }}>Backend web address</label>
            <input
              value={apiBase} onChange={(e) => setApiBase(e.target.value.replace(/\/$/, ""))}
              className="w-full mt-1 px-3 py-2 rounded-lg border text-xs outline-none font-mono"
              style={{ borderColor: COLOR.line }}
              placeholder="https://your-app.up.railway.app"
            />
          </div>
        )}

        <div className="rounded-2xl bg-white border p-5" style={{ borderColor: COLOR.line }}>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAuthMode("login")} className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              style={{ background: authMode === "login" ? COLOR.ink : "transparent", color: authMode === "login" ? "white" : COLOR.textMute }}>
              <LogIn size={14} /> Log in
            </button>
            <button onClick={() => setAuthMode("signup")} className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              style={{ background: authMode === "signup" ? COLOR.ink : "transparent", color: authMode === "signup" ? "white" : COLOR.textMute }}>
              <UserPlus size={14} /> Sign up
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field label="Phone number or email" value={login.id} onChange={(v) => setLogin({ ...login, id: v })} />
              <Field label="Password" type="password" value={login.password} onChange={(v) => setLogin({ ...login, password: v })} />
              {err && <p className="text-sm flex items-center gap-1" style={{ color: COLOR.rust }}><AlertCircle size={14} /> {err}</p>}
              <button disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: COLOR.ink }}>
                {busy && <Loader2 size={16} className="spin" />} Log in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="First name" value={signup.firstName} onChange={(v) => setSignup({ ...signup, firstName: v })} />
                <Field label="Last name" value={signup.lastName} onChange={(v) => setSignup({ ...signup, lastName: v })} />
              </div>
              <Field label="Phone number" value={signup.phone} onChange={(v) => setSignup({ ...signup, phone: v })} />
              <Field label="Email" type="email" value={signup.email} onChange={(v) => setSignup({ ...signup, email: v })} />
              <Field label="Password" type="password" value={signup.password} onChange={(v) => setSignup({ ...signup, password: v })} />
              <Field label="Address" value={signup.address} onChange={(v) => setSignup({ ...signup, address: v })} />
              {err && <p className="text-sm flex items-center gap-1" style={{ color: COLOR.rust }}><AlertCircle size={14} /> {err}</p>}
              <button disabled={busy} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: COLOR.ink }}>
                {busy && <Loader2 size={16} className="spin" />} Create account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
