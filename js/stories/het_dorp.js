// stories/het_dorp.js — StoryDef
// Het Dorp — Wim Sonneveld (1966)

export default {
  id: 'het_dorp',
  title: 'Het Dorp',
  author: 'Wim Sonneveld',
  year: 1966,
  genre: 'poëzie',
  fileCode: 'WD',
  writerStyle: 'nostalgisch, lyrisch, ironisch-bitter, beeldend, eenvoudig taalgebruik, melancholisch',
  sourceUrl: null,
  defaultStyle: { w1: 0.2, w2: 0.47, w3: 0.33, realism: 62 },

  worldRules: `The setting alternates between two eras of a small Dutch rural village. The first era is early-to-mid 20th century: cobblestone streets, horse-drawn carts, a church steeple, a butcher's shop, a pump in front of the town hall, sandy paths through wheat fields, farmhouses surrounded by greenery, hedgerows and garden flowers, women in modest dress cycling, children playing outdoors. The second era is the modernized 1960s version of the same village: concrete block housing with large glass windows, plastic decorations, television sets visible through windows, youth in miniskirts and Beatles-style hair. The visual atmosphere shifts from warm, sepia-toned and organic to cold, grey and synthetic. A recurring visual motif is the tall trees lining a garden path, seen through the eyes of a child — timeless, towering, and ultimately lost.`,

  chapters: [
    { id: 'ch1', title: 'De ansichtkaart' },
    { id: 'ch2', title: 'Hoe het was' },
    { id: 'ch3', title: 'De modernisering' },
    { id: 'ch4', title: 'De dorpsjeugd' },
    { id: 'ch5', title: 'Wat er overbleef' },
  ],

  paragraphs: [
    { id: 1, chapter: 'ch1', text: "Thuis heb ik nog een ansichtkaart waarop een kerk, een kar met paard, een slagerij J. van der Ven, een kroeg, een juffrouw op de fiets. Het zegt u hoogstwaarschijnlijk niets, maar het is waar ik geboren ben." },
    { id: 2, chapter: 'ch2', text: "Dit dorp, ik weet nog hoe het was: de boerenkind'ren in de klas, een kar die ratelt op de keien, het raadhuis met een pomp ervoor, een zandweg tussen koren door, het vee, de boerderijen." },
    { id: 3, chapter: 'ch2', text: "En langs het tuinpad van m'n vader zag ik de hoge bomen staan. Ik was een kind en wist niet beter dan dat 't nooit voorbij zou gaan." },
    { id: 4, chapter: 'ch3', text: "Wat leefden ze eenvoudig toen, in simp'le huizen tussen groen, met boerenbloemen en een heg. Maar blijkbaar leefden ze verkeerd — het dorp is gemoderniseerd, en nou zijn ze op de goede weg." },
    { id: 5, chapter: 'ch3', text: "Want ziet, hoe rijk het leven is: ze zien de televisiequiz en wonen in betonnen dozen. Met flink veel glas, dan kun je zien hoe of het bankstel staat bij Mien, en d'r dressoir met plastic rozen." },
    { id: 6, chapter: 'ch3', text: "En langs het tuinpad van m'n vader zag ik de hoge bomen staan. Ik was een kind en wist niet beter dan dat 't nooit voorbij zou gaan." },
    { id: 7, chapter: 'ch4', text: "De dorpsjeugd klit wat bij elkaar, in minirok en beatlehaar, en joelt wat mee met beatmuziek. Ik weet wel, het is hun goeie recht, de nieuwe tijd, net wat u zegt, maar het maakt me wat melancholiek." },
    { id: 8, chapter: 'ch5', text: "Ik heb hun vaders nog gekend: ze kochten zoethout voor een cent. Ik zag hun moeders touwtjespringen. Dat dorp van toen, het is voorbij. Dit is al wat er bleef voor mij: een ansicht en herinneringen." },
    { id: 9, chapter: 'ch5', text: "Toen ik langs het tuinpad van m'n vader de hoge bomen nog zag staan — ik was een kind, hoe kon ik weten dat dat voorgoed voorbij zou gaan." },
  ],
};
