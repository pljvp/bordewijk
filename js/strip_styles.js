// strip_styles.js — rendering-overlays voor stripstijlen
// Elke stijl is een volledige instructieblok dat als extra laag bovenop de STYLE_DEFS-mix
// aan de Gemini-beeldprompt wordt toegevoegd. De sleutelnaam correspondeert met de waarde
// van het #strip-style-select element in de UI.

export const STRIP_STYLES = {

  // ── Belgisch / Frans ──────────────────────────────────────────────────────

  ligne_claire: `COMIC BOOK RENDERING — Ligne claire (Belgian-Dutch school, 1950s–present):
LINES: Perfectly clean, uniform line weight throughout — the same thin black contour on every edge, face, background detail. No variation, no expression in the line itself. Lines are architectural and precise, never sketchy or gestural.
COLOUR: Flat, fully opaque local colours with zero gradients, zero shading, zero texture. Each area is one flat colour. Shadows are separate flat darker-colour shapes, never a gradient. Palette is clear and readable, not atmospheric.
STYLE: Simplified but precise forms. Clear readable silhouettes. Backgrounds are detailed but graphic — buildings, objects, and people all receive the same uniform line treatment. No character dominates through line weight.
PANELS/FRAMES: Single panel with a thin, precisely ruled black border — the same uniform line weight as all internal linework. The composition is orderly and measured: clear foreground, middle ground, and background separation. Camera position is steady and purposeful — no shaky-cam, no extreme angles without narrative reason. The framing is like a film still: each element is placed deliberately within the rectangle. No bleed, no broken border, no overlap. The white gutter outside the panel is implied. The panel is a self-contained, well-composed graphic unit.
COMPOSITION EXECUTION: Vary shot size cinematically — establishing shot for scene-setting, medium for staging, close-up for interiority; a sequence breathes with shot variety. Figures read and move left to right; action has direction. Camera shifts with narrative function: low angle for tension and threat, wide for environment and scale, close-up for character. Place figures in geometric tension arcs within the rectangle (diagonal, triangle, circle). No camera angle is neutral or arbitrary.
REFERENCE: The ligne claire technique as a printing style — clean contours, flat fills, graphic clarity. NOT any specific character design. Inspired by the Belgian-Dutch illustration tradition (Hergé, Joost Swarte, Bob De Moor).`,

  franquin: `COMIC BOOK RENDERING — Franquin / Belgian school (Spirou era, 1956–1969):
LINES: Variable-weight ink pen. Thick confident outer contours, thinner interior detail lines, small hatching clusters in shadow areas only. Lines have energy and slight organic wobble — NOT ruler-straight.
CHARACTERS: Round, elastic forms — rubber-ball anatomy. Large mobile eyes, small noses, 5–6 heads tall. Faces are extremely expressive and rubbery.
BACKGROUNDS: Highly detailed architecture rendered with warm looseness — cobblestones, brickwork, wooden details all present but never stiff.
COLOUR: Flat opaque primary-palette colours. Cast shadows as defined separate flat shapes. No gradients.
PANELS/FRAMES: Thick black ruled border matching the weight of the outer character contours. The composition follows the Franco-Belgian "waffle iron" album format: horizontal tier structure with the panel wide enough to stage full comedic action or an establishing environment. Within the frame, characters are placed dynamically — rubber-limbed postures use the full panel height. Occasionally a gesture, exclamation effect, or extreme pose pushes right to the panel edge, suggesting the energy barely contained inside. White gutter outside the border. No irregular panel shapes, no diagonal cuts — the energy is inside the rectangle, not in the shape of the rectangle.
COMPOSITION EXECUTION: Diagonal framing for action and chaos, horizontal calm for dialogue and setup. Camera angle follows narrative function: low angle for threat and overwhelm, high angle for overview of chaotic scenes. Characters use the full panel height — rubber-limbed postures push toward all edges. Full body language always: posture, gesture, and face work as one expressive unit.
REFERENCE: Spirou et Fantasio (Franquin era). Gaston Lagaffe. NOT Hergé minimalism, NOT American superhero.`,

  // ── Nederlandse stripkunst ─────────────────────────────────────────────────

  swarte: `COMIC BOOK RENDERING — Joost Swarte (Dutch New Approach / ligne claire with graphic design edge, 1970s–present):
LINES: Perfectly uniform line weight — the Hergé clean line, but with the confidence of a graphic designer. Every contour is a deliberate compositional decision. Lines are architectural and precise.
COLOUR: Bold, carefully balanced flat colour fields — fewer colours than classic Hergé, but more surprising combinations. Strong contrast ratios, fully opaque fills, zero gradients. The palette draws on Dutch graphic design and De Stijl: high-contrast, considered, slightly cool.
COMPOSITION: Strong graphic-design sensibility. Figures and backgrounds treated as equal design elements. Negative space is active, not dead. Asymmetric layouts with poster-like impact.
HUMOUR: Dry, satirical, slightly sinister under a pristine surface. The world looks perfectly ordered and normal — the joke is entirely in the situation or juxtaposition, never in exaggerated drawing. Deadpan delivery, no winking at the reader.
PANELS/FRAMES: The panel frame is a deliberate design decision, not a convention. The border may be a thick clean rule that functions as a graphic element in its own right, or absent entirely — letting the image float as a poster-like composition. Influenced by De Stijl and Bauhaus grid thinking: the division of the image plane is as considered as the content. Asymmetric framing is normal — the image does not need to be centered or balanced in the conventional sense. Strong use of white space: emptiness carries as much weight as the drawn elements. The single image reads as a self-contained poster or print, not as one panel in a sequence.
COMPOSITION EXECUTION: Asymmetric framing is the default — centred is boring, deliberate imbalance is interesting. Negative space carries compositional weight: emptiness is as active as drawn content. Figures and background architecture are equal design elements; let geometric structure organise the image plane. Treat the rectangle like a poster: strong graphic impact, every element placed with graphic-design intention.
REFERENCE: Joost Swarte's strips for NRC Handelsblad, De Nieuwe Revu, Raw magazine. His poster and cover work. Simultaneously immaculate and subversive — NOT nostalgic Tintin pastiche.`,

  retera: `COMIC BOOK RENDERING — Mark Retera / DirkJan (Dutch minimalist absurdism, 1988–present):
CORE RULE: Maximally simplified. NOT realistic. NOT detailed. NOT photographic. Reduction to the bare minimum is the style.
LINES: Deliberately simple, almost crude black outlines. Thick, slightly blunt contours. Every detail is stripped away until only the essential shape remains. No cross-hatching, no hatching of any kind, no decorative linework whatsoever.
CHARACTERS: Extremely simplified, almost diagrammatic figures. Lanky or compact bodies with angular, minimal heads. Slouched awkward postures. Characters are generic and interchangeable — that is intentional.
EYES: This is the signature feature. Large round eye outlines containing ONLY a single tiny black dot as pupil — nothing else. No iris detail, no eyelid line, no lashes. This creates the trademark "wezenloze" look: a vacant, mildly dazed, perpetually mildly puzzled expression. The blankness IS the character.
FACES: Minimal — two dot-pupils in round eye outlines, a small line for a mouth, occasionally an overbite. No nose detail, no cheekbones, no shading. Faces are closer to icons than portraits.
COLOUR: Flat, very limited palette. Two or three solid colours maximum per image. No shading, no modelling, no texture, no gradients.
PANELS/FRAMES: Standard Dutch dagstrip (daily newspaper strip) single-panel format: wide horizontal rectangle, thin simple black border — as crude and minimal as the linework inside. No variation in frame shape, no dramatic framing, no diagonal cuts. The scene is staged straight-on at eye level — no high angles, no worm's-eye, no cinematic trickery. Characters stand in a plain interior or exterior. The composition is as flat and diagrammatic as the characters: everything centred or placed without fuss. No atmosphere, no staging drama. The frame is a box; what is inside the box is also a box.
COMPOSITION EXECUTION: Static eye-level camera, always — no dutch angles, no worm's eye, no cinematic trickery. Staging is deadpan and frontal. Composition is as flat and diagrammatic as the characters: centred or placed without drama. The absurd is treated with the same visual indifference as the mundane.
REFERENCE: DirkJan (Mark Retera, 1988–present). Dutch newspaper strip. Think: shapes so simple a child could trace them. Gary Larson's Far Side economy applied to Dutch daily life.`,

  // ── Frans / Internationaal ──────────────────────────────────────────────────

  moebius: `COMIC BOOK RENDERING — Moebius / Jean Giraud (Arzach, L'Incal, 1975–1985):
LINES: Ultra-precise uniform-weight technical pen. Every single line is deliberate and architectural. Zero expressive variation in line weight — pure information.
SPACE: Vast panoramic compositions with enormous empty space. Tiny figures against colossal landscapes or structures. Emptiness and silence are the subject.
FORMS: Clean geometric architecture fused with eroded organic terrain — rock formations, ancient stone, sand. Highly detailed but serene, never busy.
COLOUR: Flat mineral tones — dusty ochre, terracotta, sand-white, pale cerulean, warm grey. Diffuse even illumination, no dramatic shadows.
PANELS/FRAMES: The panel is treated as a small painting, not a narrative container. Borders are thin or absent — the image opens outward, breathing into the white space around it. Panoramic horizontal proportions are preferred: wide cinematic aspect ratios that emphasise the scale of landscape against a tiny figure. When a border exists it is a hairline rule, not a heavy black frame. The composition itself is the frame: a vast sky or desert anchors the image top and bottom with silence. Full-page or near-full-page proportions are appropriate for the most monumental scenes. No crowded panels, no cluttered staging — the empty space IS the composition.
COMPOSITION EXECUTION: Whatever the camera angle, the frame must breathe — sky, landscape, or architecture fills at least half the image. Tiny figures against colossal environments. Prefer wide horizontal proportions that emphasise scale. Single-point perspective used hypnotically for depth and distance. Silence and emptiness are the compositional subject — not negative space to be filled.
REFERENCE: Arzach (1975 wordless album), pages drawn by Moebius in L'Incal, Le Garage Hermétique. NOT generic Heavy Metal fantasy.`,

  // ── Overige tradities ───────────────────────────────────────────────────────

  manga: `COMIC BOOK RENDERING — Eiichiro Oda / One Piece (shounen manga, 1997–present):
CORE RULE: Wildly cartoonish. NOT realistic. NOT photographic. Exaggeration is the point.
LINES: Bold, confident variable-weight black ink outlines. Thick contour lines on characters and objects. Energetic, slightly loose strokes — never stiff or mechanical.
ANATOMY: Extreme exaggeration throughout. Oversized heads, fists, and arms. Tiny waists. Absurdly varied proportions from character to character. Silhouette clarity over anatomical correctness. Rubbery, elastic body language.
FACES: Large expressive eyes and mouths. Extreme emotional range — broad comedy and high drama in the same image. Rubbery, rubber-face expressions pushed to caricature.
COLOUR: High-saturation flat colour with hard-edged cel-shading. Bold shadow shapes as solid flat darker tones. No gradients. Saturated warm palette: vivid oranges, reds, blues, greens. Thick black ink separates every colour area.
BACKGROUNDS: Thick contour lines plus dense crosshatching for shadows and texture. Detailed but clearly drawn, not photographed. Architecture rendered with energy rather than precision.
PANELS/FRAMES: Bold thick black panel border (matching the heavy ink contour weight). The composition is dynamic and asymmetric: treat this as a splash panel — a full-page pivotal image where scale and energy dominate. Characters can burst through the panel border: limbs, weapons, or speed lines break the frame line to show unstoppable force. Diagonal energy lines (speed lines, impact radials) fan outward from the action centre. The camera angle is dramatic — extreme low angle, tilted horizon, or fish-eye perspective. Gutter minimised; the image pushes to all edges. Size and pose are exaggerated to the maximum: bigger, louder, more impossible than reality.
COMPOSITION EXECUTION: Extreme angles for drama — worm's eye, fish-eye, severe diagonal tilt. Never neutral or centred. Characters burst through the panel border: limbs, weapons, speed lines. Vary composition energy: radial burst for impact, diagonal sweep for motion, extreme close-up for emotional peak. Every composition is a dramatic statement; scale, angle, and energy always pushed to maximum.
REFERENCE: Eiichiro Oda, One Piece manga (colour chapter covers, colour volumes). NOT Urasawa realism, NOT Otomo grittiness — pure Oda cartoon energy.`,

  noir: `COMIC BOOK RENDERING — Noir graphic novel (Eisner / Miller ink school):
KEY RULE: 70% of the image is solid black. Light carves forms from darkness — not the other way.
TECHNIQUE: Brush ink for large black fills. Crow quill pen for detail within lit zones. No pencil texture, no watercolour wash — pure hard ink, binary black and white.
LIGHTING: Single brutal light source — bare bulb, streetlamp, window rectangle. Everything outside that cone is pure black.
WET STREETS: Rain-slick reflections of the single light source. Parallel diagonal hatching lines suggest rainfall in black areas.
ANGLES: Extreme low worm's-eye angles (figures loom against dark sky) OR direct overhead view (lone figure below).
PANELS/FRAMES: The panel border is not a clean ruled line — it is defined by the darkness of the image itself. Heavy black fills reach the frame edge, making the border indistinguishable from the composition: ink bleeds to the very edge. Panel shape can follow environmental architecture: a window frame, a door edge, a building wall becomes the panel outline. Extreme aspect ratios: a very tall narrow format (figure standing in an alley) or a very wide horizontal (city skyline at night). The "gutter" is not white — it is black or absent, because the darkness connects across any gap. According to Eisner's own framework, the panel outline is in service of the story: let the shape of darkness define the frame.
COMPOSITION EXECUTION: Camera is always extreme — never neutral eye-level. Worm's eye (figures loom massive against dark sky) or direct overhead (lone figure small and exposed below). Architecture creates frames within frames: a window, doorway, stairwell, or fire escape outlines the subject. The geometry of shadow defines the composition. Every angle is a dramatic declaration.
REFERENCE: Will Eisner's The Spirit, Frank Miller's Sin City (pure B&W volumes), Mazzucchelli's Batman Year One, Tardi's Nestor Burma. NOT grey watercolour "neo-noir" — binary black-white only.`,

  underground: `COMIC BOOK RENDERING — Underground comix (American underground, 1968–1975):
CORE PRINCIPLE: Deliberately crude. Anti-slick. Proudly imperfect.
LINEWORK: Scratchy energetic pen — nib dragged across rough paper. Lines overshoot corners, wobble, double back. Nothing is clean or straight.
CROSS-HATCHING: Dense irregular hatching everywhere — for shadow, texture, and visual noise. No empty clean areas.
FIGURES: Grotesque exaggeration — big noses, heavy jaws, wild tangled hair. Expressionist distortion, not naturalism.
PRODUCTION: Self-published newsprint quality. Misregistered colour if colour present. Hand-lettered text.
PANELS/FRAMES: Hand-ruled wobbly border — the frame line is drawn freehand: slightly bowed, uneven thickness, corners that don't quite meet. The border is clearly hand-made, not printed or mechanical. The composition is dense and crowded: figures push against all four edges, speech balloons overflow into the margins, there is no measured white space or breathing room. The page feels like a photocopied zine — every square centimetre is filled. Crumb specifically removes border outlines from some panels, leaving an open edge that suggests the moment is uncontained in time. Text and image are treated as equally drawn objects: letters are hand-lettered shapes, not typography. Anti-slick in every element including the frame itself.
COMPOSITION EXECUTION: Static ground-level camera, eye-level observation — no cinematic flourishes. Figures large and heavy in the frame, bodies crowding the space. Dense, packed compositions where content pushes against all four edges. Occasionally: repeat the exact same framing with changing content for deadpan time-lapse. No staging drama, no breathing room — fill every corner with something.
REFERENCE: Robert Crumb (Mr. Natural, Fritz the Cat), Gilbert Shelton (Fabulous Furry Freak Brothers), S. Clay Wilson. Raw underground only — NOT clean modern indie comics.`,
};
