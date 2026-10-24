export interface Reading {
  id: string;
  title: string;
  reference: string;
  deva: string;
  iast: string;
  english: string;
  note: string;
  pages: string[];
  words: string[];
}
export const READINGS: Reading[] = [
  {
    id: "two",
    title: "Two grāmas",
    reference: "Grosset p.28, prose before verse 25",
    deva: "अथ ग्रामौ । षड्जग्रामो मध्यमग्रामश्चेति । तत्र वा द्वाविंशतिश्रुतयः ।",
    iast: "atha grāmau. ṣaḍjagrāmo madhyamagrāmaś ceti. tatra vā dvāviṃśatiśrutayaḥ.",
    english:
      "Now the two grāmas: the ṣaḍja-grāma and the madhyama-grāma. In them, twenty-two śrutis.",
    note: "Grāmau is a dual: two grāmas. A grāma is a particular arrangement of notes and intervals. The text's claim of twenty-two is a count; this sentence does not assign a frequency ratio to each śruti. The short syllables Sa, Re, Ga, Ma, Pa, Dha, Ni are our display abbreviations.",
    pages: ["grosset-28.jpg", "grosset-57.jpg"],
    words: ["grāmau", "śruti", "dvāviṃśati"],
  },
  {
    id: "count",
    title: "Three, two, four…",
    reference: "Grosset p.28, verse 25",
    deva: "तिस्रो द्वे च चतस्रश्च चतस्रस्तिस्र एव च ।\nद्वे चतस्रश्च षड्जाख्ये ग्रामे श्रुतिनिदर्शनम् ॥",
    iast: "tisro dve ca catasraś ca catasras tisra eva ca |\ndve catasraś ca ṣaḍjākhye grāme śrutinidarśanam ||",
    english:
      "Three and two and four, and four, three as well; two and four: the indication of the śrutis in the grāma named ṣaḍja.",
    note: "Read as ascending gaps beginning at Sa: Sa–Re 3, Re–Ga 2, Ga–Ma 4, Ma–Pa 4, Pa–Dha 3, Dha–Ni 2, Ni–Sa 4. The following named-note verses assign Sa four because that is the interval arriving at Sa. Starting the ascending gap row with four would put the counts on the wrong intervals.",
    pages: ["grosset-28.jpg"],
    words: ["tisraḥ", "dve", "catasraḥ"],
  },
  {
    id: "lower",
    title: "Lower Pa",
    reference: "Grosset p.28, prose after verse 25",
    deva: "मध्यमग्रामे तु श्रुत्यपकृष्टः पञ्चमः कार्यः ।",
    iast: "madhyamagrāme tu śrutyapakṛṣṭaḥ pañcamaḥ kāryaḥ.",
    english: "But in the madhyama-grāma, Pa is to be made lower by a śruti.",
    note: "Kāryaḥ is an instruction: 'to be made'. The count verses below tell us which adjacent groups change. Pa's arriving interval has three; Dha's has four. Our operation keeps the other six notes fixed. The longer two-vīṇā demonstration that follows is bracketed by Grosset as doubtful; we do not claim to reconstruct that whole experiment.",
    pages: ["grosset-28.jpg", "grosset-57.jpg", "grosset-86.jpg"],
    words: ["tu", "apakṛṣṭaḥ", "pañcama", "kāryaḥ"],
  },
  {
    id: "sadja1",
    title: "The first four named counts",
    reference: "Grosset p.29, verse 26; 1894 p.302, verse 2",
    deva: "षड्जश्चतुःश्रुतिर्ज्ञेय ऋषभस्त्रिश्रुतिस्तथा ।\nद्विश्रुतिश्चैव गान्धारो मध्यमश्च चतुःश्रुतिः ॥",
    iast: "ṣaḍjaś catuḥśrutir jñeya ṛṣabhas triśrutis tathā |\ndviśrutiś caiva gāndhāro madhyamaś ca catuḥśrutiḥ ||",
    english: "Sa is to be known as having four śrutis, and Re three; Ga has two, and Ma four.",
    note: "These are counts assigned to the named notes, read here as the preceding interval. Catuḥ-, tri- and dvi- mean four, three and two. Sandhi changes the endings of words when they meet: jñeyaḥ + ṛṣabhaḥ appears here as jñeya ṛṣabhas before the next word.",
    pages: ["grosset-29.jpg", "natya-302.jpg"],
    words: ["jñeyaḥ", "catuḥśruti", "triśruti", "dviśruti"],
  },
  {
    id: "sadja2",
    title: "Pa, Dha and Ni",
    reference: "Grosset p.29, verse 27; 1894 p.302, verse 3",
    deva: "चतुःश्रुतिः पञ्चमः स्याद्धैवतस्त्रिश्रुतिस्तथा ।\nनिषादो द्विश्रुतिश्चैव षड्जग्रामे भवन्ति हि ॥",
    iast: "catuḥśrutiḥ pañcamaḥ syād dhaivatas triśrutis tathā |\nniṣādo dviśrutiś caiva ṣaḍjagrāme bhavanti hi ||",
    english:
      "Pa would have four śrutis, and Dha three; Ni has two. So they are in the ṣaḍja-grāma.",
    note: "Together with the previous verse: Sa 4, Re 3, Ga 2, Ma 4, Pa 4, Dha 3, Ni 2. There are three groups of four, two of three and two of two: 12 + 6 + 4 = 22.",
    pages: ["grosset-29.jpg", "natya-302.jpg"],
    words: ["pañcama", "triśruti", "dviśruti"],
  },
  {
    id: "madhyama1",
    title: "The two changed intervals",
    reference: "Grosset p.29, verse 28",
    deva: "चतुःश्रुतिस्तु विज्ञेयो मध्यमः पञ्चमः पुनः ।\nत्रिश्रुतिर्धैवतस्तु स्याच्चतुःश्रुतिक एव हि ॥",
    iast: "catuḥśrutis tu vijñeyo madhyamaḥ pañcamaḥ punaḥ |\ntriśrutir dhaivatas tu syāc catuḥśrutika eva hi ||",
    english:
      "Ma is to be known as having four śrutis; Pa, in turn, three. But Dha would have four.",
    note: "The text now begins its list at Ma. Keep the note names attached to their counts: Ma 4, Pa 3, Dha 4. Lowering Pa contracts Ma–Pa and expands Pa–Dha; their combined seven counts remain seven.",
    pages: ["grosset-29.jpg", "grosset-58.jpg"],
    words: ["tu", "pañcama", "triśruti", "catuḥśruti"],
  },
  {
    id: "madhyama2",
    title: "The remaining notes",
    reference: "Grosset p.29, verse 29",
    deva: "निषादषड्जौ विज्ञेयौ द्विचतुःश्रुतिसंभवौ ।\nऋषभस्त्रिश्रुतिश्च स्याद्गान्धारो द्विश्रुतिस्तथा ॥",
    iast: "niṣādaṣaḍjau vijñeyau dvicatuḥśrutisambhavau |\nṛṣabhas triśrutiś ca syād gāndhāro dviśrutis tathā ||",
    english:
      "Ni and Sa are to be known as having two and four śrutis respectively; Re would have three, and Ga two.",
    note: "The dual niṣādaṣaḍjau joins the two note names. With the previous verse, this gives the full second arrangement. Our display keeps Sa at the left in both rows so that moving Pa is visible; the name madhyama-grāma does not force the player to begin every ascent on Ma.",
    pages: ["grosset-29.jpg", "grosset-58.jpg"],
    words: ["dviśruti", "triśruti", "catuḥśruti"],
  },
  {
    id: "order",
    title: "Seven notes in succession",
    reference: "1894 p.302, first half of verse 8",
    deva: "क्रमयुक्ताः स्वराः सप्त मूर्छनेत्यभिसंज्ञिताः ।",
    iast: "kramayuktāḥ svarāḥ sapta mūrchanetyabhisaṃjñitāḥ |",
    english: "Seven notes joined in succession are designated a mūrchanā.",
    note: "This is the first half of the verse, not its entire text. Changing the first note gives a different ordered ascent through an existing tuning. Our seven ascending rotations illustrate this structural distinction; they do not reproduce a historical melody, ornamentation or the full theory of named mūrchanās.",
    pages: ["natya-302.jpg", "grosset-86.jpg"],
    words: ["krama", "svara", "sapta", "mūrchanā"],
  },
];
export const WORDS: Record<string, { deva: string; meaning: string; reading: string }> = {
  grāmau: {
    deva: "ग्रामौ",
    meaning: "the two grāmas; dual of grāma",
    reading: "Notice the ending -au for a pair.",
  },
  śruti: {
    deva: "श्रुति",
    meaning: "a heard interval distinction; the unit counted here",
    reading: "Do not silently replace this word with an equal division of an octave.",
  },
  dvāviṃśati: {
    deva: "द्वाविंशति",
    meaning: "twenty-two",
    reading: "The total count in either arrangement.",
  },
  tisraḥ: {
    deva: "तिस्रः",
    meaning: "three; feminine form",
    reading: "Before the following sound, tisraḥ becomes tisro or tisras in the verse.",
  },
  dve: { deva: "द्वे", meaning: "two", reading: "A dual number form." },
  catasraḥ: {
    deva: "चतस्रः",
    meaning: "four; feminine form",
    reading: "Appears as catasraś and catasras through sandhi.",
  },
  tu: {
    deva: "तु",
    meaning: "but; marking a contrast",
    reading: "The word that signals the change to the other grāma.",
  },
  apakṛṣṭaḥ: {
    deva: "अपकृष्टः",
    meaning: "drawn down, lowered",
    reading: "In śrutyapakṛṣṭaḥ, the lowering is by a śruti.",
  },
  pañcama: {
    deva: "पञ्चम",
    meaning: "fifth; the note abbreviated Pa",
    reading: "The one note that moves in this bench's retuning.",
  },
  kāryaḥ: {
    deva: "कार्यः",
    meaning: "to be made or done",
    reading: "A verbal adjective of obligation, not a statement that it has already happened.",
  },
  jñeyaḥ: {
    deva: "ज्ञेयः",
    meaning: "to be known",
    reading: "The instruction introducing a classification.",
  },
  catuḥśruti: {
    deva: "चतुःश्रुति",
    meaning: "having four śrutis",
    reading: "A count attached to a named note.",
  },
  triśruti: {
    deva: "त्रिश्रुति",
    meaning: "having three śrutis",
    reading: "Compare tri- with English triple.",
  },
  dviśruti: {
    deva: "द्विश्रुति",
    meaning: "having two śrutis",
    reading:
      "Compare dvi- with English dual; the count remains two in both arrangements for Ga and Ni.",
  },
  krama: {
    deva: "क्रम",
    meaning: "succession; order",
    reading: "The order is changed when you choose a new starting note.",
  },
  svara: { deva: "स्वर", meaning: "note; musical tone", reading: "Svarāḥ is plural: notes." },
  sapta: {
    deva: "सप्त",
    meaning: "seven",
    reading: "Seven named notes, with the starting note repeated at the octave in our ascent.",
  },
  mūrchanā: {
    deva: "मूर्छना",
    meaning: "an ordered ascending or descending succession",
    reading:
      "We use ascending rotations to distinguish order from retuning. Historical performance is richer than this model.",
  },
};
