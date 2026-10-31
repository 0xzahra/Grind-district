export type GuideStop = {
  title: string
  where: string
  text: string
}

export const GUIDE: GuideStop[] = [
  { title: 'Learning hall', where: 'North', text: 'Eight courses. A pass writes the CV, resume, and portfolio. The first Spot pass drops a $25 practice stipend.' },
  { title: 'Conference hall', where: 'Campus', text: 'One short talk. Proof of work, not a slogan. No fee.' },
  { title: 'Campus café', where: 'Campus', text: 'Season headlines. Gossip, not a signal. One read a day.' },
  { title: 'Trading floor', where: 'West', text: 'Practice spot book in UNIT. Size the clip. A red close can still count if the plan was sized.' },
  { title: 'Influencer row', where: 'East', text: 'Post a bounty. Practice pay and a portfolio line. One post a day.' },
  { title: 'Trenches', where: 'South', text: 'Practice MEME book. Attention can leave. Rank does not follow it.' },
  { title: 'Boutique', where: 'Northwest of the row', text: 'Player 8453, Shrimp, Ledger, Marina, Signal. Original bodies, free. Licensed collections are not on this street.' },
  { title: 'Gym', where: 'Northwest', text: 'A timing set. One logged set a day.' },
  { title: 'Church', where: 'Southeast', text: 'Rest counts. One visit a day. No donation.' },
  { title: 'Prayer space', where: 'Southwest', text: 'Sit once a day. Focus adds a quarter to the next course you pass.' },
  { title: 'The houses', where: 'East row', text: 'Your house, Adaeze, Malik, Nia, and a vacant room. Knock. The row is part of the city.' },
  { title: 'Carbon desk', where: 'By the basin', text: 'A practice pledge. It names a project. It does not retire a real credit.' },
  { title: 'Terminal café', where: 'Toward the row', text: 'Same season board as campus.' },
  { title: 'Plaza', where: 'Center', text: 'The ring, the rank ladder, and Unit 4. The robot is labeled Agent.' },
]
