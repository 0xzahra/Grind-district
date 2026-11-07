// Sign-out isolation: after the keys signOut() clears, a reload must not load the account's progress as a guest.
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
;(globalThis as any).window = globalThis; (globalThis as any).addEventListener = () => {}; (globalThis as any).document ??= { addEventListener() {}, hidden: false }
;(globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) })
const st = await import('../src/state.ts')
const { SAVE_KEY } = await import('../src/logic.ts')
st.loadSave()
const guestSlot = st.slotKey()
st.adoptAccount('did:privy:test', 'alice')
const acctSlot = st.slotKey()
st.getSave().xp = 999; st.adoptAccount("did:privy:test", "alice")
if (acctSlot === guestSlot) throw new Error('account slot must differ from guest slot')
// what signOut() removes
for (const k of ['gd.privy.username', 'gd.privy.userId', SAVE_KEY]) localStorage.removeItem(k)
const after = st.slotKey()
if (after === acctSlot) throw new Error('slot still points at the account after sign out')
if (!localStorage.getItem(acctSlot)) throw new Error('account copy must stay on device')
const raw = localStorage.getItem(after)
if (raw && JSON.parse(raw).username === 'alice') throw new Error('guest slot holds account progress')
console.log('ok - sign-out isolation: account slot kept, guest slot clean')
process.exit(0)
