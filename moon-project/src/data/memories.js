import { publicAsset } from '../lib/publicAsset'

/**
 * Lunar illumination 0–1 (approximate).
 */
export function getMoonIllumination(date = new Date()) {
  const synodic = 29.53058867
  const knownNew = new Date('2000-01-06T18:14:00Z').getTime()
  const days = (date.getTime() - knownNew) / 86400000
  const phase = (days % synodic) / synodic
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)
}

export const STARS_TO_UNLOCK_FINAL = 5

const memoriesRaw = [
  {
    id: 'm1',
    type: 'gold',
    title: 'Your D.',
    label: 'October',
    text: 'You\'re the strongest woman I know for 12 hours a day, but in my arms, you can just be my sweet girl. I\'m so proud of you, baby',
    image: null,
    audio: null,
    position: [-8, 3, -18],
  },
  {
    id: 'm2',
    type: 'gold',
    title: 'That Smile',
    label: 'A Tuesday',
    text: 'You laughed at something small. I realized peace could live inside another person.',
    slideImages: [
      '/collage-smile/02.png',
      '/collage-smile/03.png',
      '/collage-smile/reveal-247.png',
      '/collage-smile/04.png',
      '/collage-smile/05.png',
      '/collage-smile/06.png',
      '/collage-smile/07.png',
      '/collage-smile/08.png',
      '/collage-smile/09.png',
      '/collage-smile/10.png',
      '/collage-smile/11.png',
    ],
    slideDurationSec: 5.6,
    slideAudioYoutubeId: 'R_fAf3Z9HVc',
    /** 1:26 — looping segment handled in SlideshowYoutubeAudio */
    slideAudioYoutubeStartSec: 86,
    pianoAudio: null,
    pianoCredit:
      'Lord Huron — “The Night We Met” · audio plays from YouTube (from 1:26, looping; rights retained by artists & label)',
    image: null,
    audio: null,
    position: [10, 5, -22],
  },
  {
    id: 'm3',
    type: 'blue',
    title: 'The Argument',
    label: '3:17 AM',
    text: "I didn't spend 4,000 years finding my voice just to use it to push you away. We're allowed to be annoyed, as long as we're annoyed together",
    image: null,
    audio: null,
    position: [-5, -4, -16],
  },
  {
    id: 'm4',
    type: 'blue',
    title: '2cm',
    label: 'After',
    text: '',
    trapButtonLabel: 'free nudes',
    image: null,
    audio: null,
    position: [14, -2, -24],
  },
  {
    id: 'm5',
    type: 'white',
    title: 'Unsaid',
    label: 'Admiration',
    text: '',
    youtubeId: '4mYvNERphFo',
    youtubeStart: 50,
    image: null,
    audio: null,
    position: [4, 8, -20],
  },
  {
    id: 'm6',
    type: 'white',
    title: 'The Quiet Truth',
    label: 'Fear',
    text: "Now that the walls are down, I feel like I'm standing in the middle of a ring without any gloves on. It's the most terrifying thing I've ever done, but I'd rather be vulnerable with you than safe with anyone else",
    image: null,
    audio: null,
    position: [-12, -1, -26],
  },
  {
    id: 'm7',
    type: 'gold',
    title: 'Nothing',
    label: 'The end',
    text: 'My ideas are finished. Nothing to see here.',
    image: null,
    audio: null,
    position: [6, -6, -14],
  },
  {
    id: 'm8',
    type: 'white',
    title: 'for my nurse',
    label: 'Forward',
    text: "You spend all day in scrubs. I'd love to see how quickly we can get you out of them. 🌶️",
    image: null,
    audio: null,
    position: [-4, 6, -12],
  },
  {
    id: 'final',
    type: 'apology',
    title: 'One Last Star',
    label: 'Far away',
    text: '',
    image: null,
    audio: null,
    position: [32, 6, -40],
    hiddenUntilUnlocked: true,
  },
]

export const memories = memoriesRaw.map((m) => ({
  ...m,
  image: m.image != null ? publicAsset(m.image) : null,
  audio: m.audio != null ? publicAsset(m.audio) : null,
  pianoAudio: m.pianoAudio != null ? publicAsset(m.pianoAudio) : null,
  slideImages: m.slideImages?.map((url) => publicAsset(url)),
}))

export const constellationEdges = [
  ['m1', 'm5'],
  ['m5', 'm2'],
  ['m2', 'm8'],
  ['m8', 'm3'],
  ['m3', 'm7'],
]
