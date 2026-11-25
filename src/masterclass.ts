// Society Masterclasses: the premium track at the Etiquette House. Eight in-depth classes for people who were not
// raised around money or formal society and want the real, practical version: how wealth is actually built and
// carried, quiet luxury, tact versus lies (and spotting people who larp wealth), fine dining and hosting, working a
// room at the top, presence and voice, first-class travel and hotels, and negotiation. Each has lesson cards with
// specific how-to detail, a real-life scenario and a three-question test; all eight earn the Society Masterclass
// diploma. Paid in game dollars. Life skills: reputation and a diploma, not a Web3 certificate.
// Progress lives beside the save (`<slot>.masterclass`), so the save format is unchanged.
import { slotKey, addReputation, spendInGame } from './state.ts'
import { etiquetteIcon } from './etiquetteIcons.ts'
import { CLASSES, classesDone } from './society.ts'

type Card = { h: string; t: string }
type Q = { q: string; options: string[]; right: number; why: string }
export type Masterclass = { id: string; title: string; tagline: string; minutes: number; usd: number; cards: Card[]; scenario: Q; quiz: Q[] }

export const MASTERCLASSES: Masterclass[] = [
  {
    id: 'mindset', title: 'The Wealth Mindset', tagline: 'How wealth is really built, kept and passed on.', minutes: 12, usd: 300,
    cards: [
      { h: 'Income is not wealth', t: 'Wealth is what you own that keeps paying you after you stop working: businesses, shares, property, skills that compound. A big salary spent in full leaves nothing. Track your net worth (what you own minus what you owe) once a month; it is the only score that matters.' },
      { h: 'Pay yourself first', t: 'The day money arrives, move a fixed share (start at 10%, aim for 20 to 30%) into savings and investments before you spend anything. Automate it so willpower never enters the room. People who wait to save "what is left" never have anything left.' },
      { h: 'Compounding is the engine', t: 'The rule of 72: divide 72 by the yearly return to see how long money takes to double. At 8% a year it doubles in about 9 years, so 25 years turns 1 into roughly 7. Starting early beats starting big; time in the market beats timing it.' },
      { h: 'Assets before lifestyle', t: 'Buy the things that pay you before the things that cost you. A car, a watch and a bigger flat are expenses that also cost upkeep. The usual order: an emergency fund of 3 to 6 months of costs, no high-interest debt, then investing, then upgrades paid from what the investments earn.' },
      { h: 'Size every risk', t: 'Never put in more than you can lose without changing your life. Spread money across things that do not fall together. One bet should never be able to wipe you out; the wealthy stay wealthy mainly by avoiding ruin.' },
      { h: 'Own equity, not just hours', t: 'Hours are capped at 24 a day. Ownership is not: a share in a company, a product that sells while you sleep, writing or code that people keep using. Ask of every opportunity: "Do I own a piece of what I am building?"' },
      { h: 'Habits of people who stay rich', t: 'They read daily, protect their health and sleep, keep a small circle of honest advisers, write down decisions and review them, give generously, and say no to most things. Wealth is mostly patience and boring consistency, repeated for decades.' },
    ],
    scenario: { q: 'You get a $5,000 bonus. A friend says to buy a designer bag "because you deserve it". What does the wealth mindset do?', options: ['Buy the bag: you earned it', 'Top up the emergency fund, invest most of it, and enjoy a small planned treat', 'Put it all into a coin a stranger recommended'], right: 1, why: 'Reward yourself on purpose and in proportion; the rest goes to work for you.' },
    quiz: [
      { q: 'At 9% a year, roughly how long does money take to double?', options: ['About 4 years', 'About 8 years', 'About 20 years'], right: 1, why: '72 ÷ 9 = 8 years.' },
      { q: 'Which comes first?', options: ['A new car', 'An emergency fund and clearing high-interest debt', 'A second phone'], right: 1, why: 'Security first, so one bad month never forces you to sell at the worst time.' },
      { q: 'What does "pay yourself first" mean?', options: ['Spend on yourself before bills', 'Save and invest a fixed share the day money arrives', 'Ask for a pay rise'], right: 1, why: 'Automatic saving before spending is the habit behind most self-made wealth.' },
    ],
  },
  {
    id: 'quiet', title: 'Quiet Luxury: Old Money, New Money', tagline: 'Money talks; wealth whispers.', minutes: 10, usd: 300,
    cards: [
      { h: 'The difference', t: 'New money often shows itself: big logos, the latest everything, prices mentioned. Old money assumes nobody needs to be told: plain, perfect quality, worn for years, never discussed. You do not need to be born rich to carry yourself with the second style.' },
      { h: 'Quality over labels', t: 'Choose fabric and fit over branding: wool, cotton, linen, cashmere, leather that ages well. A tailor who takes in a good jacket for little money does more than any logo. Three excellent outfits beat thirty loud ones.' },
      { h: 'Grooming is the luxury', t: 'Clean, shaped nails, a fresh haircut, polished shoes, pressed clothes and a light scent read as wealth before anything you own. They are also the cheapest upgrades there are.' },
      { h: 'Keep things, look after them', t: 'Repairing a good pair of shoes, re-heeling, conditioning leather and keeping a watch serviced signal care and patience. Constant replacing signals the opposite.' },
      { h: 'Never discuss prices', t: 'In polished company you do not say what things cost, what you earn or what you paid for the house. If someone admires something: "Thank you, I have had it for years," and move the conversation to them.' },
      { h: 'Gracious with everyone', t: 'Real class shows most with people who can do nothing for you: drivers, cleaners, waiters, security. Learn their names, thank them by looking at them, never snap your fingers or raise your voice.' },
      { h: 'Modesty is a choice of focus', t: 'Talk about ideas, places, books, people and the work you love, not possessions. Ask more than you tell. People leave thinking you are interesting because you were interested.' },
    ],
    scenario: { q: 'At a dinner, someone asks how much your watch cost. The quiet-luxury reply?', options: ['Tell them the exact price', '"Too much, honestly! It was a gift to myself for a milestone. Do you collect?"', 'Show them the receipt on your phone'], right: 1, why: 'Warm, light, no number, and the attention goes back to them.' },
    quiz: [
      { q: 'Which reads as old money?', options: ['A huge logo on every item', 'Plain, well-fitted clothes in good fabric, kept for years', 'The newest phone in each hand'], right: 1, why: 'Fit, fabric and care, not branding.' },
      { q: 'The cheapest upgrade that reads as wealth?', options: ['A loan for a car', 'Grooming: hair, nails, pressed clothes, polished shoes', 'A fake watch'], right: 1, why: 'Grooming is seen first and costs least.' },
      { q: 'How do you treat a waiter?', options: ['Click your fingers to call them', 'Ignore them', 'Eye contact, please and thank you, their name if they give it'], right: 2, why: 'Respect for people who serve you is the clearest mark of class.' },
    ],
  },
  {
    id: 'signal', title: 'Signal, Tact and Larping', tagline: 'What to show, what to keep private, and how to spot people who fake it.', minutes: 14, usd: 300,
    cards: [
      { h: 'The levels of what you show', t: 'Think of five levels. Privacy: you never owe anyone your numbers. Tact: leaving things unsaid to be kind ("It was lovely" about a so-so meal). Curation: showing your best real work. Puffery: inflating it ("I basically run the team"). Misrepresentation: inventing it (fake wealth, fake results). Live in the first three.' },
      { h: 'Tact is not lying', t: 'Tact chooses which true thing to say and when. "I am so glad you invited me" is tact; "I loved the fish" when you hated it is a small kindness most cultures accept. Saying you own a company you do not is a lie, and lies about money and status come back.' },
      { h: 'Why faking it backfires', t: 'Larping (acting out a life you do not have) costs real money in rentals and debt, attracts the wrong people, and makes every new friend a risk of being found out. Passing off fake results to win money or investment is fraud in most countries. Curate, never fabricate.' },
      { h: 'How larpers are spotted', t: 'Watch for: the same car or villa appearing in different people\'s photos (rentals and photo-shoot sets), only outcomes and never the work, screenshots of profits with no account history, urgency to get you to invest, and stories that change when you ask a second question.' },
      { h: 'Questions that cut through', t: 'Ask calmly and specifically: "What does a normal week look like?" "Who are your customers?" "How did you get the first ten?" Real operators love these questions; larpers change the subject or get angry.' },
      { h: 'Answering the money question', t: 'When asked what you earn or what you are worth: "Enough to be grateful, not enough to stop working!" or "I keep that between me and my accountant, but I am happy to talk about how I got started." Warm, no number, door left open.' },
      { h: 'What is safe to show', t: 'Show real skills, real projects, real certificates, real lessons from failure. Those compound into a reputation that survives scrutiny. A verified track record, even a small one, beats any staged photo.' },
    ],
    scenario: { q: 'A new contact posts a rented supercar and offers you "guaranteed 30% a month" if you join today. Your move?', options: ['Join quickly before spots run out', 'Ask what the business does and how returns are made, take a night to think, and decline any guarantee', 'Post your own rented car to match'], right: 1, why: 'Guaranteed high returns plus urgency is the pattern of a scam; questions and time protect you.' },
    quiz: [
      { q: 'Which is tact rather than a lie?', options: ['Saying you went to a university you did not', 'Choosing not to mention a friend\'s mistake in front of others', 'Posting someone else\'s profit screenshot'], right: 1, why: 'Kind omission is tact; inventing facts is a lie.' },
      { q: 'A strong sign someone is larping wealth?', options: ['They ask about your work', 'Only outcomes, never the work, plus pressure to invest now', 'They wear plain clothes'], right: 1, why: 'Outcomes without process, plus urgency, is the classic tell.' },
      { q: 'Someone asks your net worth at a party. Best reply?', options: ['Give the exact number', '"Enough to be grateful! Happy to tell you how I got started though."', 'Make a bigger number up'], right: 1, why: 'Warm, private, and it keeps the conversation going.' },
    ],
  },
  {
    id: 'dining', title: 'Fine Dining and Hosting', tagline: 'Read any table, order with ease, host a dinner people remember.', minutes: 12, usd: 300,
    cards: [
      { h: 'Read the table: BMW', t: 'Bread plate on the left, Meal in the middle, Water and glasses on the right. Cutlery works from the outside in, one set per course; the small fork and spoon above the plate are for dessert.' },
      { h: 'Napkin and posture', t: 'Napkin on your lap once everyone sits; on your chair if you step away; loosely folded on the left of the plate when you leave. Sit straight, wrists at the table edge, elbows off while eating, phone away.' },
      { h: 'Cutlery signals', t: 'Resting: knife and fork crossed or in an inverted V on the plate. Finished: both together, side by side, pointing to about 4 o\'clock (UK: 6 o\'clock). Staff read these and clear without asking.' },
      { h: 'Ordering with ease', t: 'Ask the server what they would choose; it is a compliment, not a weakness. Order mid-priced when someone else is paying, match the host\'s number of courses, and never order the most expensive thing on their bill.' },
      { h: 'Not drinking is normal', t: '"Sparkling water for me, thank you" needs no reason. For a toast, raise any glass. Nobody polished asks why you are not drinking, and you never have to explain your faith or your health.' },
      { h: 'Who pays, and tipping', t: 'Whoever invites pays. Settle the bill quietly away from the table. Tipping: in the US about 18 to 22% (it is much of the server\'s wage); in the UK 10 to 12.5%, often already on the bill as "service charge", so check first.' },
      { h: 'Hosting', t: 'Ask about allergies and diet when you invite. Greet every guest at the door, introduce people with a line about each other, seat talkers beside quiet guests, keep glasses full, and serve one thing you have cooked before. Send a short thank-you message the next day.' },
    ],
    scenario: { q: 'A colleague invites you to a fine restaurant. The menu has no prices on your copy. What do you do?', options: ['Order the lobster and the tasting menu', 'Ask what they recommend and choose something in the middle, matching their courses', 'Ask to see the prices'], right: 1, why: 'A menu without prices means the host is paying; choose modestly and follow their lead.' },
    quiz: [
      { q: 'Which side is your bread plate?', options: ['Left', 'Right', 'Above the plate'], right: 0, why: 'BMW: bread left, meal middle, water right.' },
      { q: 'You have finished eating. Your knife and fork go…', options: ['Crossed on the plate', 'Side by side, pointing to about 4 o\'clock', 'On the tablecloth'], right: 1, why: 'Together and parallel means finished.' },
      { q: 'Tipping in a US restaurant, good service?', options: ['Nothing', 'About 18 to 22%', 'Exactly $1'], right: 1, why: 'Tips make up much of US servers\' pay.' },
    ],
  },
  {
    id: 'room', title: 'Working the Room at the Top', tagline: 'Galas, launches and dinners: meet the right people and be remembered.', minutes: 11, usd: 300,
    cards: [
      { h: 'Before you arrive', t: 'Know three things: who is hosting, two or three people you hope to meet and why, and one thing you can offer each of them. Arrive in the first half hour, when people are open and not yet in tight circles.' },
      { h: 'Joining a group', t: 'Approach open groups (people standing in a C, not a closed O). Wait for a pause, smile, and say: "Mind if I join you? I\'m Ada." Groups of three are easiest to join; pairs deep in talk are not.' },
      { h: 'The two-minute exchange', t: 'Name, a one-line hook ("I build tools that help shops accept payments"), then a question about them. Keep your story to one breath. Interesting people are interested.' },
      { h: 'Remember them', t: 'Say their name back once. Afterwards, note one detail (a child starting school, a trip, a project) in your phone. Mentioning it next time is the most powerful networking move there is.' },
      { h: 'Leaving gracefully', t: '"It\'s been a real pleasure. I\'ll let you mingle; could I send you a note this week?" Then go. Lingering costs both of you the room.' },
      { h: 'Give before you ask', t: 'Offer an introduction, an article, a lead, or help with something small. Ask for nothing at the first meeting. People open doors for those who have already opened one for them.' },
      { h: 'The double opt-in introduction', t: 'Before introducing two people by email, ask each privately if they want it. Then write one line about each and why they should talk, and step back. It protects everyone\'s time and your name.' },
    ],
    scenario: { q: 'You meet an investor you admire at a launch. You have two minutes. What do you do?', options: ['Pitch your whole idea and ask for money', 'Say your name and hook, ask about what they are excited about, mention one way you could help, and ask if you may send a note', 'Ask for a selfie and leave'], right: 1, why: 'Curiosity and a light offer earn the follow-up; the pitch can wait.' },
    quiz: [
      { q: 'Which group is easiest to join?', options: ['Two people in close conversation', 'An open group of three standing in a C', 'A closed circle'], right: 1, why: 'Open body language invites you in.' },
      { q: 'What do you ask for at a first meeting?', options: ['A job', 'Money', 'Nothing beyond permission to follow up'], right: 2, why: 'Give first; ask later.' },
      { q: 'A double opt-in introduction means…', options: ['Copying both people without asking', 'Checking with each person privately before connecting them', 'Introducing two people twice'], right: 1, why: 'Consent first protects both their time and your reputation.' },
    ],
  },
  {
    id: 'presence', title: 'Presence and Voice', tagline: 'Walk in, speak, and hold a room with calm authority.', minutes: 10, usd: 300,
    cards: [
      { h: 'Posture first', t: 'Stand tall with weight on both feet, shoulders back and down, chin level. Take up the space you need; do not shrink. Before a big moment, two minutes of slow breathing in an open stance settles the voice.' },
      { h: 'Eye contact', t: 'Hold it for most of the time someone is speaking (about 60 to 70%), breaking it naturally to think. In a group, give each person a moment of your eyes as you talk.' },
      { h: 'Speak slower, lower, shorter', t: 'Nerves speed us up. Slow down by a third, finish sentences downwards instead of rising like a question, and cut filler words. Short sentences sound confident.' },
      { h: 'The power of the pause', t: 'Pause before an important point and after a question. Silence makes people lean in and makes you sound sure. Count two seconds in your head.' },
      { h: 'The handshake and greeting', t: 'Firm, not crushing; two pumps; eye contact and a smile. Where a handshake is not the custom, or for religious reasons, a hand on the heart and a warm nod is gracious and widely understood.' },
      { h: 'Saying no gracefully', t: '"Thank you for thinking of me. I can\'t take that on, but I\'d be glad to suggest someone." Kind, clear, and with an alternative. No long excuses.' },
      { h: 'Handling a hard moment', t: 'If someone is rude, lower your voice instead of raising it, name the issue, not the person, and offer a next step: "I hear the deadline is the worry. Let\'s agree what can be done by Friday." Calm wins rooms.' },
    ],
    scenario: { q: 'You are asked a tough question on stage and do not know the answer. The strong response?', options: ['Make something up confidently', 'Pause, say "Good question. I don\'t want to guess; let me find out and come back to you," and follow up', 'Ignore it and move on'], right: 1, why: 'Honesty delivered calmly reads as more authority than a bluff.' },
    quiz: [
      { q: 'Roughly how much eye contact while someone talks?', options: ['None', 'About 60 to 70%', 'Unbroken staring'], right: 1, why: 'Steady, natural, with breaks to think.' },
      { q: 'Nervous speakers tend to…', options: ['Speak too slowly', 'Speed up and end sentences on a rising note', 'Pause too much'], right: 1, why: 'Slow down and end statements downwards.' },
      { q: 'A gracious no includes…', options: ['A long apology', 'Thanks, a clear no, and an alternative', 'Ignoring the message'], right: 1, why: 'Kind, short, helpful.' },
    ],
  },
  {
    id: 'travel', title: 'First Class Travel and Fine Hotels', tagline: 'Fly, check in and be looked after like a regular.', minutes: 10, usd: 300,
    cards: [
      { h: 'The airport', t: 'Arrive early and unhurried. Premium cabins and airline status give priority check-in, security and boarding, and lounge access; credit cards and alliances can give lounge access too. In the lounge, eat and rest; it is a quiet space, so take calls outside.' },
      { h: 'On board', t: 'Greet the crew, learn your seat\'s controls, and ask for what you need politely: they want to help. Dress smart-comfortable: layers, clean shoes you can slip off. Keep your voice low; premium cabins are quiet.' },
      { h: 'Upgrades', t: 'Upgrades go mainly to frequent flyers with status, and to people who book flexible fares. Asking politely at check-in costs nothing, but never demand one or claim to be someone you are not.' },
      { h: 'Checking in to a fine hotel', t: 'Give your name, say if it is a special occasion, and ask for what matters to you (a quiet room, a high floor). Learn the concierge\'s name; they can book tables, cars and tickets that seem impossible.' },
      { h: 'Tipping in hotels', t: 'US: bellhop about $2 to $5 a bag, housekeeping $3 to $5 a night left daily with a note, concierge $10 to $20 for real help. UK: tipping is lighter; a few pounds for porters and concierge help is appreciated, not required.' },
      { h: 'Respect the staff', t: 'Say thank you, keep the room reasonable, never take your frustration out on the front desk. Regulars who are kind get remembered, and get upgrades.' },
      { h: 'Privacy while travelling', t: 'Post holiday photos after you leave, not while you are away from home. Keep valuables in the room safe, and do not say your room number aloud in the lobby.' },
    ],
    scenario: { q: 'Your hotel room is not what you booked. The polished way to fix it?', options: ['Shout at reception', 'Calmly explain what you booked, show the confirmation, and ask what they can do; thank them when it is fixed', 'Leave a one-star review without saying anything'], right: 1, why: 'Calm, specific and kind gets the best outcome, often with an upgrade.' },
    quiz: [
      { q: 'Who usually gets free upgrades?', options: ['People who demand them', 'Frequent flyers with status', 'Anyone in sunglasses'], right: 1, why: 'Status and flexible fares drive upgrades.' },
      { q: 'US hotel housekeeping tip?', options: ['Nothing', 'About $3 to $5 a night, left daily', '$100 on the last day'], right: 1, why: 'Leave it daily: different staff may clean each day.' },
      { q: 'When should you post holiday photos?', options: ['Live, as you travel', 'After you are home', 'Never'], right: 1, why: 'Posting live tells the world your home is empty.' },
    ],
  },
  {
    id: 'deals', title: 'Negotiation and Deals', tagline: 'Get fair deals without losing friends.', minutes: 12, usd: 300,
    cards: [
      { h: 'Know your walk-away', t: 'Before any negotiation, decide your best alternative if there is no deal (negotiators call it your BATNA) and your walk-away point. The person who can walk away calmly holds the power.' },
      { h: 'Do the homework', t: 'Know the market price, what the other side needs, their deadline and their alternatives. Most negotiations are won before anyone speaks.' },
      { h: 'Anchor and justify', t: 'The first credible number shapes the deal. If you know the market, open first with an ambitious but defensible figure and the reason for it. If you do not, let them open and ask how they got there.' },
      { h: 'Use silence', t: 'After you make an offer, stop talking. After they make one, pause before answering. Silence makes people improve their offer; nerves make us give things away.' },
      { h: 'Never negotiate against yourself', t: 'If they say "That is too high," ask "What were you thinking?" instead of lowering your own number. Every concession should get something back: "I can do that if you can pay upfront."' },
      { h: 'Look for both sides\' wins', t: 'Price is one lever. Others: timing, payment terms, scope, credit, exclusivity, a referral. Trading things that are cheap for you but valuable to them makes bigger deals and lasting relationships.' },
      { h: 'Put it in writing', t: 'Summarise what was agreed in a short message the same day and get it confirmed. Read contracts before signing, have a lawyer read big ones, and walk away from anyone who rushes you to sign.' },
    ],
    scenario: { q: 'A client says your $2,000 quote is too high. Best reply?', options: ['"OK, $1,000 then"', '"Thanks for being straight. What budget did you have in mind? If it is lower, we could reduce the scope or spread the payments."', 'Hang up'], right: 1, why: 'Ask first, protect your price, and trade scope or terms rather than cutting blind.' },
    quiz: [
      { q: 'What is your BATNA?', options: ['Your opening price', 'Your best option if this deal does not happen', 'The other side\'s name'], right: 1, why: 'It sets your walk-away point.' },
      { q: 'After making an offer, you should…', options: ['Keep explaining', 'Stay quiet and let them respond', 'Lower it straight away'], right: 1, why: 'Silence keeps your offer strong.' },
      { q: 'A good concession sounds like…', options: ['"Fine, whatever you want"', '"I can do that if you can pay upfront"', '"I\'ll take less"'], right: 1, why: 'Every give gets a get.' },
    ],
  },
  {
    id: 'posture', title: 'Posture and Poise', tagline: 'Stand, sit and walk like you belong in any room.', minutes: 9, usd: 300,
    cards: [
      { h: 'The stack', t: 'Stand with your ears over your shoulders, shoulders over hips and hips over ankles. Weight even on both feet, knees soft rather than locked, chin level with the floor. Imagine a thread lifting the crown of your head: taller, not stiffer.' },
      { h: 'Shoulders and hands', t: 'Roll your shoulders up, back, then let them drop. That opens the chest without puffing it out. Hands rest at your sides or lightly together in front at waist height: out of your pockets, and never folded across your chest when you meet someone.' },
      { h: 'Sitting well', t: 'Sit back so the chair holds your lower back, both feet flat, knees about level with your hips. At a formal table sit upright on the front two-thirds of the seat, wrists on the table edge and elbows off it while you eat. No jiggling legs; if you cross, cross at the ankles.' },
      { h: 'Walking in', t: 'Walk at an even pace from the hips, head level, eyes up (not on your phone), arms swinging naturally. At a doorway pause for one breath, look round the room, then walk in. That small pause reads as calm and gives you time to find your host.' },
      { h: 'Greeting with your whole body', t: 'Stand up to greet anyone who arrives, above all elders and guests. Turn to face them fully, feet and chest, not just your head. Follow local custom: in many homes a slight bow, a bend of the knee or kneeling for elders is the greeting, so take your lead from the host.' },
      { h: 'Phones and desks', t: 'Bring your phone up to your eyes instead of bowing your head to it; hours with a dropped head strain the neck. At a desk, top of the screen at eye level, feet flat, and stand up every 30 to 45 minutes. Good posture is mostly a good set-up.' },
      { h: 'Build it daily', t: 'The wall check: heels a hand\'s width from a wall, then let the back of your head, shoulder blades and bottom touch it. Hold for a minute and remember how it feels. Rows, planks and chest stretches make it easy to keep. Two minutes a day beats one heroic hour.' },
    ],
    scenario: { q: 'You arrive for an interview and the panel is already seated. Best first move?', options: ['Hurry in with your head down and sit straight away', 'Pause at the door, walk in tall at an even pace, greet each person facing them, and sit when invited', 'Lean on the door frame and wave'], right: 1, why: 'A calm entrance, full-facing greetings and waiting to be asked to sit say confidence and respect before you say a word.' },
    quiz: [
      { q: 'Standing tall means…', options: ['Chest puffed out, chin held high', 'Ears over shoulders over hips, chin level, knees soft', 'Weight on one hip'], right: 1, why: 'Stacked and level reads as calm; puffed and stiff reads as tense.' },
      { q: 'At a formal dinner, your elbows…', options: ['Rest on the table while you eat', 'Stay off the table while you eat', 'Hold your phone up'], right: 1, why: 'Wrists may rest on the edge; elbows stay off while you eat.' },
      { q: 'The easiest fix for a bowed "phone neck"?', options: ['Lift the phone up to eye level', 'Look down harder', 'Buy a bigger phone'], right: 0, why: 'Bring the screen up instead of bowing your head down to it.' },
    ],
  },
]

