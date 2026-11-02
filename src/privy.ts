import { createElement, useEffect, useRef, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider, useLogin, usePrivy } from '@privy-io/react-auth'
import { privyAppId } from './privy-config.ts'

type Pending = {
  resolve: (id: string) => void
  reject: (error: string) => void
}

let pending: Pending | null = null
let phase: 'idle' | 'modal' | 'verifying' = 'idle'
let openLogin: (() => void) | null = null
let openWalletLink: (() => void) | null = null
let endLogin: (() => Promise<void>) | null = null
let readToken: (() => Promise<string | null>) | null = null
let booted: Promise<void> | null = null
let markBooted: () => void = () => {}

function fail(error: string): void {
  const current = pending
  pending = null
  phase = 'idle'
  current?.reject(error)
}

async function complete(userId: string): Promise<void> {
  if (!pending || phase === 'verifying') return
  phase = 'verifying'
  const current = pending
  try {
    const token = (await readToken?.()) ?? ''
    const response = await fetch('/api/privy/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = (await response.json()) as { id?: string; error?: string }
    if (!response.ok || !body.id) {
      fail(body.error || 'Privy did not accept that login.')
      return
    }
    if (pending !== current) return
    pending = null
    phase = 'idle'
    current.resolve(body.id || userId)
  } catch {
    fail('The district could not reach Privy.')
  }
}

function Gate(): ReactNode {
  const privy = usePrivy()
  const { login } = useLogin({
    onComplete: ({ user }) => {
      void complete(user.id)
    },
    onError: () => {
      fail('Privy could not log in.')
    },
  })
  const loginRef = useRef(login)
  const tokenRef = useRef(privy.getAccessToken)
  const linkWalletRef = useRef(privy.linkWallet)
  const logoutRef = useRef(privy.logout)
  loginRef.current = login
  tokenRef.current = privy.getAccessToken
  linkWalletRef.current = privy.linkWallet
  logoutRef.current = privy.logout

  useEffect(() => {
    openLogin = () => loginRef.current()
    openWalletLink = () => linkWalletRef.current({ walletChainType: 'ethereum-only' })
    endLogin = () => logoutRef.current()
    readToken = () => tokenRef.current()
    markBooted()
  })

  const modalWasOpen = useRef(false)
  useEffect(() => {
    if (privy.isModalOpen) {
      modalWasOpen.current = true
      return undefined
    }
    if (!modalWasOpen.current) return undefined
    modalWasOpen.current = false
    const timer = window.setTimeout(() => {
      if (phase === 'modal') fail('The login window closed.')
    }, 400)
    return () => window.clearTimeout(timer)
  }, [privy.isModalOpen])

  return null
}

function ensurePrivy(appId: string): Promise<void> {
  if (!booted) {
    booted = new Promise((resolve) => {
      markBooted = resolve
    })
    const host = document.createElement('div')
    host.id = 'privy-root'
    document.body.append(host)
    createRoot(host).render(
      createElement(PrivyProvider, {
        appId,
        config: {
          loginMethods: ['email'],
          appearance: {
            theme: 'dark',
            accentColor: '#1af38f',
            logo: '/brand/lockup.png',
          },
          embeddedWallets: {
            ethereum: { createOnLogin: 'off' },
            solana: { createOnLogin: 'off' },
          },
        },
        children: createElement(Gate),
      }),
    )
  }
  return booted
}

async function waitForPrivy(appId: string): Promise<void> {
  let timer = 0
  try {
    await Promise.race([
      ensurePrivy(appId),
      new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 8000) }),
    ])
  } finally {
    window.clearTimeout(timer)
  }
}

export async function loginWithPrivy(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const appId = privyAppId()
  if (!appId) {
    return { ok: false, error: 'Privy needs the public App ID from the dashboard. The secret stays on the server.' }
  }
  await Promise.race([
    ensurePrivy(appId),
    new Promise<void>((_, reject) => {
      window.setTimeout(() => reject(new Error('slow')), 8000)
    }),
  ]).catch(() => undefined)
  if (!openLogin) {
    return { ok: false, error: 'Privy did not start. Check the public App ID.' }
  }
  phase = 'modal'
  const id = await new Promise<string>((resolve, reject) => {
    pending = { resolve, reject }
    openLogin?.()
  }).catch((error: unknown) => (typeof error === 'string' ? error : 'Privy could not log in.'))
  if (!id.startsWith('did:privy:')) return { ok: false, error: id }
  return { ok: true, id }
}

export async function getPrivyAccessToken(): Promise<string | null> {
  const appId = privyAppId()
  if (!appId) return null
  await waitForPrivy(appId)
  return (await readToken?.()) ?? null
}

export async function linkWalletWithPrivy(): Promise<{ ok: true } | { ok: false; error: string }> {
  const appId = privyAppId()
  if (!appId) return { ok: false, error: 'Privy needs the public App ID before a wallet can be linked.' }
  await waitForPrivy(appId)
  if (!(await readToken?.())) return { ok: false, error: 'Log in with Privy before linking a wallet.' }
  if (!openWalletLink) return { ok: false, error: 'Privy did not start. Check the public App ID.' }
  openWalletLink()
  return { ok: true }
}

export async function logoutPrivy(): Promise<void> {
  if (!endLogin) return
  await endLogin()
}
