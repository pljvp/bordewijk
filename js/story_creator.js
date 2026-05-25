// story_creator.js — vrije tekst → StoryDef via Claude
import { claudeComplete } from './api.js';

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'verhaal_' + Date.now();
}

function extractJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Geen JSON gevonden in Claude-respons');
  try { return JSON.parse(m[0]); }
  catch {
    // Saniteer letterlijke newlines in strings
    const s = m[0].replace(/"((?:[^"\\]|\\.)*)"/gs,
      (_, v) => '"' + v.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ') + '"');
    return JSON.parse(s);
  }
}

export async function generateStoryDef(text, signal) {
  const prompt = `Je bent een literair redacteur die verhaaltekst omzet naar een gestructureerd StoryDef-JSON-object voor een illustratiegenerator.

VERHAALTEKST:
${text}

Genereer een JSON-object met PRECIES deze structuur (geen andere tekst):
{
  "title": "de verhaaltitel (afleidbaar uit de tekst, of stel er zelf een voor)",
  "author": "auteursnaam of 'Anoniem'",
  "year": null of het jaar als integer,
  "genre": "roman | sf | sprookje | thriller | saga | poëzie | overig",
  "fileCode": "2 hoofdletters voor bestandsnamen (bijv. 'VE' voor Verplaatsing van elementen, 'BS' voor Bolifur Saga)",
  "writerStyle": "3-6 kenmerken van de schrijfstijl, kommagescheiden",
  "worldRules": "Beschrijf in het Engels de vaste visuele wereldregels die ALTIJD van toepassing zijn bij beeldgeneratie: bijzondere locaties, tijdperk, technologie, kledingstijl, atmosfeer. Wees concreet en beeldend. Minimaal 3 zinnen.",
  "chapters": [{"id": "ch1", "title": "hoofdstuktitel"}],
  "paragraphs": [{"id": 1, "chapter": "ch1", "text": "alineatekst zonder §-nummers"}],
  "defaultStyle": {"w1": 0.34, "w2": 0.33, "w3": 0.33, "realism": 50}
}

Regels:
- Splits de tekst op in zinvolle, zelfstandig leesbare alinea's
- Elke alinea krijgt een uniek oplopend numeriek id (1, 2, 3, …)
- Schrijf GEEN §-nummers of alinea-nummers in de tekst zelf
- Als er hoofdstukken zijn, maak ze herkenbaar in chapters[] en wijs elk paragraaf de juiste chapter-id toe
- Als er geen duidelijke hoofdstukken zijn, gebruik één hoofdstuk: {"id": "ch1", "title": ""}
- fileCode: kies 2 onderscheidende hoofdletters afgeleid van de titel (initialen van kernwoorden, NIET "DE"/"HET"/"EEN")
- defaultStyle: kies w1/w2/w3 die passen bij de sfeer (w1=gouden eeuw, w2=jugendstil, w3=magisch realisme); zorg dat ze optellen tot 1.0
- Antwoord UITSLUITEND met het JSON-object`;

  const raw = await claudeComplete([{ role: 'user', content: prompt }], '', signal);
  const def = extractJson(raw);

  // Normaliseer en vul verplichte velden aan
  def.id = slugify(def.title || 'verhaal');
  def.paragraphs = (def.paragraphs || []).map((p, i) => ({
    id: typeof p.id === 'number' ? p.id : i + 1,
    chapter: p.chapter || 'ch1',
    text: String(p.text || '').trim(),
  })).filter(p => p.text);
  def.chapters = def.chapters?.length ? def.chapters : [{ id: 'ch1', title: '' }];
  def.worldRules = def.worldRules || '';
  def.defaultStyle = def.defaultStyle || { w1: 0.34, w2: 0.33, w3: 0.33, realism: 50 };
  def.sourceUrl = null;
  if (!def.fileCode || !/^[A-Z]{2}$/.test(def.fileCode)) {
    const words = (def.title || '').toUpperCase()
      .replace(/[^A-Z\s]/g, '').split(/\s+/)
      .filter(w => !['DE', 'HET', 'EEN', 'VAN', 'IN', 'OP', 'THE', 'A', 'AN', 'OF'].includes(w))
      .filter(Boolean);
    def.fileCode = ((words[0]?.[0] || 'X') + (words[1]?.[0] || words[0]?.[1] || 'X')).toUpperCase();
  }

  return def;
}
