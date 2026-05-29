// stories/welcome_to_the_internet.js — StoryDef
// Welcome to the Internet — Bo Burnham (2021)

export default {
  id: 'welcome_to_the_internet',
  title: 'Welcome to the Internet',
  author: 'Bo Burnham',
  year: 2021,
  genre: 'poëzie',
  fileCode: 'WI',
  writerStyle: 'satirisch, escalerend, muzikaal-theatraal, donker-humoristisch, confronterend, hyperbolisch',
  sourceUrl: null,
  defaultStyle: { w1: 0.1, w2: 0.25, w3: 0.65, realism: 22 },

  worldRules: `WORLD RULES — apply unconditionally regardless of realism level:
• The visual world is a garish, overstimulating digital carnival: neon-lit screens, infinite scrolling interfaces, and pop-up windows cascade in every direction.
• The aesthetic blends the glossy cheerfulness of early-2000s internet design with increasingly sinister undertones — bright primary colors gradually corrupted by glitch effects, disturbing imagery, and decay.
• A suited, carnival-barker host figure presides over a chaotic stage filled with contradictory content: news tickers, cat videos, extremist forums, cooking tutorials, and conspiracy theories coexist in claustrophobic proximity.
• Technology is omnipresent and anthropomorphized — devices glow with hungry, watchful eyes.
• The atmosphere begins as welcoming and whimsical, then spirals into overwhelming, complicit dread.
FORBIDDEN: clean minimalist interfaces, peaceful natural environments, neutral or unlit spaces.`,

  chapters: [
    { id: 'ch1', title: 'Welcome' },
    { id: 'ch2', title: 'Everything All of the Time' },
    { id: 'ch3', title: 'Before Your Time' },
    { id: 'ch4', title: 'All of the Time' },
  ],

  paragraphs: [
    { id: 1,  chapter: 'ch1', text: 'Welcome to the internet, have a look around. Anything that brain of yours can think of can be found. We\'ve got mountains of content, some better, some worse. If none of it\'s of interest to you, you\'d be the first.' },
    { id: 2,  chapter: 'ch1', text: 'Welcome to the internet, come and take a seat. Would you like to see the news or any famous women\'s feet? There\'s no need to panic, this isn\'t a test. Just nod or shake your head, and we\'ll do the rest.' },
    { id: 3,  chapter: 'ch1', text: 'Welcome to the internet, what would you prefer? Would you like to fight for civil rights or tweet a racial slur? Be happy, be horny, be bursting with rage. We\'ve got a million different ways to engage.' },
    { id: 4,  chapter: 'ch1', text: 'Welcome to the internet, put your cares aside. Here\'s a tip for straining pasta, here\'s a nine-year-old who died. We\'ve got movies and doctors and fantasy sports. And a bunch of colored-pencil drawings of all the different characters in Harry Potter fucking each other.' },
    { id: 5,  chapter: 'ch1', text: 'Welcome to the internet, hold on to your socks. \'Cause a random guy just kindly sent you photos of his cock. They are grainy and off-putting, he just sent you more. Don\'t act surprised, you know you like it, you whore.' },
    { id: 6,  chapter: 'ch2', text: 'See a man beheaded, get offended, see a shrink. Show us pictures of your children, tell us every thought you think. Start a rumor, buy a broom, or send a death threat to a boomer. Or DM a girl and groom her, do a Zoom or find a tumor in your—' },
    { id: 7,  chapter: 'ch2', text: 'Here\'s a healthy breakfast option, you should kill your mom. Here\'s why women never fuck you, here\'s how you can build a bomb. Which Power Ranger are you? Take this quirky quiz. Obama sent the immigrants to vaccinate your kids.' },
    { id: 8,  chapter: 'ch2', text: 'Could I interest you in everything all of the time? A little bit of everything all of the time? Apathy\'s a tragedy, and boredom is a crime. Anything and everything, all of the time.' },
    { id: 9,  chapter: 'ch3', text: 'You know, it wasn\'t always like this.' },
    { id: 10, chapter: 'ch3', text: 'Not very long ago, just before your time. Right before the towers fell, circa \'99. This was catalogs, travel blogs, a chatroom or two. We set our sights and spent our nights waiting for you — you, insatiable you.' },
    { id: 11, chapter: 'ch3', text: 'Mommy let you use her iPad, you were barely two. And it did all the things we designed it to do. Now look at you — you, unstoppable, watchable. Your time is now, your inside\'s out, honey, how you grew.' },
    { id: 12, chapter: 'ch3', text: 'And if we stick together, who knows what we\'ll do? It was always the plan to put the world in your hand.' },
    { id: 13, chapter: 'ch4', text: 'Could I interest you in everything all of the time? A bit of everything all of the time? Apathy\'s a tragedy, and boredom is a crime. Anything and everything, all of the time.' },
    { id: 14, chapter: 'ch4', text: 'Could I interest you in everything all of the time? A little bit of everything all of the time? Apathy\'s a tragedy, and boredom is a crime. Anything and everything and anything and everything and anything and everything and all of the time.' },
  ],
};
