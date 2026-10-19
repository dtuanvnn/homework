import { uid } from "./questions"
import type { FlashcardItem } from "./types"

/**
 * Child-friendly English definitions for Oxford Discovery 2 & primary school vocabulary.
 * Each word has multiple alternative English definitions so "Viết lại" (regenerate)
 * always produces a fresh, natural explanation with zero Vietnamese translation.
 */
const OXFORD_DISCOVERY_DEFINITIONS: Record<string, string[]> = {
  habitat: [
    "The natural home of an animal or plant.",
    "A place in nature where an animal or plant lives and grows.",
    "The environment where a living thing finds food, water, and shelter.",
  ],
  desert: [
    "A very dry, sandy place with little rain and few plants.",
    "A hot and dry land that gets almost no rain all year.",
    "A large, dry area of land where camels and cactuses live.",
  ],
  rainforest: [
    "A thick forest with tall trees where it rains a lot.",
    "A warm, thick forest with tall trees and lots of rain.",
    "A tropical forest where many colorful birds, monkeys, and plants live.",
  ],
  burrow: [
    "A hole in the ground that an animal digs to live in.",
    "An underground tunnel dug by a small animal like a rabbit or fox.",
    "A cozy home under the soil where small animals hide and sleep.",
  ],
  nest: [
    "A home that a bird builds out of twigs, grass, and leaves.",
    "A safe place in a tree where birds lay their eggs and raise chicks.",
    "A small bowl-shaped bed made by birds or animals for their babies.",
  ],
  ocean: [
    "A huge body of salty water that covers most of the Earth.",
    "The deep blue sea where whales, dolphins, and fish swim.",
    "A giant area of salt water between the continents.",
  ],
  hive: [
    "A home where bees live together and make honey.",
    "A busy house for a colony of honeybees.",
    "A structure built by bees to store honey and protect their queen.",
  ],
  pond: [
    "A small area of still water where frogs, fish, and ducks live.",
    "A quiet little body of water that is smaller than a lake.",
    "A fresh water spot in a park or field where water lilies grow.",
  ],
  cave: [
    "A large, dark hollow space inside a cliff, hill, or underground.",
    "A natural room inside a rock or mountain where bats and bears rest.",
    "A deep opening in the side of a mountain or under the ground.",
  ],
  web: [
    "A thin net of silk threads spun by a spider to catch insects.",
    "A sticky silk home that a spider weaves between branches.",
    "A delicate pattern of threads made by a spider.",
  ],
  forest: [
    "A large area of land covered with many trees and bushes.",
    "A green woodland where deer, owls, and squirrels live.",
    "A place with lots of tall trees growing close together.",
  ],
  hollow: [
    "An empty space or hole inside the trunk of an old tree.",
    "A cozy hole inside a tree where owls and squirrels make their home.",
    "A natural opening inside a tree trunk that shelters small animals.",
  ],
  woods: [
    "An area of land smaller than a forest that is covered with growing trees.",
    "A quiet place with many trees, shade, and woodland animals.",
  ],
  woodland: [
    "Land covered with trees and shrubs where forest animals live.",
    "A shady area of trees that gives shelter to birds and small mammals.",
  ],
  grassland: [
    "A large open area of country covered with wild grass.",
    "Wide, flat land with tall grass where zebras, lions, and giraffes live.",
  ],
  wetland: [
    "Land consisting of marshes or swamps where the soil is soaked with water.",
    "A wet, muddy habitat where herons, frogs, and turtles live.",
  ],
  shelter: [
    "A safe place that protects animals or people from bad weather and danger.",
    "Something that covers and keeps a living thing warm, dry, and safe.",
  ],
  shell: [
    "A hard outer covering that protects an animal like a snail, turtle, or crab.",
    "A strong case that a sea creature or turtle carries on its back.",
  ],
  den: [
    "A hidden home where a wild mammal like a fox, wolf, or bear lives.",
    "A quiet, safe cave or hole where wild animals sleep and care for their young.",
  ],
  iceberg: [
    "A giant piece of freshwater ice floating in the cold ocean.",
    "A huge mountain of ice that drifts in freezing polar seas.",
  ],
  tundra: [
    "A vast, flat, treeless Arctic region where the ground stays frozen.",
    "A very cold, windy land in the far north where polar animals live.",
  ],
  mammal: [
    "A warm-blooded animal with hair or fur that feeds milk to its babies.",
    "An animal like a dog, whale, or human that has fur and drinks milk when young.",
  ],
  reptile: [
    "A cold-blooded animal with dry, scaly skin like a lizard, snake, or turtle.",
    "An animal covered in scales that lays soft-shelled eggs on land.",
  ],
  amphibian: [
    "A cold-blooded animal like a frog that lives both in water and on land.",
    "An animal with smooth, moist skin that starts life in the water.",
  ],
  feathers: [
    "The soft, light parts that cover a bird's body and help it fly and stay warm.",
    "Colorful coverings on a bird's wings and body.",
  ],
  scales: [
    "Small, thin, hard plates that cover the skin of fish and reptiles.",
    "Shiny little shields that protect the body of a fish or snake.",
  ],
  gills: [
    "The body parts on the sides of a fish that let it breathe underwater.",
    "Special organs that help fish take in oxygen from water.",
  ],
  fur: [
    "The thick, soft hair that grows on the body of many mammals.",
    "A warm coat of hair that keeps animals like bears and cats cozy.",
  ],
  wings: [
    "The parts of a bird, insect, or bat that it moves to fly through the air.",
    "Feathered or thin limbs used by birds and butterflies for flying.",
  ],
}

