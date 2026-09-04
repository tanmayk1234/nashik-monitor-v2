// How sure the map is about a position, and what the popup says about it.
//
// Two vocabularies, not one. Most layers were placed by this repo's own
// pipeline and carry locationConfidence: a locality-match was placed by
// matching address text to a locality centroid, an approximate one landed near
// the city centre because even that failed. Both are neighbourhood-level
// guesses and both have to say so — a silent locality match is how City Centre
// Mall sat 688 m from the building while looking like solid data.
//
// hospitals.geojson is the exception. It arrived with the initial import
// carrying geocodeConfidence HIGH/MEDIUM/LOW, no script here produces it, and
// what the upstream grades mean is recorded nowhere. What is measurable is how
// often a grade stacks several hospitals on one coordinate: LOW 75%, MEDIUM
// 60%, HIGH 35%, with 19 piled on the worst single point. So the gradient is
// real, and none of the three is a surveyed position. HIGH says so too rather
// than passing silently — quietly, because 206 of the 495 hospitals are HIGH
// and alarming on all of them would train people to stop reading the badge.
export type Caveat = { text: string; tone: 'warn' | 'note' };

export const VERIFIED = 'verified';

export const CAVEAT: Record<string, Caveat> = {
  'locality-match': {
    text: 'Approximate — placed by locality name from its address, not a surveyed position.',
    tone: 'warn',
  },
  approximate: {
    text: 'Approximate — no locality match, placed near the city centre.',
    tone: 'warn',
  },
  // Stronger than "approximate", and a different kind of claim. An approximate
  // point is a real thing whose position was guessed; an indicative one is a
  // marker for planned coverage that was never a survey of anything. 2,200 of
  // the 4,079 CCTV points were scattered at random inside planning polygons by a
  // generator, and nothing establishes the rest as surveyed either.
  indicative: {
    text: 'Indicative only — a marker for planned coverage, not a surveyed position. There is no camera at this point.',
    tone: 'warn',
  },
  LOW: {
    text: 'Low confidence — a neighbourhood-level position, usually shared with other hospitals in this source. Treat it as the area, not the building.',
    tone: 'warn',
  },
  MEDIUM: {
    text: 'Medium confidence — approximate, and often shared with other hospitals in this source.',
    tone: 'warn',
  },
  HIGH: {
    text: 'Highest confidence in this source, but not a surveyed position.',
    tone: 'note',
  },
};
