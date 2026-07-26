import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  LayoutDashboard, ShoppingCart, Receipt, Truck, Box, Package, Building2,
  Store, PanelLeftClose, PanelLeftOpen, AlertTriangle, Banknote, TrendingUp,
  BarChart2, Percent, CheckCircle, Plus, Warehouse, Phone, MapPin, Mail,
  Check, X, LogOut, Loader2, ShieldCheck, RefreshCw, Printer
} from "lucide-react";

// ─── Firebase Config ──────────────────────────────────────────
const FB_DB      = "https://supermart-c62f6-default-rtdb.firebaseio.com";
const FB_API_KEY = "AIzaSyAsEqhJr1p58y5LC5FkvjYjGEHi7IbmFkA";

// ─── Firebase Auth REST API ───────────────────────────────────
async function firebaseSignIn(email, password) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_API_KEY}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ email, password, returnSecureToken:true }) }
  );
  const d = await r.json();
  if (!r.ok) {
    const m = d.error?.message || "";
    if (m.includes("INVALID_LOGIN_CREDENTIALS") || m.includes("EMAIL_NOT_FOUND") || m.includes("INVALID_PASSWORD"))
      throw new Error("Incorrect email or password.");
    if (m.includes("TOO_MANY_ATTEMPTS")) throw new Error("Too many attempts. Try later.");
    throw new Error(m || "Login failed.");
  }
  return d; // { idToken, refreshToken, email }
}

async function firebaseRefresh(token) {
  const r = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FB_API_KEY}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ grant_type:"refresh_token", refresh_token:token }) }
  );
  const d = await r.json();
  if (!r.ok) throw new Error("Session expired.");
  return { idToken: d.id_token, refreshToken: d.refresh_token };
}

// ─── Realtime Database REST Helpers ──────────────────────────
const auth = (tk) => tk ? `?auth=${tk}` : "";

async function dbGet(path, tk) {
  const r = await fetch(`${FB_DB}/${path}.json${auth(tk)}`);
  if (!r.ok) throw new Error(`DB ${r.status}`);
  return r.json();
}
function dbPut(path, data, tk) {
  return fetch(`${FB_DB}/${path}.json${auth(tk)}`, {
    method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
  });
}
function dbPatch(updates, tk) {
  return fetch(`${FB_DB}/.json${auth(tk)}`, {
    method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(updates)
  });
}
function dbDelete(path, tk) {
  return fetch(`${FB_DB}/${path}.json${auth(tk)}`, { method:"DELETE" });
}

// ─── Helpers ──────────────────────────────────────────────────
const PKR   = n => `Rs. ${Number(n).toLocaleString("en-PK",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const today = () => new Date().toISOString().split("T")[0];
const uid   = () => Math.random().toString(36).slice(2,9).toUpperCase();
const fmt   = d => new Date(d).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"});
const CATS  = ["Grains & Flour","Dairy & Eggs","Beverages","Snacks","Spices","Frozen","Personal Care","Cleaning","Bakery","Other"];

// ─── Receipt Printer ──────────────────────────────────────────
function printReceipt(sale) {
  const subtotal = sale.items.reduce((a,i)=>a+i.qty*i.price,0);
  const win = window.open("","_blank","width=400,height=650");
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt ${sale.id}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;font-size:13px;color:#111;padding:20px;width:320px;margin:auto}
    .center{text-align:center} .bold{font-weight:bold} .big{font-size:16px}
    .line{border-top:1px dashed #aaa;margin:10px 0}
    .row{display:flex;justify-content:space-between;padding:3px 0}
    .total-row{display:flex;justify-content:space-between;padding:6px 0;font-weight:bold;font-size:15px}
    .footer{text-align:center;font-size:11px;color:#555;margin-top:6px}
    @media print{body{padding:0}button{display:none!important}.no-print{display:none!important}}
  </style></head><body>
  <div class="center bold big">SUPER MART</div>
  <div class="center" style="font-size:11px;color:#555;margin:4px 0">Your Trusted Shopping Destination</div>
  <div class="center" style="font-size:11px;color:#555">Phone: 0349-5105206</div>
  <div class="line"></div>
  <div class="row"><span>Invoice:</span><span class="bold">${sale.id}</span></div>
  <div class="row"><span>Date:</span><span>${new Date(sale.date).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"})}</span></div>
  <div class="row"><span>Customer:</span><span>${sale.customer||"Walk-in"}</span></div>
  <div class="row"><span>Payment:</span><span>${sale.payMode}</span></div>
  <div class="line"></div>
  <div class="row bold"><span>Item</span><span>Qty&nbsp;&nbsp;Price&nbsp;&nbsp;Amt</span></div>
  <div class="line"></div>
  ${sale.items.map(it=>`
    <div style="padding:3px 0">
      <div class="bold" style="font-size:12px">${it.name}</div>
      <div class="row" style="color:#444">
        <span></span>
        <span>${it.qty} × Rs.${it.price.toLocaleString()} = <b>Rs.${(it.qty*it.price).toLocaleString()}</b></span>
      </div>
    </div>`).join("")}
  <div class="line"></div>
  <div class="row"><span>Subtotal</span><span>Rs.${subtotal.toLocaleString()}</span></div>
  ${sale.discount>0?`<div class="row"><span>Discount</span><span>− Rs.${sale.discount.toLocaleString()}</span></div>`:""}
  <div class="line"></div>
  <div class="total-row"><span>TOTAL</span><span>Rs.${sale.total.toLocaleString()}</span></div>
  <div class="row"><span>Amount Paid</span><span>Rs.${sale.paid.toLocaleString()}</span></div>
  <div class="line"></div>
  <div class="footer">Thank you for shopping with us!<br/>Please come again<br/>
  *** ${new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"})} ***</div>
  <br/>
  <div class="no-print" style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 28px;background:#3B6D11;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold">🖨️ Print</button>
    <button onclick="window.close()" style="padding:10px 20px;background:#eee;color:#333;border:none;border-radius:8px;font-size:14px;cursor:pointer;margin-left:8px">Close</button>
  </div>
  <script>setTimeout(()=>window.print(),400)</script>
  </body></html>`);
  win.document.close();
}