const REP_EACH = 8, REP_ALL = 25
// The Society Masterclass diploma is the original eight; newer masterclasses (Posture and Poise) are extras, so
// nobody who already holds the diploma loses it.
const DIPLOMA = ['mindset', 'quiet', 'signal', 'dining', 'room', 'presence', 'travel', 'deals']
const hasDiploma = (passed: string[]) => DIPLOMA.every((id) => passed.includes(id))
const key = () => `${slotKey()}.masterclass`
type Store = { owned: string[]; passed: string[] }
const read = (): Store => { try { const v = JSON.parse(localStorage.getItem(key()) ?? 'null') as Store | null; if (v && Array.isArray(v.owned) && Array.isArray(v.passed)) return v } catch { /* none */ } return { owned: [], passed: [] } }
const write = (s: Store) => { try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ } }
export const masterclassesPassed = (): number => read().passed.length
export const masterclassDiploma = (): boolean => hasDiploma(read().passed)
// Unlocking the rest together costs $225 a class instead of $300 (the old "all eight for $1,800").
const BUNDLE_EACH = 225
const NEW_IDS = new Set(['posture'])

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }

/** Progress dots for a lesson: done, current, still to come. */
function dots(total: number, at: number): HTMLElement {
  const d = el('div', 'et-dots')
  for (let i = 0; i < total; i++) d.append(el('i', i < at ? 'done' : i === at ? 'on' : ''))
  return d
}

