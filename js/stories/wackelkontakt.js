// stories/wackelkontakt.js — StoryDef
// Wackelkontakt — Oimara (2024)

export default {
  id: 'wackelkontakt',
  title: 'Wackelkontakt',
  author: 'Oimara',
  year: 2024,
  genre: 'poëzie',
  fileCode: 'WK',
  writerStyle: 'Oostenrijks dialect, zelfspot, energetisch, humoristisch, retro-metaforisch, repetitief-ritmisch',
  sourceUrl: null,
  defaultStyle: { w1: 0.1, w2: 0.45, w3: 0.45, realism: 20 },

  worldRules: `WORLD RULES — apply unconditionally regardless of realism level:
• The setting is a retro 1960s–70s Austrian domestic interior with warm orange and brown tones, shag carpets, wood-panelled walls, and vintage furniture.
• The central visual motif is a flickering, oversized floor lamp from the seventies — its bulb constantly flashing between blazing bright and sudden darkness, surrounded by sparks and blown fuses.
• Electrical imagery is everywhere: crackling cables, overloaded circuit breakers, glowing filaments, and surreal lightning bolts.
• The atmosphere oscillates between cosy kitsch and chaotic electrical overload, with a carnival-like energy and comedic self-deprecation.
• Characters appear slightly cartoonish, dressed in retro 70s fashion, celebrating among identical vintage lamps that blink erratically.
FORBIDDEN: modern minimalist interiors, smartphones, LED lighting, sleek technology, somber or realistic tone.`,

  chapters: [
    { id: 'ch1', title: 'Wär ich ein Möbelstück' },
    { id: 'ch2', title: 'I hob an Wackelkontakt' },
    { id: 'ch3', title: 'I bin ned so helle' },
    { id: 'ch4', title: 'Und wenn i feiern geh' },
  ],

  paragraphs: [
    { id: 1, chapter: 'ch1', text: 'Wär ich ein Möbelstück, dann wär ich eine Lampe aus den Siebzigern — i glüh gern vor, i geh gern aus, mir hauts die Sicherungen naus. I saug die Kernkraftwerke leer, i lauf auf achttausend Ampere.' },
    { id: 2, chapter: 'ch2', text: 'I hob an Wackel-Wackel-Wackel-Wackel-Wackel-Wackel-Wackelkontakt — Wos hod er? An Wackelkontakt. I hob an Wackelkontakt, i hob an Wackelkontakt, i hob an Wackelkontakt.' },
    { id: 3, chapter: 'ch3', text: 'I bin ned so helle, helle in der Kapelle — i bin retro, ausschaun dua i geht so. Pietro Lombardi is a Intelligenzbolzn gegen mich, aber hin und wieder flackert bei mir oben auch ein Licht.' },
    { id: 4, chapter: 'ch3', text: 'Und des is geil so — i steh gern auf da Leitung. Mei Birndl leidet oft amoi an Spannungsüberschreitung. Gleichstrom, Wechselstrom, Highway to Hell — Hell, hell, da Hellste is er ned!' },
    { id: 5, chapter: 'ch1', text: 'Wär ich ein Möbelstück, dann wär ich eine Lampe aus den Siebzigern — i glüh gern vor, i geh gern aus, mir hauts die Sicherungen naus. I saug die Kernkraftwerke leer, i lauf auf achttausend Ampere.' },
    { id: 6, chapter: 'ch2', text: 'I hob an Wackel-Wackel-Wackel-Wackel-Wackel-Wackel-Wackelkontakt — Wos hod er? An Wackelkontakt. I hob an Wackelkontakt, i hob an Wackelkontakt, i hob an Wackelkontakt.' },
    { id: 7, chapter: 'ch4', text: 'Und wenn i feiern geh, feier i mit Lampen aus die Sechzger Jahr — die gliahn no länger vor, die gengan öfter aus. Da haust die Sicherung ganz sicher naus. Wär ich ein Möbelstück.' },
  ],
};