export const UNIT_3_SAMPLE_WORDS = [
  "habitat",
  "desert",
  "rainforest",
  "burrow",
  "nest",
  "ocean",
  "hive",
  "pond",
  "cave",
  "web",
  "forest",
  "hollow",
]

export interface ParsedWordList {
  words: string[]
  duplicateCount: number
  blankLineCount: number
}

/**
 * Parses a newline-separated (or slash-separated) word list, removing blank lines
 * and case-insensitive duplicates while preserving original casing of first occurrence.
 */
export function parseWordList(rawText: string): ParsedWordList {
  if (!rawText) {
    return { words: [], duplicateCount: 0, blankLineCount: 0 }
  }
  const rawLines = rawText.split(/\r?\n/)
  let blankLineCount = 0
  let duplicateCount = 0
  const seen = new Set<string>()
  const words: string[] = []

  for (const line of rawLines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      blankLineCount += 1
      continue
    }
    // Also support pasting "habitat / desert / rainforest" on a single line
    const segments = trimmedLine.includes("/")
      ? trimmedLine.split("/").map((s) => s.trim()).filter(Boolean)
      : [trimmedLine]

    for (const segment of segments) {
      const normalized = segment.toLowerCase()
      if (seen.has(normalized)) {
        duplicateCount += 1
      } else {
        seen.add(normalized)
        words.push(segment)
      }
    }
  }

  return { words, duplicateCount, blankLineCount }
}

/**
 * Generates a short, child-friendly English definition for a word.
 * `variant` cycles through alternative definitions when "Viết lại" is clicked.
 */
export function generateChildFriendlyDefinition(
  word: string,
  variant = 0,
  topic?: string,
): string {
  const clean = word.trim().toLowerCase()
  const known = OXFORD_DISCOVERY_DEFINITIONS[clean]
  if (known && known.length > 0) {
    return known[variant % known.length]
  }

  const displayWord = clean || "word"
  const contextHint =
    topic && topic.trim()
      ? ` connected to "${topic.trim()}"`
      : " used in everyday English"

  const fallbackTemplates = [
    `An important English word${contextHint} that describes a thing, place, or action in nature and daily life.`,
    `A useful word for young learners to describe something we can see, do, or explore in the world around us.`,
    `A key vocabulary word from the lesson that helps tell a clear story or explain how things work.`,
  ]

  // Pick a deterministic but varied template
  const hash = [...displayWord].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return fallbackTemplates[(hash + variant) % fallbackTemplates.length]
}

export function createFlashcardItem(
  word: string,
  variant = 0,
  topic?: string,
): FlashcardItem {
  return {
    id: uid("fc"),
    word: word.trim(),
    definition: generateChildFriendlyDefinition(word, variant, topic),
  }
}

/**
 * Speaks an English word or phrase using the browser's Web Speech API.
 * Supports custom speech rate (e.g. fast 1.0, slow 0.7, very slow 0.45)
 * and lifecycle callbacks so the active button can pulse while speaking.
 */
export function speakEnglishWord(
  text: string,
  options?: {
    rate?: number
    onStart?: () => void
    onEnd?: () => void
  },
): boolean {
  const rate = options?.rate ?? 0.9
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options?.onStart?.()
    if (typeof window !== "undefined") {
      globalThis.setTimeout(() => options?.onEnd?.(), Math.round(900 / rate))
    }
    return false
  }
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = rate
    const voices = window.speechSynthesis.getVoices()
    const englishVoice =
      voices.find((v) => v.lang === "en-US" || v.lang === "en_US") ??
      voices.find((v) => v.lang.startsWith("en"))
    if (englishVoice) {
      utterance.voice = englishVoice
    }
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      options?.onEnd?.()
    }
    const fallbackDuration = Math.max(700, Math.round(1000 / rate))
    const timer = window.setTimeout(finish, fallbackDuration + 600)
    utterance.onstart = () => options?.onStart?.()
    utterance.onend = () => {
      window.clearTimeout(timer)
      finish()
    }
    utterance.onerror = () => {
      window.clearTimeout(timer)
      finish()
    }
    options?.onStart?.()
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    options?.onEnd?.()
    return false
  }
}
