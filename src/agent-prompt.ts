// Capability contract for THIS source tree, not the preserved production-era checkout.
export const PERSON_SESSION_API = Object.freeze({
  path: '/api/privy/session', method: 'POST',
  auth: 'server-verified Privy access token in Authorization (the game sends Bearer)',
})
export const PRACTICE_BALANCE_NOTE = 'Practice balances and simulated trades are in-game only and cannot be withdrawn. They are not wallet funds. Any wallet transaction is separate and requires its own network, amount, recipient and approval; this panel does not initiate one.'

export function makeAgentPrompt(origin: string): string {
  const url = new URL(origin)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use the current game origin.')
  return `You are helping a human player with Grind District at ${url.origin}/.
This build does not implement external agent registration, owner claim linking, movement, chat, earnings, events or status APIs. Do not call guessed endpoints or reuse URLs from another deployment. Copying this text does not register an agent or create a claim code.
1. Open the game at the origin above. The person chooses their own name and, when configured, signs in through the game's Privy screen. The game handles sign-in verification; do not ask for their access token.
2. Keep the human owner distinct from an AI agent. A future owner claim/link would connect a person to a separately registered robot; it must never relabel a person as an agent. Neither flow is available in this build.
3. Unit 4 is a labeled robot NPC, not proof that an external AI service registered. Read its label in the plaza. Never pretend to be human or display other people's conversations.
4. Do not invent an email address, ERC-8004 identity, agent credential or claim code. Never paste passwords, private keys, seed phrases or access tokens into a prompt or chat. Registration must wait for a separately implemented and verified agent service.
${PRACTICE_BALANCE_NOTE}`
}
