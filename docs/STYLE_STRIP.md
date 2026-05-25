# Stripstijlen — rendering-overlays

Elke stijl in dit bestand is een **rendering-overlay**: een extra instructielaag die bovenop de stijlmix van de driehoek (Gouden Eeuw / Jugendstil / Retro-SF) wordt gezet. Ze sturen de *tekenwijze* aan, onafhankelijk van de inhoudelijke stijlmix. Zie `wonderkrik/js/strip_styles.js` voor de exacte promptteksten die naar Gemini gaan.

---

## Nederlandse strips

### Joost Swarte — NL ligne claire (satirisch)

**Sleutel:** `swarte`

Joost Swarte is de grondlegger van de term "ligne claire" (1977) en de bedenker van de New Approach-beweging in de Nederlandse stripkunst. Zijn werk verscheen in NRC Handelsblad, De Nieuwe Revu, Raw magazine en op New Yorker-covers.

**Tekenwijze:**
- Volstrekt uniforme lijndikte, architectonisch precies — de Hergé-lijn, maar met de zekerheid van een grafisch ontwerper
- Platte kleurvlakken zonder gradients, bewust gekozen contrasten; de paletten zijn koeler en verrassender dan het klassieke Tintin-primair
- Sterke grafische compositie: figuren en achtergronden als even zware designelementen; actieve negatieve ruimte
- De Stijl- en Bauhaus-invloed zichtbaar in lay-out en typografische precisie

**Humor:**
Droog, satirisch, licht sinister onder een pristine oppervlak. De wereld ziet er volmaakt geordend en normaal uit — de grap zit volledig in de situatie of de combinatie, nooit in de tekening zelf. Geen knipoog naar de lezer.

**Past bij Bordewijk:**
Uitstekend. Swarte's droge precisie sluit perfect aan bij Bordewijks notariële ironie. Beide hanteren de techniek van het absurde dat als het gewoonste ter wereld wordt gepresenteerd.

---

### Mark Retera — DirkJan (absurdistisch-minimaal)

**Sleutel:** `retera`

Mark Retera is de maker van de langlopende Nederlandse krantenstrip *DirkJan* (1988–heden), verschenen in Elsevier, Het Parool en andere kranten. Zijn invloeden: Gary Larson (*The Far Side*), Brits surrealisme, Nederlandse nuchterheid.

**Tekenwijze:**
- Doelbewust simpele, bijna grove contouren — de lijnkwaliteit is niet virtuoos, maar intentioneel reductief
- Dikke, iets botte zwarte omtreklijnen; details worden weggelaten tot alleen de essentie overblijft
- Vrijwel geen arcering of structuur; geen kruisarceringen
- Figuren zijn bijna diagrammatisch: ronde compacte lichamen, stompe ledematen, grote vlakke hoofden
- Beperkt kleurpalet: maximaal twee à drie kleuren, volledig vlak

**Humor:**
Droogkomisch absurdisme in de Gary Larson-traditie. De situatie ís de grap. Personages reageren op het onmogelijke met milde verbazing in plaats van paniek. Volkomen nuchter, onopgesmukt, Hollands. De visuele soberheid *is* de humor: alles dat niet de premisse is, wordt weggestreept.

**Past bij Bordewijk:**
Treffend. Bordewijks neutrale registratie van het buitengewone ("Ik merkte echter niets bizonders dan een sterke windstroom") is precies Retera's register. De simpele tekenlijn werkt als de deadpan vertelstem.

---

## Belgisch / Frans

### Ligne claire — Hergé / Tintin

**Sleutel:** `ligne_claire`

De klassieke Belgische lijn: uniforme lijndikte, vlakke opake kleuren, geen gradients. Tintin-albums (Hergé, Casterman). Grafisch, leesbaar, tijdloos.

---

### Franquin — Gaston Lagaffe

**Sleutel:** `franquin`

Belgische school, Spirou-tijdperk (1956–1969). Variabele lijndikte, ronde elastische figuren, vlakke primaire kleuren. Uitbundig expressief — het tegenovergestelde van Hergé's koelheid. Referentie: Gaston Lagaffe, Spirou et Fantasio.

---

### Moebius / Jean Giraud

**Sleutel:** `moebius`

Ultra-precise uniforme pen. Immense lege ruimtes, kleine figuren tegen kolossale landschappen. Minerale kleuren (oker, terracotta, zandwit). Referentie: Arzach (1975), L'Incal.

---

## Overig

### Manga (Urasawa / Otomo)

**Sleutel:** `manga`

Rijpe realistische manga-traditie — geen anime, geen chibi. G-pen met variabele lijndikte, rastertonen op analoog screentone-vel, B&W. Referentie: Naoki Urasawa, Jiro Taniguchi, Katsuhiro Otomo.

---

### Noir / Zwart-wit (Eisner)

**Sleutel:** `noir`

70% van het beeld is vol zwart. Enkel lichtbron, alles eromheen duister. Penseelzwart voor grote vlakken, kraaienpenpunt voor details. Referentie: Will Eisner's The Spirit, Frank Miller's Sin City (B&W volumes).

---

### Underground / Raw (Crumb)

**Sleutel:** `underground`

Doelbewust grof. Anti-glad. Krassende pen op ruw papier, dichte onregelmatige arcering, groteske expressionistische figuren. Referentie: Robert Crumb, Gilbert Shelton.

---

## Hoe stripstijlen in de pipeline werken

De stripstijl-overlay wordt in `generator.js` als extra blok na de STYLE_DEFS-mix ingevoegd, vóór de wereldregels en de scène-inhoud:

```
[STYLE_DEFS mix-instructie]
[STRIP_STYLES overlay — als geselecteerd]
[WORLD_RULES]
[CHARACTER SHEET]
[SCENE CONTENT]
```

De overlay stuurt de *tekenwijze* aan; de driehoeksmix bepaalt de *kunststroming en het kleurklimaat*. Beide instructies werken samen: Moebius + Retro-SF geeft een 50s SF-cover in Moebius-penlijnen; Retera + Gouden Eeuw geeft een minimalistisch DirkJan-figuur voor een Van Ruisdael-hemel.
