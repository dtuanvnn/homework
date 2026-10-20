import type { ScanResponse } from "@/lib/ai/scan"

/*
 * "Reading Worksheet 3 – A Giant Rat" (Tiếng Anh, lớp 3, one page) as the
 * scanner should return it: one bài holding the instruction, title and three
 * paragraphs, the capybara as the bài figure, five câu with only their own
 * question. Transcribed by hand; no model call.
 */

const question = (prompt: string): ScanResponse["questions"][number] => ({
  type: "tu-luan",
  prompt,
  points: 1,
  skills: ["Đọc hiểu"],
  options: null,
  correctIndexes: null,
  trueFalseAnswer: null,
  answers: null,
  answer: null,
  pairs: null,
  tokens: null,
  rubric: null,
  math: null,
  simplest: null,
  figure: null,
  solution: null,
  confidence: 0.92,
  page: 1,
  note: null,
  groupKey: "rat",
})

export const GIANT_RAT_BOX = [700, 230, 960, 380]

export const giantRatScan: ScanResponse = {
  title: "Reading Worksheet 3 – A Giant Rat",
  topic: "Đọc hiểu tiếng Anh – A Giant Rat",
  description: "Đọc đoạn văn về chuột lang nước và trả lời câu hỏi bằng câu đầy đủ.",
  difficulty: 3,
  estimatedMinutes: 20,
  groups: [
    {
      key: "rat",
      label: "",
      layout: "doan-van",
      prompt: [
        "**Read the text, then answer the questions in FULL sentences.**",
        "# A Giant Rat",
        "Rats and mice are well-known rodents. They are small animals with long tails. One rodent, however, is not small and has no tail. It can weigh up to 65 kilograms and grow to be one meter long. It is the capybara, the world's biggest rodent.",
        "Like most rodents, the capybara's front teeth never stop growing. The capybara makes them shorter by eating hard plants, but hard plants are hard to digest. So the capybara digests its food twice. How? By eating its poop. This way, the capybara gets more out of its food.",
        "The capybara lives near fresh water and loves swimming. It has webbed toes to swim around in water. Its eyes and ears are high on its head, so they can stay above water. This way, the capybara can watch for predators even in water.",
      ].join("\n"),
      box: GIANT_RAT_BOX,
      continues: false,
      midParagraph: false,
    },
  ],
  questions: [
    question("How do capybaras look different from rats and mice?"),
    question("What is the same thing between capybaras and most rodents?"),
    { ...question("How does a capybara keep its teeth short?"), figure: { box: GIANT_RAT_BOX } },
    question("How does a capybara digest the food a second time?"),
    question("Why are a capybara's eyes and ears high on its head?"),
  ],
}