// ─── PrintReceipt UI Card (shown after checkout) ──────────────
function PrintReceipt({ sale, onClose, closeLabel="Close" }) {
  const subtotal = sale.items.reduce((a,i)=>a+i.qty*i.price,0);
  return (
    <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:16,padding:28}}>
      {/* Success header */}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:56,height:56,background:"#1e2a1a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
          <CheckCircle size={32} color="#97C459"/>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:"#fff"}}>Sale Saved!</div>
        <div style={{fontSize:12,color:"#7a7f8a",marginTop:4}}>Invoice #{sale.id} · synced to Firebase</div>
      </div>

      {/* Receipt preview */}
      <div style={{background:"#0f1117",border:"1px dashed #3a3f4a",borderRadius:10,padding:20,marginBottom:16,fontFamily:"'Courier New',monospace"}}>
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:700,color:"#fff",letterSpacing:1}}>SUPER MART</div>
          <div style={{fontSize:10,color:"#7a7f8a"}}>Your Trusted Shopping Destination</div>
          <div style={{borderTop:"1px dashed #2a2d35",margin:"10px 0"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#8a8f9a",marginBottom:3}}><span>Invoice</span><span style={{color:"#97C459",fontWeight:600}}>{sale.id}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#8a8f9a",marginBottom:3}}><span>Date</span><span>{fmt(sale.date)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#8a8f9a",marginBottom:3}}><span>Customer</span><span>{sale.customer}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#8a8f9a",marginBottom:3}}><span>Payment</span><span style={{color:sale.payMode==="Cash"?"#97C459":"#85B7EB"}}>{sale.payMode}</span></div>
        <div style={{borderTop:"1px dashed #2a2d35",margin:"10px 0"}}/>
        {sale.items.map(it=>(
          <div key={it.pid} style={{marginBottom:6}}>
            <div style={{fontSize:12,color:"#ddd",fontWeight:600}}>{it.name}</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7a7f8a"}}>
              <span>{it.qty} × {PKR(it.price)}</span>
              <span style={{color:"#c8c8c8",fontWeight:600}}>{PKR(it.qty*it.price)}</span>
            </div>
          </div>
        ))}
        <div style={{borderTop:"1px dashed #2a2d35",margin:"10px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8a8f9a",marginBottom:3}}><span>Subtotal</span><span>{PKR(subtotal)}</span></div>
        {sale.discount>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#FAC775",marginBottom:3}}><span>Discount</span><span>−{PKR(sale.discount)}</span></div>}
        <div style={{borderTop:"1px dashed #2a2d35",margin:"10px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,color:"#fff"}}><span>TOTAL</span><span style={{color:"#97C459"}}>{PKR(sale.total)}</span></div>
        <div style={{textAlign:"center",marginTop:14,fontSize:11,color:"#5a5f6a"}}>
          ★ Thank you for shopping with us! ★
        </div>
      </div>

      {/* Action buttons */}
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>printReceipt(sale)}
          style={{flex:1,padding:"11px",background:"#3B6D11",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Printer size={15} color="#fff"/> Print Receipt
        </button>
        <button onClick={onClose}
          style={{flex:1,padding:"11px",background:"transparent",border:"1px solid #2a2d35",borderRadius:10,color:"#8a8f9a",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Seed Data ────────────────────────────────────────────────
const SEED_SUPPLIERS = [
  {id:"S001",name:"Falak Foods Ltd.",     contact:"0300-1234567",city:"Lahore", email:"falak@foods.pk"},
  {id:"S002",name:"Nestle Pakistan",      contact:"0321-9876543",city:"Karachi",email:"info@nestle.pk"},
  {id:"S003",name:"Shezan International", contact:"0333-5554444",city:"Lahore", email:"orders@shezan.pk"},
  {id:"S004",name:"National Foods",       contact:"0311-2223333",city:"Karachi",email:"sales@national.pk"},
];
const SEED_PRODUCTS = [
  {id:"P001",name:"Basmati Rice 5kg",        category:"Grains & Flour", price:950, cost:720,stock:85, unit:"bag", minStock:15,supplier:"S001"},
  {id:"P002",name:"Sunridge Flour 10kg",     category:"Grains & Flour", price:1200,cost:950,stock:60, unit:"bag", minStock:10,supplier:"S001"},
  {id:"P003",name:"Nestle Milk Pack 1L",     category:"Dairy & Eggs",   price:290, cost:230,stock:120,unit:"pcs", minStock:30,supplier:"S002"},
  {id:"P004",name:"Nestle NesQuik 400g",     category:"Beverages",      price:750, cost:590,stock:40, unit:"pcs", minStock:10,supplier:"S002"},
  {id:"P005",name:"Shezan Mango 1L",         category:"Beverages",      price:180, cost:130,stock:200,unit:"pcs", minStock:40,supplier:"S003"},
  {id:"P006",name:"Lays Classic 34g",        category:"Snacks",         price:60,  cost:45, stock:300,unit:"pcs", minStock:50,supplier:"S004"},
  {id:"P007",name:"National Biryani Masala", category:"Spices",         price:95,  cost:70, stock:150,unit:"pcs", minStock:25,supplier:"S004"},
  {id:"P008",name:"Egg Tray (30 pcs)",       category:"Dairy & Eggs",   price:720, cost:600,stock:8,  unit:"tray",minStock:10,supplier:"S001"},
  {id:"P009",name:"Surf Excel 500g",         category:"Cleaning",       price:450, cost:360,stock:75, unit:"pcs", minStock:15,supplier:"S002"},
  {id:"P010",name:"Colgate Toothpaste 100ml",category:"Personal Care",  price:210, cost:165,stock:90, unit:"pcs", minStock:20,supplier:"S002"},
];
const SEED_SALES = [
  {id:"INV-001",date:"2025-06-01",customer:"Walk-in",     payMode:"Cash",total:2800,discount:0,paid:2800,items:[{pid:"P001",name:"Basmati Rice 5kg",qty:2,price:950},{pid:"P005",name:"Shezan Mango 1L",qty:5,price:180}]},
  {id:"INV-002",date:"2025-06-02",customer:"Ahmed Khan",  payMode:"Cash",total:2340,discount:0,paid:2340,items:[{pid:"P003",name:"Nestle Milk Pack 1L",qty:6,price:290},{pid:"P006",name:"Lays Classic 34g",qty:10,price:60}]},
  {id:"INV-003",date:"2025-06-03",customer:"Walk-in",     payMode:"Card",total:2190,discount:0,paid:2190,items:[{pid:"P009",name:"Surf Excel 500g",qty:3,price:450},{pid:"P010",name:"Colgate Toothpaste 100ml",qty:4,price:210}]},
  {id:"INV-004",date:"2025-06-04",customer:"Fatima Store",payMode:"Cash",total:2685,discount:0,paid:2685,items:[{pid:"P002",name:"Sunridge Flour 10kg",qty:2,price:1200},{pid:"P007",name:"National Biryani Masala",qty:3,price:95}]},
  {id:"INV-005",date:"2025-06-05",customer:"Walk-in",     payMode:"Cash",total:2940,discount:0,paid:2940,items:[{pid:"P004",name:"Nestle NesQuik 400g",qty:2,price:750},{pid:"P005",name:"Shezan Mango 1L",qty:8,price:180}]},
];
const SEED_PURCHASES = [
  {id:"PO-001",date:"2025-05-28",supplier:"S001",status:"Received",total:36000,items:[{pid:"P001",name:"Basmati Rice 5kg",qty:50,cost:720}]},
  {id:"PO-002",date:"2025-05-30",supplier:"S002",status:"Received",total:23000,items:[{pid:"P003",name:"Nestle Milk Pack 1L",qty:100,cost:230}]},
  {id:"PO-003",date:"2025-06-02",supplier:"S004",status:"Received",total:12500,items:[{pid:"P006",name:"Lays Classic 34g",qty:200,cost:45},{pid:"P007",name:"National Biryani Masala",qty:50,cost:70}]},
];

// ─── Realtime DB Hook ─────────────────────────────────────────
const POLL_MS = 6000;

function useFireDB(path, seedData, tk) {
  const [data,    setData]    = useState([]);
  const [ready,   setReady]   = useState(false);
  const [dbError, setDbError] = useState(null);
  const seeded = useRef(false);

  const load = useCallback(async () => {
    if (!tk) return;
    try {
      const val = await dbGet(path, tk);
      if (val?.error) { setDbError(`Permission denied on /${path}.`); return; }
      if (!val && seedData.length > 0 && !seeded.current) {
        seeded.current = true;
        const upd = {};
        seedData.forEach(i => { upd[`${path}/${i.id}`] = i; });
        await dbPatch(upd, tk);
        return; // next poll will set data
      }
      setData(val ? Object.values(val) : []);
      setDbError(null);
      setReady(true);
    } catch (e) { setDbError(e.message); }
  }, [path, tk]); // eslint-disable-line

  useEffect(() => {
    if (!tk) return;
    seeded.current = false;
    setReady(false);
    setDbError(null);
    load();
    const poll = setInterval(load, POLL_MS);
    const tout = setTimeout(() => {
      setReady(r => { if (!r) setDbError(`Timeout: /${path} — check Firebase rules.`); return r; });
    }, 12000);
    return () => { clearInterval(poll); clearTimeout(tout); };
  }, [path, tk, load]);

  const save      = useCallback(async item => { await dbPut(`${path}/${item.id}`, item, tk); load(); }, [path, tk, load]);
  const del       = useCallback(async id   => { await dbDelete(`${path}/${id}`, tk); load(); }, [path, tk, load]);
  const batchSave = useCallback(async items => {
    const upd = {}; items.forEach(i => { upd[`${path}/${i.id}`] = i; });
    await dbPatch(upd, tk); load();
  }, [path, tk, load]);
  const crossBatch = useCallback(async upd => { await dbPatch(upd, tk); load(); }, [tk, load]);

  return { data, ready, dbError, save, del, batchSave, crossBatch };
}

// ─── Spinner ──────────────────────────────────────────────────
function Spinner({ label = "Loading…" }) {
  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"'Outfit',sans-serif"}}>
      <div style={{width:52,height:52,background:"#1e2a1a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Loader2 size={28} color="#97C459" style={{animation:"spin 1s linear infinite"}}/>
      </div>
      <div style={{color:"#7a7f8a",fontSize:13}}>{label}</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Firebase Error Screen ────────────────────────────────────
function FirebaseError({ error, onRetry, onLogout }) {
  const isPerm = /401|403|PERMISSION|Permission|denied/i.test(error || "");
  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Outfit',sans-serif"}}>
      <div style={{maxWidth:520,width:"100%",background:"#16191f",border:"1px solid #711B13",borderRadius:20,padding:36}}>
        <div style={{width:56,height:56,background:"#1a1210",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
          <AlertTriangle size={28} color="#F09595"/>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:"#fff",textAlign:"center",marginBottom:8}}>
          {isPerm ? "Firebase Permission Denied" : "Cannot Connect to Firebase"}
        </div>
        <div style={{fontSize:12,color:"#7a7f8a",textAlign:"center",marginBottom:24}}>{error}</div>
        {isPerm && (
          <div style={{background:"#0f1117",border:"1px solid #2a2d35",borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:600,color:"#FAC775",marginBottom:10}}>
              Fix: Firebase Console → Realtime Database → Rules → Publish:
            </div>
            <pre style={{background:"#1a1d23",borderRadius:8,padding:14,fontSize:12,color:"#97C459",margin:0}}>{`{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}`}</pre>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onRetry} style={{flex:1,padding:"11px",background:"#3B6D11",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <RefreshCw size={14} color="#fff"/> Retry
          </button>
          <button onClick={onLogout} style={{padding:"11px 18px",background:"transparent",border:"1px solid #2a2d35",borderRadius:10,color:"#8a8f9a",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <LogOut size={14} color="#8a8f9a"/> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────
function Login({ onLogin }) {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !pass.trim()) { setErr("Please enter email and password."); return; }
    setErr(""); setLoading(true);
    try {
      const res = await firebaseSignIn(email.trim(), pass);
      onLogin(res);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif"}}>
      <div style={{width:400,background:"#16191f",border:"1px solid #2a2d35",borderRadius:20,padding:40}}>

        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:60,height:60,background:"#3B6D11",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
            <Store size={30} color="#C0DD97"/>
          </div>
          <div style={{fontSize:22,fontWeight:700,color:"#fff"}}>Super Mart</div>
          <div style={{fontSize:13,color:"#7a7f8a",marginTop:4}}>Management System</div>
        </div>

        <div style={{background:"#1a2810",border:"1px solid #3B6D11",borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:12}}>
          <div style={{color:"#97C459",fontWeight:600,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
            <ShieldCheck size={13} color="#97C459"/> Firebase Authentication
          </div>
          <div style={{color:"#8a8f9a",lineHeight:1.7}}>
            Sign in with the email &amp; password you added in<br/>
            <span style={{color:"#85B7EB"}}>Firebase Console → Authentication → Users → Add user</span>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={{fontSize:11,color:"#7a7f8a",display:"block",marginBottom:5}}>Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="you@example.com" disabled={loading}
              style={{width:"100%",padding:"11px 14px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:10,color:"#e8e8e8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:"#7a7f8a",display:"block",marginBottom:5}}>Password</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" disabled={loading}
              style={{width:"100%",padding:"11px 14px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:10,color:"#e8e8e8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {err && (
            <div style={{background:"#1a1210",border:"1px solid #711B13",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#F09595",display:"flex",gap:8,alignItems:"center"}}>
              <AlertTriangle size={14} color="#F09595" style={{flexShrink:0}}/> {err}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            style={{padding:"13px",background:loading?"#1e2128":"#3B6D11",border:"none",borderRadius:10,color:loading?"#7a7f8a":"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}>
            {loading
              ? <><Loader2 size={16} color="#7a7f8a" style={{animation:"spin 1s linear infinite"}}/> Signing in…</>
              : <><Check size={16} color="#fff"/> Sign In</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null); // { idToken, refreshToken, email }

  const handleLogin = res => setSession({ idToken:res.idToken, refreshToken:res.refreshToken, email:res.email });

  const refreshSession = useCallback(async () => {
    if (!session?.refreshToken) { setSession(null); return; }
    try {
      const t = await firebaseRefresh(session.refreshToken);
      setSession(s => ({ ...s, ...t }));
    } catch { setSession(null); }
  }, [session]);

  if (!session) return <Login onLogin={handleLogin}/>;
  return <SuperMart session={session} onLogout={() => setSession(null)} onRefresh={refreshSession}/>;
}

// ─── Main Shell ───────────────────────────────────────────────
function SuperMart({ session, onLogout, onRefresh }) {
  const tk = session.idToken;

  const { data:products,  ready:pR,  dbError:pE,  save:saveProduct,  del:delProduct,  batchSave:batchProducts, crossBatch } = useFireDB("products",  SEED_PRODUCTS,  tk);
  const { data:suppliers, ready:sR,  dbError:sE,  save:saveSupplier, del:delSupplier                                      } = useFireDB("suppliers", SEED_SUPPLIERS, tk);
  const { data:sales,     ready:slR, dbError:slE, save:saveSale                                                           } = useFireDB("sales",     SEED_SALES,     tk);
  const { data:purchases, ready:puR, dbError:puE, save:savePurchase                                                       } = useFireDB("purchases", SEED_PURCHASES, tk);

  const [page,     setPage]     = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(true);

  const allReady = pR && sR && slR && puR;
  const anyError = pE || sE || slE || puE;

  const lowStock       = products.filter(p => p.stock <= p.minStock);
  const todayRevenue   = sales.filter(s => s.date === today()).reduce((a,s) => a+s.total, 0);
  const totalRevenue   = sales.reduce((a,s)  => a+s.total,  0);
  const totalPurchases = purchases.reduce((a,p) => a+p.total, 0);

  // Auto-refresh token 5 min before the 1-hour expiry
  useEffect(() => {
    const id = setTimeout(onRefresh, 55 * 60 * 1000);
    return () => clearTimeout(id);
  }, [tk]); // eslint-disable-line

  const nav = [
    { id:"dashboard", Icon:LayoutDashboard, label:"Dashboard"    },
    { id:"pos",       Icon:ShoppingCart,    label:"New Sale"      },
    { id:"sales",     Icon:Receipt,         label:"Sales History" },
    { id:"purchases", Icon:Truck,           label:"Purchases"     },
    { id:"stock",     Icon:Box,             label:"Stock"         },
    { id:"products",  Icon:Package,         label:"Products"      },
    { id:"suppliers", Icon:Building2,       label:"Suppliers"     },
  ];

  if (anyError && !allReady) return <FirebaseError error={anyError} onRetry={() => window.location.reload()} onLogout={onLogout}/>;
  if (!allReady) return <Spinner label="Loading data from Firebase…"/>;

  return (
    <div style={{display:"flex",height:"100vh",background:"#0f1117",color:"#e8e8e8",fontFamily:"'Outfit',sans-serif",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Sidebar */}
      <div style={{width:sideOpen?220:64,background:"#16191f",borderRight:"1px solid #2a2d35",display:"flex",flexDirection:"column",transition:"width 0.2s",flexShrink:0,overflow:"hidden"}}>
        <div style={{padding:"20px 16px",borderBottom:"1px solid #2a2d35",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"#3B6D11",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Store size={18} color="#C0DD97"/>
          </div>
          {sideOpen && <div><div style={{fontSize:14,fontWeight:700,color:"#fff"}}>Super Mart</div><div style={{fontSize:11,color:"#7a7f8a"}}>Management System</div></div>}
        </div>

        <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2}}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:8,border:"none",background:page===n.id?"#1e2a1a":"transparent",color:page===n.id?"#97C459":"#8a8f9a",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap"}}>
              <n.Icon size={18} color={page===n.id?"#97C459":"#8a8f9a"} style={{flexShrink:0}}/>
              {sideOpen && <span style={{fontSize:13,fontWeight:page===n.id?600:400}}>{n.label}</span>}
              {sideOpen && n.id==="stock" && lowStock.length>0 &&
                <span style={{marginLeft:"auto",background:"#4A1B0C",color:"#F09595",fontSize:10,padding:"1px 6px",borderRadius:10,fontWeight:600}}>{lowStock.length}</span>}
            </button>
          ))}
        </nav>

        {sideOpen && (
          <div style={{padding:"12px 14px",borderTop:"1px solid #2a2d35"}}>
            <div style={{fontSize:11,color:"#c8c8c8",fontWeight:500,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}}>
              <Mail size={13} color="#7a7f8a" style={{flexShrink:0}}/>{session.email}
            </div>
            <button onClick={onLogout}
              style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"1px solid #2a2d35",borderRadius:7,color:"#F09595",padding:"6px 10px",fontSize:11,cursor:"pointer",width:"100%"}}>
              <LogOut size={12} color="#F09595"/> Sign Out
            </button>
          </div>
        )}

        <button onClick={() => setSideOpen(p=>!p)}
          style={{margin:"12px 8px",padding:"8px",borderRadius:8,border:"1px solid #2a2d35",background:"transparent",cursor:"pointer",display:"flex",justifyContent:"center"}}>
          {sideOpen ? <PanelLeftClose size={16} color="#7a7f8a"/> : <PanelLeftOpen size={16} color="#7a7f8a"/>}
        </button>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
        <header style={{padding:"16px 24px",borderBottom:"1px solid #2a2d35",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#16191f",flexShrink:0}}>
          <div>
            <div style={{fontSize:18,fontWeight:600,color:"#fff"}}>{nav.find(n=>n.id===page)?.label}</div>
            <div style={{fontSize:12,color:"#7a7f8a"}}>{fmt(new Date())}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#7a7f8a"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#97C459",animation:"pulse 2s infinite"}}/>
              Firebase Live
            </div>
            {lowStock.length>0 && (
              <button onClick={() => setPage("stock")}
                style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",borderRadius:8,border:"1px solid #711B13",background:"#1a1210",color:"#F09595",fontSize:12,cursor:"pointer"}}>
                <AlertTriangle size={15} color="#F09595"/>
                {lowStock.length} low stock alert{lowStock.length>1?"s":""}
              </button>
            )}
          </div>
        </header>

        <div style={{flex:1,padding:24,overflow:"auto"}}>
          {page==="dashboard" && <Dashboard sales={sales} purchases={purchases} products={products} todayRevenue={todayRevenue} totalRevenue={totalRevenue} totalPurchases={totalPurchases} lowStock={lowStock} setPage={setPage}/>}
          {page==="pos"       && <POS products={products} saveSale={saveSale} crossBatch={crossBatch}/>}
          {page==="sales"     && <Sales sales={sales}/>}
          {page==="purchases" && <Purchases purchases={purchases} savePurchase={savePurchase} products={products} batchProducts={batchProducts} suppliers={suppliers}/>}
          {page==="stock"     && <Stock products={products} saveProduct={saveProduct} lowStock={lowStock}/>}
          {page==="products"  && <Products products={products} saveProduct={saveProduct} delProduct={delProduct} suppliers={suppliers}/>}
          {page==="suppliers" && <Suppliers suppliers={suppliers} saveSupplier={saveSupplier} delSupplier={delSupplier}/>}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
function Dashboard({ sales, purchases, products, todayRevenue, totalRevenue, totalPurchases, lowStock, setPage }) {
  const [viewSale, setViewSale] = useState(null);
  const last7 = useMemo(() => {
    const days = [];
    for (let i=6;i>=0;i--) {
      const d=new Date(); d.setDate(d.getDate()-i);
      const k=d.toISOString().split("T")[0];
      days.push({day:d.toLocaleDateString("en",{weekday:"short"}),revenue:sales.filter(s=>s.date===k).reduce((a,s)=>a+s.total,0)});
    }
    return days;
  },[sales]);

  const profit = totalRevenue - totalPurchases;
  const margin = totalRevenue>0 ? ((profit/totalRevenue)*100).toFixed(1) : 0;

  const cards = [
    {label:"Today's Revenue",  value:PKR(todayRevenue),   Icon:Banknote,   color:"#97C459"},
    {label:"Total Revenue",    value:PKR(totalRevenue),   Icon:TrendingUp, color:"#85B7EB"},
    {label:"Total Purchases",  value:PKR(totalPurchases), Icon:Truck,      color:"#FAC775"},
    {label:"Gross Profit",     value:PKR(profit),         Icon:BarChart2,  color:profit>=0?"#97C459":"#F09595"},
  ];
  const stats = [
    {label:"Total Products",  val:products.length,  Icon:Package,       warn:false},
    {label:"Total Sales",     val:sales.length,     Icon:Receipt,       warn:false},
    {label:"Total Purchases", val:purchases.length, Icon:Truck,         warn:false},
    {label:"Profit Margin",   val:margin+"%",       Icon:Percent,       warn:false},
    {label:"Low Stock Items", val:lowStock.length,  Icon:AlertTriangle, warn:lowStock.length>0},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
        {cards.map(({label,value,Icon,color})=>(
          <div key={label} style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,padding:"18px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:12,color:"#7a7f8a",marginBottom:6}}>{label}</div>
                <div style={{fontSize:22,fontWeight:700,color:"#fff"}}>{value}</div>
              </div>
              <div style={{width:38,height:38,borderRadius:10,background:color+"22",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon size={20} color={color}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"#c8c8c8",marginBottom:16}}>Revenue — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={last7} barSize={28}>
              <XAxis dataKey="day" tick={{fontSize:11,fill:"#7a7f8a"}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip formatter={v=>PKR(v)} contentStyle={{background:"#1e2128",border:"1px solid #2a2d35",borderRadius:8,fontSize:12}}/>
              <Bar dataKey="revenue" fill="#3B6D11" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"#c8c8c8",marginBottom:12}}>Quick Stats</div>
          {stats.map(({label,val,Icon,warn})=>(
            <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e2128"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#8a8f9a"}}>
                <Icon size={15} color={warn?"#F09595":"#97C459"}/> {label}
              </div>
              <span style={{fontSize:13,fontWeight:600,color:warn?"#F09595":"#fff"}}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {lowStock.length>0 && (
        <div style={{background:"#1a1210",border:"1px solid #711B13",borderRadius:12,padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:"#F09595",display:"flex",alignItems:"center",gap:8}}>
              <AlertTriangle size={15} color="#F09595"/> Low Stock Alerts
            </div>
            <button onClick={()=>setPage("stock")} style={{fontSize:11,color:"#97C459",background:"transparent",border:"none",cursor:"pointer"}}>View All →</button>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {lowStock.map(p=>(
              <div key={p.id} style={{background:"#1e1614",border:"1px solid #3d2020",borderRadius:8,padding:"8px 12px",fontSize:12}}>
                <div style={{color:"#ddd",fontWeight:500}}>{p.name}</div>
                <div style={{color:"#F09595",marginTop:2}}>Stock: {p.stock} {p.unit} (min: {p.minStock})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:"#c8c8c8"}}>Recent Sales</div>
          <button onClick={()=>setPage("sales")} style={{fontSize:11,color:"#97C459",background:"transparent",border:"none",cursor:"pointer"}}>View All →</button>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid #2a2d35"}}>
            {["Invoice","Date","Customer","Items","Total","Payment"].map(h=>
              <th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#7a7f8a",fontWeight:500,fontSize:11,textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[...sales].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(s=>(
              <tr key={s.id} style={{borderBottom:"1px solid #1e2128"}}
                onMouseEnter={e=>e.currentTarget.style.background="#1a1d23"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"10px",color:"#97C459",fontWeight:600}}>{s.id}</td>
                <td style={{padding:"10px",color:"#c8c8c8"}}>{fmt(s.date)}</td>
                <td style={{padding:"10px",color:"#c8c8c8"}}>{s.customer}</td>
                <td style={{padding:"10px",color:"#c8c8c8"}}>{s.items?.length} item{s.items?.length>1?"s":""}</td>
                <td style={{padding:"10px",color:"#fff",fontWeight:600}}>{PKR(s.total)}</td>
                <td style={{padding:"10px"}}>
                  <button onClick={()=>setViewSale(s)}
                    style={{display:"inline-flex",alignItems:"center",gap:7,background:s.payMode==="Cash"?"#1e2a1a":s.payMode==="Card"?"#0e1e2a":"#1a1d13",border:`1px solid ${s.payMode==="Cash"?"#2a4a1a":s.payMode==="Card"?"#0e2a3a":"#2a1d13"}`,borderRadius:7,padding:"4px 10px 4px 8px",cursor:"pointer"}}>
                    <span style={{color:s.payMode==="Cash"?"#97C459":s.payMode==="Card"?"#85B7EB":"#FAC775",fontSize:11,fontWeight:600}}>{s.payMode}</span>
                    <span style={{width:"1px",height:12,background:s.payMode==="Cash"?"#2a4a1a":s.payMode==="Card"?"#0e2a3a":"#2a1d13"}}/>
                    <span style={{fontSize:11,color:"#7a7f8a"}}>View</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sale detail modal */}
      {viewSale && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:20}}>
          <div style={{width:"100%",maxWidth:480}}>
            <PrintReceipt sale={viewSale} onClose={()=>setViewSale(null)} closeLabel="Close"/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS ──────────────────────────────────────────────────────
function POS({ products, saveSale, crossBatch }) {
  const [cart,     setCart]     = useState([]);
  const [search,   setSearch]   = useState("");
  const [customer, setCustomer] = useState("Walk-in");
  const [discount, setDiscount] = useState(0);
  const [payMode,  setPayMode]  = useState("Cash");
  const [done,     setDone]     = useState(null);
  const [saving,   setSaving]   = useState(false);

  const filtered = products.filter(p=>p.stock>0&&(!search||p.name.toLowerCase().includes(search.toLowerCase())));
  const subtotal = cart.reduce((a,c)=>a+c.price*c.qty,0);
  const discAmt  = (subtotal*discount)/100;
  const total    = subtotal-discAmt;

  const addToCart = p => setCart(prev=>{
    const ex=prev.find(c=>c.pid===p.id);
    if(ex) return prev.map(c=>c.pid===p.id?{...c,qty:c.qty+1}:c);
    return [...prev,{pid:p.id,name:p.name,price:p.price,qty:1,max:p.stock}];
  });
  const updateQty = (pid,qty) => {
    if(qty<=0){setCart(prev=>prev.filter(c=>c.pid!==pid));return;}
    setCart(prev=>prev.map(c=>c.pid===pid?{...c,qty:Math.min(qty,c.max)}:c));
  };

  const checkout = async () => {
    if(!cart.length||saving) return;
    setSaving(true);
    try {
      const inv = {id:"INV-"+uid(),date:today(),items:cart.map(c=>({pid:c.pid,name:c.name,qty:c.qty,price:c.price})),total,customer,discount:discAmt,paid:total,payMode};
      const upd = {[`sales/${inv.id}`]:inv};
      cart.forEach(c=>{const p=products.find(x=>x.id===c.pid);if(p) upd[`products/${p.id}`]={...p,stock:p.stock-c.qty};});
      await crossBatch(upd);
      setDone(inv); setCart([]); setCustomer("Walk-in"); setDiscount(0);
    } finally { setSaving(false); }
  };

  if (done) return (
    <div style={{maxWidth:500,margin:"0 auto"}}>
      <PrintReceipt sale={done} onClose={()=>setDone(null)} closeLabel="New Sale"/>
    </div>
  );

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:20,height:"calc(100vh - 140px)"}}>
      <div style={{display:"flex",flexDirection:"column",gap:16,overflow:"hidden"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
          style={{padding:"10px 14px",background:"#16191f",border:"1px solid #2a2d35",borderRadius:10,color:"#e8e8e8",fontSize:13,outline:"none"}}/>
        <div style={{overflow:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
            {filtered.map(p=>(
              <button key={p.id} onClick={()=>addToCart(p)}
                style={{background:"#16191f",border:`1px solid ${cart.find(c=>c.pid===p.id)?"#3B6D11":"#2a2d35"}`,borderRadius:12,padding:"14px 12px",cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:11,color:"#7a7f8a",marginBottom:4}}>{p.category}</div>
                <div style={{fontSize:13,fontWeight:600,color:"#ddd",marginBottom:8,lineHeight:1.3}}>{p.name}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#97C459"}}>{PKR(p.price)}</span>
                  <span style={{fontSize:11,color:p.stock<=p.minStock?"#F09595":"#7a7f8a"}}>Stock: {p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:14,padding:20,display:"flex",flexDirection:"column",gap:14,overflow:"hidden"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:8}}>
          <ShoppingCart size={18} color="#97C459"/>
          Cart {cart.length>0 && <span style={{fontSize:11,background:"#3B6D11",color:"#C0DD97",padding:"2px 7px",borderRadius:10}}>{cart.length}</span>}
        </div>
        <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Customer name"
          style={{padding:"8px 10px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:12,outline:"none"}}/>
        <div style={{flex:1,overflow:"auto"}}>
          {cart.length===0
            ? <div style={{textAlign:"center",color:"#4a4f5a",fontSize:13,paddingTop:40}}>Add products to cart</div>
            : cart.map(c=>(
              <div key={c.pid} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:"1px solid #1e2128"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500,color:"#ddd"}}>{c.name}</div>
                  <div style={{fontSize:11,color:"#7a7f8a"}}>{PKR(c.price)} each</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>updateQty(c.pid,c.qty-1)} style={{width:24,height:24,borderRadius:6,border:"1px solid #2a2d35",background:"#1e2128",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <span style={{fontSize:13,fontWeight:600,color:"#fff",minWidth:20,textAlign:"center"}}>{c.qty}</span>
                  <button onClick={()=>updateQty(c.pid,c.qty+1)} style={{width:24,height:24,borderRadius:6,border:"1px solid #2a2d35",background:"#1e2128",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
                <span style={{fontSize:12,fontWeight:600,color:"#97C459",minWidth:70,textAlign:"right"}}>{PKR(c.qty*c.price)}</span>
              </div>
            ))
          }
        </div>
        <div style={{borderTop:"1px solid #2a2d35",paddingTop:14}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#7a7f8a",marginBottom:4}}>Discount %</div>
              <input type="number" min={0} max={100} value={discount} onChange={e=>setDiscount(Number(e.target.value))}
                style={{width:"100%",padding:"7px 10px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#7a7f8a",marginBottom:4}}>Payment</div>
              <select value={payMode} onChange={e=>setPayMode(e.target.value)}
                style={{width:"100%",padding:"7px 10px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none"}}>
                <option>Cash</option><option>Card</option><option>JazzCash</option><option>EasyPaisa</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7a7f8a",marginBottom:4}}><span>Subtotal</span><span style={{color:"#c8c8c8"}}>{PKR(subtotal)}</span></div>
          {discount>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#FAC775",marginBottom:4}}><span>Discount ({discount}%)</span><span>−{PKR(discAmt)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:18,fontWeight:700,color:"#fff",margin:"10px 0 14px"}}><span>Total</span><span style={{color:"#97C459"}}>{PKR(total)}</span></div>
          <button onClick={checkout} disabled={!cart.length||saving}
            style={{width:"100%",padding:"13px",background:cart.length&&!saving?"#3B6D11":"#1e2128",border:"none",borderRadius:10,color:cart.length&&!saving?"#fff":"#4a4f5a",fontSize:14,fontWeight:700,cursor:cart.length&&!saving?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {saving?<><Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/> Saving…</>:<><Check size={16}/> Checkout</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sales History ────────────────────────────────────────────
function Sales({ sales }) {
  const [search, setSearch] = useState("");
  const [view,   setView]   = useState(null);
  const filtered = search ? sales.filter(s=>s.id?.includes(search.toUpperCase())||s.customer?.toLowerCase().includes(search.toLowerCase())) : sales;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by invoice or customer…"
          style={{flex:1,padding:"9px 14px",background:"#16191f",border:"1px solid #2a2d35",borderRadius:10,color:"#e8e8e8",fontSize:13,outline:"none"}}/>
        <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:10,padding:"9px 16px",fontSize:13,color:"#97C459",fontWeight:600}}>
          {filtered.length} sales · {PKR(filtered.reduce((a,s)=>a+s.total,0))}
        </div>
      </div>

      {view && (
        <div style={{background:"#16191f",border:"1px solid #3B6D11",borderRadius:14,padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"#97C459"}}>{view.id}</div>
              <div style={{fontSize:12,color:"#7a7f8a"}}>{fmt(view.date)} · {view.customer} · {view.payMode}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>printReceipt(view)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"#3B6D11",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                <Printer size={13} color="#fff"/> Print Receipt
              </button>
              <button onClick={()=>setView(null)} style={{background:"transparent",border:"none",cursor:"pointer"}}><X size={18} color="#7a7f8a"/></button>
            </div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #2a2d35"}}>
              {["Product","Qty","Unit Price","Subtotal"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#7a7f8a",fontSize:11,textTransform:"uppercase"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {view.items?.map(it=>(
                <tr key={it.pid} style={{borderBottom:"1px solid #1e2128"}}>
                  <td style={{padding:"9px 10px",color:"#ddd"}}>{it.name}</td>
                  <td style={{padding:"9px 10px",color:"#c8c8c8"}}>{it.qty}</td>
                  <td style={{padding:"9px 10px",color:"#c8c8c8"}}>{PKR(it.price)}</td>
                  <td style={{padding:"9px 10px",color:"#fff",fontWeight:600}}>{PKR(it.qty*it.price)}</td>
                </tr>
              ))}
              {view.discount>0 && <tr><td colSpan={3} style={{padding:"8px 10px",color:"#FAC775",textAlign:"right"}}>Discount</td><td style={{padding:"8px 10px",color:"#FAC775"}}>−{PKR(view.discount)}</td></tr>}
              <tr><td colSpan={3} style={{padding:"10px",color:"#7a7f8a",textAlign:"right",fontWeight:600}}>Total</td><td style={{padding:"10px",color:"#97C459",fontSize:15,fontWeight:700}}>{PKR(view.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#1a1d23"}}>
            {["Invoice","Date","Customer","Items","Discount","Total","Payment"].map(h=>
              <th key={h} style={{padding:"12px 14px",textAlign:"left",color:"#7a7f8a",fontWeight:500,fontSize:11,textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[...filtered].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>(
              <tr key={s.id} style={{borderBottom:"1px solid #1e2128"}}
                onMouseEnter={e=>e.currentTarget.style.background="#1a1d23"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"12px 14px",color:"#97C459",fontWeight:600}}>{s.id}</td>
                <td style={{padding:"12px 14px",color:"#c8c8c8"}}>{fmt(s.date)}</td>
                <td style={{padding:"12px 14px",color:"#c8c8c8"}}>{s.customer}</td>
                <td style={{padding:"12px 14px",color:"#c8c8c8"}}>{s.items?.length}</td>
                <td style={{padding:"12px 14px",color:s.discount>0?"#FAC775":"#4a4f5a"}}>{s.discount>0?PKR(s.discount):"—"}</td>
                <td style={{padding:"12px 14px",color:"#fff",fontWeight:600}}>{PKR(s.total)}</td>
                <td style={{padding:"12px 14px"}}>
                  <button onClick={()=>setView(s)}
                    style={{display:"inline-flex",alignItems:"center",gap:7,background:s.payMode==="Cash"?"#1e2a1a":s.payMode==="Card"?"#0e1e2a":"#1a1d13",border:`1px solid ${s.payMode==="Cash"?"#2a4a1a":s.payMode==="Card"?"#0e2a3a":"#2a1d13"}`,borderRadius:7,padding:"4px 10px 4px 8px",cursor:"pointer"}}>
                    <span style={{color:s.payMode==="Cash"?"#97C459":s.payMode==="Card"?"#85B7EB":"#FAC775",fontSize:11,fontWeight:600}}>{s.payMode}</span>
                    <span style={{width:"1px",height:12,background:s.payMode==="Cash"?"#2a4a1a":s.payMode==="Card"?"#0e2a3a":"#2a1d13"}}/>
                    <span style={{fontSize:11,color:"#7a7f8a"}}>View</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Purchases ────────────────────────────────────────────────
function Purchases({ purchases, savePurchase, products, batchProducts, suppliers }) {
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({supplier:"",date:today(),items:[]});
  const [item,     setItem]     = useState({pid:"",qty:1,cost:""});
  const [saving,   setSaving]   = useState(false);

  const addItem = () => {
    const p = products.find(x=>x.id===item.pid);
    if(!p||!item.qty||!item.cost) return;
    setForm(f=>({...f,items:[...f.items.filter(i=>i.pid!==item.pid),{pid:p.id,name:p.name,qty:Number(item.qty),cost:Number(item.cost)}]}));
    setItem({pid:"",qty:1,cost:""});
  };

  const submit = async () => {
    if(!form.supplier||!form.items.length||saving) return;
    setSaving(true);
    try {
      const po = {id:"PO-"+uid(),date:form.date,supplier:form.supplier,items:form.items,total:form.items.reduce((a,i)=>a+i.qty*i.cost,0),status:"Received"};
      const updated = products.filter(p=>form.items.find(i=>i.pid===p.id)).map(p=>({...p,stock:p.stock+form.items.find(i=>i.pid===p.id).qty}));
      await Promise.all([savePurchase(po), batchProducts(updated)]);
      setForm({supplier:"",date:today(),items:[]}); setShowForm(false);
    } finally { setSaving(false); }
  };

  const supName = id => suppliers.find(s=>s.id===id)?.name || id;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,color:"#7a7f8a"}}>{purchases.length} purchase orders</div>
        <button onClick={()=>setShowForm(p=>!p)}
          style={{padding:"9px 18px",background:"#3B6D11",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <Plus size={15} color="#fff"/> New Purchase
        </button>
      </div>

      {showForm && (
        <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:14,padding:24}}>
          <div style={{fontSize:15,fontWeight:600,color:"#fff",marginBottom:16}}>New Purchase Order</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div>
              <label style={{fontSize:11,color:"#7a7f8a",display:"block",marginBottom:4}}>Supplier</label>
              <select value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))}
                style={{width:"100%",padding:"9px 12px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none"}}>
                <option value="">Select supplier</option>
                {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:"#7a7f8a",display:"block",marginBottom:4}}>Date</label>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{width:"100%",padding:"9px 12px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div style={{background:"#0f1117",borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{fontSize:12,color:"#7a7f8a",marginBottom:10}}>Add Items</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,alignItems:"flex-end"}}>
              <select value={item.pid} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setItem(c=>({...c,pid:e.target.value,cost:p?p.cost:""}));}}
                style={{padding:"8px 10px",background:"#16191f",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:12,outline:"none"}}>
                <option value="">Select product</option>
                {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={item.qty} min={1} onChange={e=>setItem(c=>({...c,qty:e.target.value}))}
                style={{width:70,padding:"8px 10px",background:"#16191f",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:12,outline:"none"}}/>
              <input type="number" placeholder="Cost/unit" value={item.cost} onChange={e=>setItem(c=>({...c,cost:e.target.value}))}
                style={{width:100,padding:"8px 10px",background:"#16191f",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:12,outline:"none"}}/>
              <button onClick={addItem} style={{padding:"8px 14px",background:"#3B6D11",border:"none",borderRadius:8,color:"#fff",fontSize:12,cursor:"pointer"}}>Add</button>
            </div>
            {form.items.map(it=>(
              <div key={it.pid} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #1e2128",fontSize:12,color:"#c8c8c8",marginTop:6}}>
                <span>{it.name}</span><span>{it.qty} × {PKR(it.cost)} = {PKR(it.qty*it.cost)}</span>
              </div>
            ))}
            {form.items.length>0 && <div style={{textAlign:"right",fontSize:14,fontWeight:700,color:"#97C459",marginTop:8}}>Total: {PKR(form.items.reduce((a,i)=>a+i.qty*i.cost,0))}</div>}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={submit} disabled={saving}
              style={{padding:"10px 24px",background:saving?"#1e2128":"#3B6D11",border:"none",borderRadius:10,color:saving?"#7a7f8a":"#fff",fontSize:13,fontWeight:600,cursor:saving?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Saving…</>:"Save Purchase Order"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{padding:"10px 20px",background:"transparent",border:"1px solid #2a2d35",borderRadius:10,color:"#8a8f9a",fontSize:13,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#1a1d23"}}>
            {["PO #","Date","Supplier","Items","Total","Status"].map(h=>
              <th key={h} style={{padding:"12px 14px",textAlign:"left",color:"#7a7f8a",fontWeight:500,fontSize:11,textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[...purchases].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>(
              <tr key={p.id} style={{borderBottom:"1px solid #1e2128"}}>
                <td style={{padding:"12px 14px",color:"#85B7EB",fontWeight:600}}>{p.id}</td>
                <td style={{padding:"12px 14px",color:"#c8c8c8"}}>{fmt(p.date)}</td>
                <td style={{padding:"12px 14px",color:"#c8c8c8"}}>{supName(p.supplier)}</td>
                <td style={{padding:"12px 14px",color:"#c8c8c8"}}>{p.items?.length}</td>
                <td style={{padding:"12px 14px",color:"#fff",fontWeight:600}}>{PKR(p.total)}</td>
                <td style={{padding:"12px 14px"}}><span style={{background:"#1e2a1a",color:"#97C459",fontSize:11,padding:"3px 8px",borderRadius:6}}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Stock ────────────────────────────────────────────────────
function Stock({ products, saveProduct, lowStock }) {
  const [filter,   setFilter]   = useState("all");
  const [editId,   setEditId]   = useState(null);
  const [newStock, setNewStock] = useState("");
  const [saving,   setSaving]   = useState(false);

  const shown = filter==="low" ? lowStock : filter==="ok" ? products.filter(p=>p.stock>p.minStock) : products;

  const doSave = async p => {
    setSaving(true);
    await saveProduct({...p,stock:Number(newStock)});
    setEditId(null); setNewStock(""); setSaving(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:10}}>
        {[["all","All Products"],["low",`Low Stock (${lowStock.length})`],["ok","Sufficient Stock"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${filter===k?"#3B6D11":"#2a2d35"}`,background:filter===k?"#1e2a1a":"transparent",color:filter===k?"#97C459":"#8a8f9a",fontSize:12,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {shown.map(p=>{
          const pct=Math.min((p.stock/Math.max(p.minStock*3,1))*100,100);
          const isLow=p.stock<=p.minStock;
          return (
            <div key={p.id} style={{background:"#16191f",border:`1px solid ${isLow?"#711B13":"#2a2d35"}`,borderRadius:12,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#ddd"}}>{p.name}</div>
                  <div style={{fontSize:11,color:"#7a7f8a"}}>{p.category}</div>
                </div>
                {isLow && <span style={{background:"#1a1210",color:"#F09595",fontSize:10,padding:"3px 8px",borderRadius:6,display:"flex",alignItems:"center",gap:4}}><AlertTriangle size={10} color="#F09595"/> Low</span>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                {editId===p.id ? (
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input type="number" value={newStock} onChange={e=>setNewStock(e.target.value)}
                      style={{width:70,padding:"5px 8px",background:"#0f1117",border:"1px solid #3B6D11",borderRadius:6,color:"#fff",fontSize:12,outline:"none"}}/>
                    <button onClick={()=>doSave(p)} disabled={saving}
                      style={{padding:"5px 10px",background:saving?"#1e2128":"#3B6D11",border:"none",borderRadius:6,color:"#fff",fontSize:11,cursor:"pointer"}}>{saving?"…":"Save"}</button>
                    <button onClick={()=>setEditId(null)} style={{padding:"5px 8px",background:"transparent",border:"1px solid #2a2d35",borderRadius:6,color:"#7a7f8a",fontSize:11,cursor:"pointer"}}>✕</button>
                  </div>
                ) : (
                  <div><span style={{fontSize:22,fontWeight:700,color:isLow?"#F09595":"#fff"}}>{p.stock}</span><span style={{fontSize:12,color:"#7a7f8a",marginLeft:4}}>{p.unit}</span></div>
                )}
                {editId!==p.id && <button onClick={()=>{setEditId(p.id);setNewStock(p.stock);}}
                  style={{fontSize:11,color:"#97C459",background:"transparent",border:"1px solid #2a2d35",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>Adjust</button>}
              </div>
              <div style={{height:4,background:"#1e2128",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:isLow?"#A32D2D":"#3B6D11",borderRadius:4}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:"#5a5f6a"}}>
                <span>Min: {p.minStock} {p.unit}</span><span>Cost: {PKR(p.cost)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Products ─────────────────────────────────────────────────
function Products({ products, saveProduct, delProduct, suppliers }) {
  const [showForm, setShowForm] = useState(false);
  const [editP,    setEditP]    = useState(null);
  const [search,   setSearch]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const blank = {name:"",category:CATS[0],price:"",cost:"",stock:"",unit:"pcs",minStock:"",supplier:""};
  const [form, setForm] = useState(blank);

  const open  = (p=null) => { setEditP(p); setForm(p?{...p}:blank); setShowForm(true); };
  const close = () => { setShowForm(false); setEditP(null); setForm(blank); };

  const save = async () => {
    if(!form.name||!form.price||!form.cost||saving) return;
    setSaving(true);
    await saveProduct({...form,id:editP?editP.id:"P"+uid(),price:Number(form.price),cost:Number(form.cost),stock:Number(form.stock),minStock:Number(form.minStock)});
    setSaving(false); close();
  };

  const shown = search ? products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())) : products;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
          style={{flex:1,padding:"9px 14px",background:"#16191f",border:"1px solid #2a2d35",borderRadius:10,color:"#e8e8e8",fontSize:13,outline:"none"}}/>
        <button onClick={()=>open()} style={{padding:"9px 18px",background:"#3B6D11",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <Plus size={15} color="#fff"/> Add Product
        </button>
      </div>

      {showForm && (
        <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:14,padding:24}}>
          <div style={{fontSize:15,fontWeight:600,color:"#fff",marginBottom:16}}>{editP?"Edit Product":"Add New Product"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              {label:"Product Name",    key:"name",     type:"text",   full:true},
              {label:"Category",        key:"category", type:"select", opts:CATS},
              {label:"Sale Price (Rs.)",key:"price",    type:"number"},
              {label:"Cost Price (Rs.)",key:"cost",     type:"number"},
              {label:"Current Stock",   key:"stock",    type:"number"},
              {label:"Unit",            key:"unit",     type:"select", opts:["pcs","kg","bag","box","tray","litre","dozen"]},
              {label:"Min Stock Level", key:"minStock", type:"number"},
              {label:"Supplier",        key:"supplier", type:"select", opts:suppliers.map(s=>({value:s.id,label:s.name}))},
            ].map(f=>(
              <div key={f.key} style={{gridColumn:f.full?"1 / -1":"auto"}}>
                <label style={{fontSize:11,color:"#7a7f8a",display:"block",marginBottom:4}}>{f.label}</label>
                {f.type==="select" ? (
                  <select value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{width:"100%",padding:"9px 12px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none"}}>
                    <option value="">Select…</option>
                    {(f.opts||[]).map(o=>typeof o==="string"?<option key={o} value={o}>{o}</option>:<option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={f.type} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{width:"100%",padding:"9px 12px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                )}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={save} disabled={saving}
              style={{padding:"10px 24px",background:saving?"#1e2128":"#3B6D11",border:"none",borderRadius:10,color:saving?"#7a7f8a":"#fff",fontSize:13,fontWeight:600,cursor:saving?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Saving…</>:editP?"Update":"Add Product"}
            </button>
            <button onClick={close} style={{padding:"10px 20px",background:"transparent",border:"1px solid #2a2d35",borderRadius:10,color:"#8a8f9a",fontSize:13,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#1a1d23"}}>
            {["ID","Name","Category","Sale Price","Cost","Stock","Min","Margin",""].map(h=>
              <th key={h} style={{padding:"12px 14px",textAlign:"left",color:"#7a7f8a",fontWeight:500,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map(p=>{
              const margin=(((p.price-p.cost)/p.price)*100).toFixed(0);
              return (
                <tr key={p.id} style={{borderBottom:"1px solid #1e2128"}}>
                  <td style={{padding:"11px 14px",color:"#5a5f6a",fontFamily:"monospace",fontSize:11}}>{p.id}</td>
                  <td style={{padding:"11px 14px",color:"#ddd",fontWeight:500}}>{p.name}</td>
                  <td style={{padding:"11px 14px"}}><span style={{background:"#1a1d23",color:"#85B7EB",fontSize:11,padding:"2px 8px",borderRadius:6}}>{p.category}</span></td>
                  <td style={{padding:"11px 14px",color:"#97C459",fontWeight:600}}>{PKR(p.price)}</td>
                  <td style={{padding:"11px 14px",color:"#c8c8c8"}}>{PKR(p.cost)}</td>
                  <td style={{padding:"11px 14px",color:p.stock<=p.minStock?"#F09595":"#c8c8c8",fontWeight:p.stock<=p.minStock?700:400}}>{p.stock} {p.unit}</td>
                  <td style={{padding:"11px 14px",color:"#7a7f8a"}}>{p.minStock}</td>
                  <td style={{padding:"11px 14px"}}><span style={{background:Number(margin)>20?"#1e2a1a":"#1a1d13",color:Number(margin)>20?"#97C459":"#FAC775",fontSize:11,padding:"2px 8px",borderRadius:6}}>{margin}%</span></td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>open(p)} style={{fontSize:11,color:"#85B7EB",background:"transparent",border:"1px solid #2a2d35",borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>{if(confirm("Delete this product?")) delProduct(p.id);}} style={{fontSize:11,color:"#F09595",background:"transparent",border:"1px solid #2a2d35",borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Suppliers ────────────────────────────────────────────────
function Suppliers({ suppliers, saveSupplier, delSupplier }) {
  const [showForm, setShowForm] = useState(false);
  const [editS,    setEditS]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const blank = {name:"",contact:"",city:"",email:""};
  const [form, setForm] = useState(blank);

  const open  = (s=null) => { setEditS(s); setForm(s?{...s}:blank); setShowForm(true); };
  const close = () => { setShowForm(false); setEditS(null); setForm(blank); };

  const save = async () => {
    if(!form.name||saving) return;
    setSaving(true);
    await saveSupplier({...form,id:editS?editS.id:"S"+uid()});
    setSaving(false); close();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>open()} style={{padding:"9px 18px",background:"#3B6D11",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <Plus size={15} color="#fff"/> Add Supplier
        </button>
      </div>

      {showForm && (
        <div style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:14,padding:24}}>
          <div style={{fontSize:15,fontWeight:600,color:"#fff",marginBottom:16}}>{editS?"Edit Supplier":"Add Supplier"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["Company Name","name"],["Contact Number","contact"],["City","city"],["Email","email"]].map(([label,key])=>(
              <div key={key}>
                <label style={{fontSize:11,color:"#7a7f8a",display:"block",marginBottom:4}}>{label}</label>
                <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",background:"#0f1117",border:"1px solid #2a2d35",borderRadius:8,color:"#e8e8e8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <button onClick={save} disabled={saving}
              style={{padding:"10px 24px",background:saving?"#1e2128":"#3B6D11",border:"none",borderRadius:10,color:saving?"#7a7f8a":"#fff",fontSize:13,fontWeight:600,cursor:saving?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Saving…</>:editS?"Update":"Add Supplier"}
            </button>
            <button onClick={close} style={{padding:"10px 20px",background:"transparent",border:"1px solid #2a2d35",borderRadius:10,color:"#8a8f9a",fontSize:13,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {suppliers.map(s=>(
          <div key={s.id} style={{background:"#16191f",border:"1px solid #2a2d35",borderRadius:14,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,background:"#0e1e2a",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Warehouse size={20} color="#85B7EB"/>
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#fff"}}>{s.name}</div>
                  <div style={{fontSize:11,color:"#7a7f8a"}}>{s.id}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>open(s)} style={{fontSize:11,color:"#85B7EB",background:"transparent",border:"1px solid #2a2d35",borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>Edit</button>
                <button onClick={()=>{if(confirm("Delete supplier?")) delSupplier(s.id);}} style={{fontSize:11,color:"#F09595",background:"transparent",border:"1px solid #2a2d35",borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>✕</button>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[{Icon:Phone,val:s.contact},{Icon:MapPin,val:s.city},{Icon:Mail,val:s.email}].map(({Icon,val})=>(
                <div key={val} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#8a8f9a"}}>
                  <Icon size={14} color="#5a5f6a"/>
                  {val||<span style={{color:"#3a3f4a"}}>Not provided</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
