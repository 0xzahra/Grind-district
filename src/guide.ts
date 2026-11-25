export type GuideStop = {
  title: string
  where: string
  text: string
}

export const GUIDE: GuideStop[] = [
  { title: 'Campus', where: 'North', text: 'Twenty courses. A pass writes the CV, resume, and portfolio. The first Spot pass drops a $25 practice stipend.' },
  { title: 'Conference centre', where: 'Campus', text: 'Stage, rows of seats and a schedule of in-game Web3 events: AMAs, Spaces-style talks, hackathon demo days. Join one for in-game cash and reputation.' },
  { title: 'Grind Café', where: 'By McGrind', text: 'The glass café: coffee, tea and meat pies, and today’s market board in plain words. One read a day.' },
  { title: 'McGrind', where: 'Beside Grind Café', text: 'Burgers, fries, shawarma and boba. Eat, or work a paid shift in the kitchen.' },
  { title: 'Grind Market', where: 'West of McGrind', text: 'A covered market hall. Rent a stall, stock it and sell.' },
  { title: 'Grind Bank', where: 'West', text: 'How crypto institutions keep your coins, spot crypto ETFs to practise with, and halal savings.' },
  { title: 'Barakah Club', where: 'West', text: 'Dinner with friends at tables for four, and a quiet prayer corner.' },
  { title: 'Trading floor', where: 'West', text: 'Practice book for coins and tokens. Size the clip. A red close can still count if the plan was sized.' },
  { title: 'Influencer row', where: 'East', text: 'Post a bounty. Practice pay and a portfolio line. One post a day.' },
  { title: 'Mempool', where: 'South', text: 'Practice MEME book. Attention can leave. Rank does not follow it.' },
  { title: 'Boutique', where: 'Northwest of the row', text: 'The man and the woman. Masks wear the collection names in this city’s own shapes.' },
  { title: 'Gadgets', where: 'South of the plaza', text: 'Phones, laptops, accessories and drones. The auto dealership next door sells cars and jets.' },
  { title: 'Gym', where: 'Northwest', text: 'A timing set. One logged set a day.' },
  { title: 'Church', where: 'Southeast', text: 'Rest counts. One visit a day. No donation.' },
  { title: 'Masjid', where: 'Southwest', text: 'Sit once a day. Focus adds a quarter to the next course you pass.' },
  { title: 'The houses', where: 'East row', text: 'Your house, the notes house, the set house, the grove house, and a vacant room. Knock. The row is part of the city.' },
  { title: 'Carbon desk', where: 'By the basin', text: 'A practice pledge. It names a project. It does not retire a real credit.' },
  { title: 'Terminal café', where: 'Toward the row', text: 'The same market board as Grind Café.' },
  { title: 'Plaza', where: 'Center', text: 'The ring, the rank ladder, and Unit 4. The robot is labeled Agent.' },
]
