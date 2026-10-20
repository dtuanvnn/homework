import type { Question } from "../types"

/*
 * "Advanced Worksheet 3 – Life in the Wild" as scanned before bài existed
 * (live draft, read 2026-10-20): every câu repeats its part's instruction.
 */

export const FIG = "sets/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg"

const PART1 = "Replace the bold words using the word in the box (strong, patient, calm, smart, creep, gentle, fierce, hunt, escape, fight):"
const PART3 = "Part 3. Complete the sentences with the correct subject or object pronoun."
const PART4 = "Part 4. Read and write."

const part1 = [
  "Pandas are usually **kind and soft** animals.",
  "Dolphins are **clever** animals that can learn quickly.",
  "A tiger is a **wild and dangerous** animal.",
  "Some animals **look for and catch** other animals for food.",
  "Cats **move slowly and quietly** to catch mice.",
  "Zebras **run away** from lions when they are in danger.",
  "Two male deer may **try to hurt each other** for food.",
  "A crocodile can wait for a long time because it is very **able to wait without getting angry**.",
  "When the zoo keeper comes near, the elephant stays **quiet and relaxed**.",
]

const part3 = [
  "David is very kind to his little sister. ___ always helps ___ with her homework.",
  "My grandparents have a beautiful garden, and ___ often help ___ take care of it.",
  "Lily and Emma are my best friends. ___ sit next to me, and I usually eat lunch with ___.",
  "Jack is looking for his brother because ___ wants to give ___ a present.",
  "My sister and I love our dog. ___ take ___ to the park every afternoon.",
  "Tom has a new computer, but ___ doesn't use ___ very often because he prefers playing outside.",
  "Mr. Brown is our new teacher. ___ always gives ___ interesting activities to do in class.",
  "Ben and his cousins are at the playground. ___ are playing together, and their parents are watching ___.",
  "I have a little sister. ___ loves animals, and I often read stories to ___ before bedtime.",
  "Sophie is talking to her mother because ___ needs ___ to help her with a school project.",
]

const PASSAGE =
  "Complete the text with the words in the box of Part 1 (strong, patient, calm, smart, creep, gentle, fierce, hunt, escape, fight).\n" +
  "Life in the Wild\n" +
  "Animals have many different ways of living and protecting themselves. However, they are usually ___ and do not attack other animals without a reason.\n" +
  "In contrast, some predators can look very ___ when they are ready to attack. Lions, for example, ___ other animals for food."

export const lifeInTheWild: Question[] = [
  ...part1.map((s, i): Question => ({ id: `p1-${i}`, type: "tra-loi-ngan", prompt: `${PART1}\n${s}`, points: 1, skills: [], answer: "", answerStatus: "missing" })),
  { id: "p2", type: "dien-cho-trong", prompt: PASSAGE, points: 9, skills: [], answers: ["", "", ""], answerStatus: "missing" },
  ...part3.map((s, i): Question => ({ id: `p3-${i}`, type: "dien-cho-trong", prompt: `${PART3}\n${s}`, points: 1, skills: [], answers: ["", ""], answerStatus: "missing" })),
  ...["Anna", "Mike", "Lucy", "Tom", "Harry"].map(
    (name, i): Question => ({
      id: `p4-${i}`,
      type: "tu-luan",
      prompt: `${PART4}\nWrite the sentences about ${name} using the table in the picture.\n${name} ___`,
      points: 1,
      skills: [],
      rubric: "",
      image: { path: FIG, width: 600, height: 400 },
    }),
  ),
]
