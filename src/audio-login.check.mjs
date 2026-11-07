import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { loginMethods } from './login-config.ts'
assert.deepEqual(loginMethods(), ['email'])
assert.deepEqual(loginMethods('email,google,twitter,google,x,wallet,INVALID'), ['email','google','twitter'])
assert.deepEqual(loginMethods('x'), ['email'], 'SDK uses twitter; never advertise guessed provider aliases')
const privy = readFileSync('src/privy.ts','utf8')
assert(privy.includes('loginMethods(import.meta.env?.VITE_PRIVY_LOGIN_METHODS)'))
assert(privy.includes("createOnLogin: 'off'"), 'wallet creation behavior unchanged')
const dom = new JSDOM('<button id="music"></button><input id="volume" value="70"><p id="note"></p>', {url:'https://example.test',pretendToBeVisual:true})
for (const key of ['window','document','localStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key], configurable:true})
let hidden = false
Object.defineProperty(document,'hidden',{get:()=>hidden})
class FakeAudio extends EventTarget {
  static instances = []
  constructor(){super();FakeAudio.instances.push(this);this.volume=0;this.requests=[];this.pauses=0}
  play(){const p=Promise.withResolvers();this.requests.push(p);return p.promise}
  pause(){this.pauses++}
}
Object.defineProperty(globalThis,'Audio',{value:FakeAudio,configurable:true})
const { bindMusic, THEME } = await import('./music.ts')
const {getSave} = await import('./state.ts')
getSave().volume=0
const button=document.querySelector('button'),slider=document.querySelector('input'),note=document.querySelector('p')
bindMusic(button,slider,note)
const audio=FakeAudio.instances[0]
assert.equal(audio.src,THEME)
assert(readFileSync('public'+THEME).subarray(0,3).equals(Buffer.from('ID3')), 'actual supplied MP3 shipped')
button.click();assert.equal(audio.requests.length,1,'play invoked in click stack, no fetch/await')
assert.equal(audio.volume,0,'persisted zero is a mute, not fallback volume')
button.click();audio.requests[0].resolve();await Promise.resolve()
assert.equal(button.getAttribute('aria-pressed'),'false','stop during pending play cannot resurrect audio')
button.click();const blocked=Object.assign(new Error('blocked'),{name:'NotAllowedError'});audio.requests[1].reject(blocked);await Promise.resolve()
assert(note.textContent.includes('fresh tap'))
button.click();audio.requests[2].resolve();await Promise.resolve()
assert.equal(button.getAttribute('aria-pressed'),'true')
slider.value='31';slider.dispatchEvent(new window.Event('input'));assert.equal(audio.volume,0.248)
hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(button.getAttribute('aria-pressed'),'false')
hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));audio.requests.at(-1).reject(new Error('decode'));await Promise.resolve()
assert.equal(button.getAttribute('aria-pressed'),'false','failed visibility resume never claims playing')
assert(note.textContent.includes('could not play'))
let resumes=0,suspends=0,resumeFails=false
const gain={gain:{value:0},connect(){}}
class Context {
  sampleRate=100;destination={}
  createBuffer(){return {getChannelData(){return new Float32Array(200)}}}
  createBufferSource(){return {connect(){},start(){}}}
  createBiquadFilter(){return {frequency:{value:0},connect(){}}}
  createGain(){return gain}
  resume(){resumes++;return resumeFails ? Promise.reject(new Error('blocked')) : Promise.resolve()}
  suspend(){suspends++;return Promise.resolve()}
}
window.AudioContext=Context
const {ambientState,setAmbientEnabled,setAmbientVolume}=await import('./ambient-audio.ts')
assert.equal(resumes,0,'ambient does not instantiate or autoplay at boot')
await setAmbientEnabled(true);assert(ambientState().active && resumes===1)
const themePref=localStorage.getItem('grind-district-music')
setAmbientVolume(0);assert.equal(gain.gain.value,0)
assert.equal(slider.value,'31','ambient volume never changes theme volume')
assert.equal(localStorage.getItem('grind-district-music'),themePref,'ambient mute never changes theme preference')
hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));assert(!ambientState().active && suspends>0)
hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));await Promise.resolve();assert(ambientState().active)
await setAmbientEnabled(false);assert(!ambientState().active)
assert.equal(localStorage.getItem('grind-district-ambient'),'off')
resumeFails=true;await setAmbientEnabled(true);assert(!ambientState().active && ambientState().message.includes('could not start'), 'resume failure cannot claim ambient active')
resumeFails=false
Object.defineProperty(globalThis,'localStorage',{value:{getItem(){throw Error('private')},setItem(){throw Error('quota')}},configurable:true})
await setAmbientEnabled(true);assert(ambientState().active,'ambient still plays for this session when preference storage refuses writes')
setAmbientVolume(42);assert.equal(ambientState().volume,42,'session volume survives refused preference storage')
await setAmbientEnabled(false)
dom.window.close()
console.log('login allowlist and gesture/theme asset/playback race/failure/mute/ambient independence/visibility checks passed (mock audio, not audible browser test)')
