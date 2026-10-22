import React, { useEffect, useMemo, useState } from 'react';
import { createClient, User } from '@supabase/supabase-js';
import { Search, Plus, Pencil, Trash2, LogOut, Package, Shield, X, UploadCloud, RefreshCw } from 'lucide-react';
import './index.css';

// .env faylida VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY bo'lishi kerak.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder-key');

type Role = 'admin' | 'sotuvchi';
type Profile = { id: string; email: string; role: Role; full_name?: string | null };
type Category = { id: string; name: string };
type Product = {
  id: string; title: string; category_id: string | null; model_compatibility: string | null;
  description: string | null; price: number; stock_quantity: number; image_url: string;
  created_at: string; category_name?: string;
};

const money = (n: number) => new Intl.NumberFormat('uz-UZ').format(Number(n || 0)) + " so'm";
const inputClass = 'w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-3 text-sm text-white outline-none focus:border-white';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tab, setTab] = useState<'inventory' | 'admin'>('inventory');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      setUser(data.session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) { setProfile(null); setProducts([]); setCategories([]); setProfileError(''); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadProfile(user);
  }, [user]);

  useEffect(() => {
    if (user && profile) {
      void loadCategories();
      void loadProducts();
    }
  }, [user, profile]);

  async function loadProfile(currentUser: User) {
    setProfileError('');
    const { data, error: e } = await supabase.from('profiles').select('id,email,role,full_name').eq('id', currentUser.id).maybeSingle();
    if (e) { setProfile(null); setProfileError('Profilni o‘qib bo‘lmadi: ' + e.message); return; }
    if (!data || !['admin', 'sotuvchi'].includes(data.role)) {
      setProfile(null);
      setProfileError('Bu akkaunt uchun profiles jadvalida admin yoki sotuvchi roli berilmagan. Adminingizga murojaat qiling.');
      return;
    }
    setProfile(data as Profile);
  }

  async function loadCategories() {
    const { data, error: e } = await supabase.from('categories').select('id,name').order('name');
    if (e) setError('Kategoriyalar yuklanmadi: ' + e.message);
    else setCategories((data ?? []) as Category[]);
  }

  async function loadProducts() {
    setLoading(true); setError('');
    const { data, error: e } = await supabase.from('products').select('*, categories(name)').order('created_at', { ascending: false });
    if (e) setError('Mahsulotlar yuklanmadi: ' + e.message);
    else setProducts((data ?? []).map((p: any) => ({ ...p, category_name: p.categories?.name ?? 'Kategoriyasiz' })) as Product[]);
    setLoading(false);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault(); setAuthError(''); setAuthBusy(true);
    const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (e2) setAuthError('Kirish amalga oshmadi: email/parolni yoki Supabase Auth sozlamalarini tekshiring.');
    setAuthBusy(false);
  }

  async function logout() { await supabase.auth.signOut(); setTab('inventory'); }

  function openNew() {
    setEditing(null); setTitle(''); setCategoryId(categories[0]?.id ?? ''); setModel(''); setDescription(''); setPrice(''); setStock('1');
    setImageFile(null); setImagePreview(''); setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p); setTitle(p.title); setCategoryId(p.category_id ?? ''); setModel(p.model_compatibility ?? '');
    setDescription(p.description ?? ''); setPrice(String(p.price)); setStock(String(p.stock_quantity));
    setImageFile(null); setImagePreview(p.image_url); setModalOpen(true);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (profile?.role !== 'admin') { alert('Faqat admin mahsulotni o‘zgartira oladi.'); return; }
    if (!title.trim() || price.trim() === '' || !Number.isFinite(Number(price)) || Number(price) < 0) { alert('Mahsulot nomi va to‘g‘ri narxni kiriting.'); return; }
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) { alert('Miqdor 0 yoki undan katta butun son bo‘lishi kerak.'); return; }
    setSaving(true);
    try {
      let imageUrl = imagePreview;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type || undefined });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      if (!imageUrl) throw new Error('Mahsulot rasmini tanlang.');
      const payload = {
        title: title.trim(), category_id: categoryId || null, model_compatibility: model.trim(),
        description: description.trim(), price: Number(price), stock_quantity: Number(stock), image_url: imageUrl,
        updated_at: new Date().toISOString(),
      };
      const result = editing
        ? await supabase.from('products').update(payload).eq('id', editing.id)
        : await supabase.from('products').insert(payload);
      if (result.error) throw result.error;
      setModalOpen(false); await loadProducts();
    } catch (err: any) { alert('Saqlashda xatolik: ' + (err?.message ?? 'Noma’lum xato')); }
    finally { setSaving(false); }
  }

  async function deleteProduct(p: Product) {
    if (profile?.role !== 'admin') return;
    if (!window.confirm(`“${p.title}” mahsuloti o‘chirilsinmi?`)) return;
    const { error: e } = await supabase.from('products').delete().eq('id', p.id);
    if (e) alert('O‘chirishda xatolik: ' + e.message); else await loadProducts();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault(); if (profile?.role !== 'admin' || !newCategory.trim()) return;
    const { error: e2 } = await supabase.from('categories').insert({ name: newCategory.trim() });
    if (e2) alert('Kategoriya qo‘shilmadi: ' + e2.message);
    else { setNewCategory(''); await loadCategories(); }
  }
  async function deleteCategory(c: Category) {
    if (profile?.role !== 'admin' || !window.confirm(`“${c.name}” kategoriyasi o‘chirilsinmi? Mahsulotlar kategoriyasiz qolishi mumkin.`)) return;
    const { error: e } = await supabase.from('categories').delete().eq('id', c.id);
    if (e) alert('Kategoriya o‘chirilmadi: ' + e.message); else { await loadCategories(); await loadProducts(); }
  }

  const filtered = useMemo(() => products.filter(p => {
    const q = query.toLocaleLowerCase();
    const matchesText = (p.title ?? '').toLocaleLowerCase().includes(q) || (p.model_compatibility ?? '').toLocaleLowerCase().includes(q) || (p.description ?? '').toLocaleLowerCase().includes(q);
    return matchesText && (categoryFilter === 'all' || p.category_id === categoryFilter);
  }), [products, query, categoryFilter]);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return <div className="min-h-screen bg-neutral-950 p-6 text-white"><h1 className="text-2xl font-bold">iMarket sozlamasi tugallanmagan</h1><p className="mt-3 text-neutral-300">Loyiha root papkasidagi .env fayliga VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY qiymatlarini kiriting, so‘ng serverni qayta ishga tushiring.</p></div>;

  if (!user) return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4"><form onSubmit={login} className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-900 p-7 shadow-2xl"><div className="mb-6 text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black">iM</div><h1 className="text-2xl font-bold">iMarket Ombor</h1><p className="mt-1 text-sm text-neutral-400">Faqat ruxsat berilgan xodimlar uchun</p></div>{authError && <p className="mb-4 rounded-xl bg-red-950 p-3 text-sm text-red-200">{authError}</p>}<label className="mb-1 block text-sm text-neutral-300">Email</label><input className={`${inputClass} mb-4`} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@imarket.uz"/><label className="mb-1 block text-sm text-neutral-300">Parol</label><input className={`${inputClass} mb-5`} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Parolingiz"/><button disabled={authBusy} className={`${buttonClass} w-full bg-white text-black`}>{authBusy ? 'Kirilmoqda…' : 'Kirish'}</button></form></div>;

  if (!profile) return <div className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6"><h1 className="text-xl font-bold">Profil tekshirilmoqda</h1><p className="my-3 text-sm text-neutral-300">{profileError || 'Foydalanuvchi roli tekshirilmoqda…'}</p><div className="flex gap-2"><button className={`${buttonClass} bg-white text-black`} onClick={() => user && void loadProfile(user)}>Qayta tekshirish</button><button className={`${buttonClass} bg-neutral-800`} onClick={logout}>Chiqish</button></div></div></div>;

  return <div className="min-h-screen bg-neutral-950 pb-24 text-neutral-100"><header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-black">iM</div><div><h1 className="font-bold">iMarket</h1><p className="text-xs text-neutral-400">{profile.role === 'admin' ? 'Administrator' : 'Sotuvchi'} · Ombor</p></div></div><button className="rounded-xl p-2 text-neutral-300 hover:bg-neutral-800" title="Chiqish" onClick={logout}><LogOut size={20}/></button></div></header>
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      {error && <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}
      {tab === 'inventory' ? <><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold">Mahsulotlar ombori</h2><p className="mt-1 text-sm text-neutral-400">Jami {products.length} ta mahsulot</p></div><button className={`${buttonClass} bg-neutral-800`} onClick={() => void loadProducts()}><RefreshCw size={16}/> Yangilash</button></div><div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18}/><input className={`${inputClass} pl-10`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Nomi, modeli yoki tavsifi bo‘yicha qidirish"/></div><select className={`${inputClass} sm:max-w-xs`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Barcha kategoriyalar</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{loading ? <div className="flex items-center justify-center gap-2 py-20 text-neutral-400"><RefreshCw className="animate-spin"/> Yuklanmoqda…</div> : filtered.length === 0 ? <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 py-16 text-center"><Package className="mx-auto mb-3 text-neutral-600" size={42}/><p className="font-semibold">Mahsulot topilmadi</p><p className="mt-1 text-sm text-neutral-500">Qidiruvni o‘zgartirib ko‘ring.</p></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{filtered.map(p => <article key={p.id} className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900"><img src={p.image_url} alt={p.title} loading="lazy" className="aspect-square w-full bg-neutral-800 object-cover"/><div className="p-3"><p className="mb-1 truncate text-[11px] text-neutral-500">{p.category_name}</p><h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{p.title}</h3>{p.model_compatibility && <p className="mt-1 truncate text-xs text-neutral-400">Mos: {p.model_compatibility}</p>}<p className="mt-3 font-bold">{money(p.price)}</p><p className={`mt-1 text-xs ${p.stock_quantity ? 'text-neutral-400' : 'text-red-300'}`}>Omborda: {p.stock_quantity} dona</p>{profile.role === 'admin' && <div className="mt-3 flex gap-2 border-t border-neutral-800 pt-3"><button onClick={() => openEdit(p)} className="flex-1 rounded-lg bg-neutral-800 p-2 text-xs"><Pencil size={14} className="mr-1 inline"/>Tahrir</button><button onClick={() => void deleteProduct(p)} className="rounded-lg bg-red-950/70 p-2 text-red-300" title="O‘chirish"><Trash2 size={15}/></button></div>}</div></article>)}</div>}</> : <>{profile.role !== 'admin' ? <p>Admin huquqi kerak.</p> : <><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Admin paneli</h2><p className="mt-1 text-sm text-neutral-400">Mahsulot va kategoriyalarni boshqarish</p></div><button onClick={openNew} className={`${buttonClass} bg-white text-black`}><Plus size={18}/> Mahsulot qo‘shish</button></div><section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"><h3 className="mb-3 font-bold">Kategoriyalar</h3><form onSubmit={addCategory} className="flex gap-2"><input className={inputClass} value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Yangi kategoriya nomi" required/><button className={`${buttonClass} bg-white text-black`}>Qo‘shish</button></form><div className="mt-4 flex flex-wrap gap-2">{categories.map(c => <span key={c.id} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm">{c.name}<button className="text-neutral-400 hover:text-red-300" onClick={() => void deleteCategory(c)} title="Kategoriyani o‘chirish"><X size={14}/></button></span>)}</div></section><section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900"><div className="border-b border-neutral-800 p-4 font-bold">Mahsulotlar ({products.length})</div>{products.map(p => <div key={p.id} className="flex items-center gap-3 border-b border-neutral-800 p-3 last:border-0"><img src={p.image_url} alt="" className="h-14 w-14 rounded-xl object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.title}</p><p className="text-xs text-neutral-400">{money(p.price)} · {p.stock_quantity} dona</p></div><button onClick={() => openEdit(p)} className="rounded-lg bg-neutral-800 p-2"><Pencil size={16}/></button><button onClick={() => void deleteProduct(p)} className="rounded-lg bg-red-950/70 p-2 text-red-300"><Trash2 size={16}/></button></div>)}</section></>}</>}
    </main>
    <nav className="fixed bottom-0 z-20 flex w-full justify-center border-t border-neutral-800 bg-neutral-900/95 p-2 backdrop-blur"><div className="flex w-full max-w-md gap-2"><button onClick={() => setTab('inventory')} className={`${buttonClass} flex-1 ${tab === 'inventory' ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300'}`}><Package size={18}/> Ombor</button>{profile.role === 'admin' && <button onClick={() => setTab('admin')} className={`${buttonClass} flex-1 ${tab === 'admin' ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300'}`}><Shield size={18}/> Admin</button>}</div></nav>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3"><form onSubmit={saveProduct} className="my-auto max-h-[94vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-neutral-700 bg-neutral-900 p-5 sm:p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{editing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h3><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-neutral-400"><X/></button></div><div><label className="mb-1 block text-sm text-neutral-300">Mahsulot nomi *</label><input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} required/></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm text-neutral-300">Kategoriya</label><select className={inputClass} value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Kategoriyasiz</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="mb-1 block text-sm text-neutral-300">Narxi (so‘m) *</label><input className={inputClass} type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)} required/></div></div><div><label className="mb-1 block text-sm text-neutral-300">Ombordagi miqdori *</label><input className={inputClass} type="number" min="0" step="1" value={stock} onChange={e => setStock(e.target.value)} required/></div><div><label className="mb-1 block text-sm text-neutral-300">Mos telefon modellari</label><input className={inputClass} value={model} onChange={e => setModel(e.target.value)} placeholder="iPhone 13, Samsung A55…"/></div><div><label className="mb-1 block text-sm text-neutral-300">Mahsulot rasmi *</label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-600 bg-neutral-800 p-4 text-sm text-neutral-200"><UploadCloud size={18}/> Galereyadan rasm tanlash<input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }}/></label>{imagePreview && <img src={imagePreview} alt="Rasm ko‘rinishi" className="mt-3 h-28 w-28 rounded-xl object-cover"/>}</div><div><label className="mb-1 block text-sm text-neutral-300">Tavsif</label><textarea className={inputClass} rows={3} value={description} onChange={e => setDescription(e.target.value)}/></div><div className="flex gap-2"><button type="button" onClick={() => setModalOpen(false)} className={`${buttonClass} flex-1 bg-neutral-800`}>Bekor qilish</button><button disabled={saving} className={`${buttonClass} flex-1 bg-white text-black`}>{saving ? 'Saqlanmoqda…' : 'Saqlash'}</button></div></form></div>}
  </div>;
}