/** The house crest, its two progress meters and a line on what it is. */
function hero(): HTMLElement {
  const s = read()
  const box = el('div', 'et-hero')
  const words = el('div', 'et-hero-w')
  words.append(el('strong', 'et-hero-t', 'Polish that opens doors'), el('span', 'et-hero-s', 'Manners · Presence · Poise'))
  box.append(etiquetteIcon('crest', 'et-crest'), words)
  const meters = el('div', 'et-meters')
  const meter = (label: string, n: number, of: number, gold: boolean) => {
    const m = el('div', `et-meter${gold ? ' gold' : ''}`)
    const top = el('div', 'et-meter-t'); top.append(el('span', '', label), el('b', '', `${n}/${of}`))
    const bar = el('div', 'et-bar'); const fill = el('i'); fill.style.width = `${Math.round((n / Math.max(1, of)) * 100)}%`; bar.append(fill)
    m.append(top, bar); return m
  }
  meters.append(meter('Masterclasses', s.passed.length, MASTERCLASSES.length, true), meter('Free classes', classesDone(), CLASSES.length, false))
  box.append(meters)
  if (hasDiploma(s.passed)) box.append(el('p', 'et-badge', 'Society Masterclass diploma holder'))
  return box
}

/** The Masterclasses list, a class's lessons, its scenario and its test. Re-renders itself. */
export function masterclassNodes(h: H): HTMLElement[] {
  const root = el('div', 'soc mc')
  let at: Masterclass | null = null
  let step = 0 // cards, then the scenario, then each quiz question
  let note = ''
  const open = (m: Masterclass) => {
    if (!read().owned.includes(m.id)) {
      const p = spendInGame(m.usd, `Masterclass: ${m.title}`, 'The Etiquette House')
      if (!p.ok) { h.finish(p.message); return }
      write({ ...read(), owned: [...read().owned, m.id] })
    }
    at = m; step = 0; note = ''; render()
  }
  const render = () => {
    root.replaceChildren()
    const s = read()
    if (!at) {
      root.append(hero())
      const sec = el('div', 'et-sec'); sec.append(el('h4', 'soc-h', 'Society Masterclasses'), el('span', 'et-sec-tag', 'Premium'))
      root.append(sec)
      const count = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][MASTERCLASSES.length] ?? String(MASTERCLASSES.length)
      root.append(h.para(`${count} in-depth classes with the real detail: money, manners, presence, posture and how the polished world actually works. Paid with game dollars you earn: $${MASTERCLASSES[0]!.usd} each, or $${BUNDLE_EACH} each when you unlock the rest together.`, 'et-lead'))
      const locked = MASTERCLASSES.filter((m) => !s.owned.includes(m.id))
      if (locked.length > 1) {
        const price = locked.length * BUNDLE_EACH
        const what = locked.length === MASTERCLASSES.length ? `Unlock all ${locked.length}` : `Unlock the other ${locked.length}`
        root.append(h.button(`${what} · $${price.toLocaleString('en-US')}`, 'primary et-gold', () => {
          const p = spendInGame(price, `Society Masterclasses: ${locked.length} classes`, 'The Etiquette House')
          if (!p.ok) { h.finish(p.message); return }
          write({ ...read(), owned: MASTERCLASSES.map((m) => m.id) }); render()
        }))
      }
      const grid = el('div', 'et-grid')
      for (const m of MASTERCLASSES) {
        const passed = s.passed.includes(m.id), owned = s.owned.includes(m.id)
        const tile = el('button', `et-tile prem${passed ? ' passed' : ''}`)
        tile.type = 'button'
        if (NEW_IDS.has(m.id) && !passed) tile.append(el('span', 'et-new', 'NEW'))
        tile.append(etiquetteIcon(m.id), el('span', 'et-t', m.title), el('span', 'et-s', m.tagline))
        const meta = el('span', 'et-meta')
        meta.append(el('span', `et-chip${passed ? ' done' : owned ? '' : ' gold'}`, passed ? '✓ Passed' : owned ? 'Open' : `$${m.usd}`), el('span', 'et-min', `${m.minutes} min`))
        tile.append(meta)
        tile.addEventListener('click', () => open(m))
        grid.append(tile)
      }
      root.append(grid)
      root.append(h.para('Life skills for real life: reputation and a diploma, not a Web3 certificate.', 'muted'))
      return
    }
    const m = at
    const head = el('div', 'et-lesson-h')
    const words = el('div'); words.append(el('h4', 'soc-h', m.title), el('p', 'mc-tag', m.tagline))
    head.append(etiquetteIcon(m.id, 'et-ico big'), words)
    root.append(head)
    const total = m.cards.length + 1 + m.quiz.length
    root.append(dots(total, Math.min(step, total - 1)))
    if (step < m.cards.length) {
      const c = m.cards[step]!
      const card = el('div', 'et-card')
      card.append(el('p', 'mc-card-h', `${step + 1} · ${c.h}`), el('p', 'soc-card-t', c.t))
      root.append(card)
      root.append(h.button(step === m.cards.length - 1 ? 'To a real situation' : 'Next', 'primary', () => { step += 1; render() }))
    } else {
      const qi = step - m.cards.length
      const q = qi === 0 ? m.scenario : m.quiz[qi - 1]!
      const card = el('div', 'et-card ask')
      card.append(el('p', 'mc-card-h', qi === 0 ? 'Real situation' : `Test · question ${qi} of ${m.quiz.length}`), el('p', 'soc-card-t', q.q))
      root.append(card)
      if (note) root.append(h.para(note, 'soc-wrong'))
      q.options.forEach((o, i) => root.append(h.button(o, 'ghost', () => {
        if (i !== q.right) { note = `Not quite. ${q.why}`; render(); return }
        note = ''
        if (qi < m.quiz.length) { step += 1; h.finish(q.why); render(); return }
        const st = read()
        let msg = `Passed ${m.title}: +${REP_EACH} reputation.`
        if (!st.passed.includes(m.id)) {
          const before = hasDiploma(st.passed)
          st.passed.push(m.id); write(st)
          window.setTimeout(() => addReputation(REP_EACH, `Reputation: ${m.title}`, 'Masterclass passed at the Etiquette House.'), 0)
          if (!before && hasDiploma(st.passed)) {
            window.setTimeout(() => addReputation(REP_ALL, 'Reputation: Society Masterclass diploma', 'The eight diploma masterclasses passed.'), 30)
            msg = `Passed. The Society Masterclass diploma is yours (+${REP_EACH + REP_ALL} reputation).`
          }
          window.dispatchEvent(new CustomEvent('gd:masterclass', { detail: st.passed.length }))
        } else msg = `Passed ${m.title} again. Good to revise.`
        h.finish(msg)
        at = null; render()
      })))
    }
    root.append(h.button('Back to the masterclasses', 'ghost', () => { at = null; note = ''; render() }))
  }
  render()
  return [root]
}
