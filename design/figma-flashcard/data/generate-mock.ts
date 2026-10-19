import { shuffleIndexes, uid } from "@/lib/questions"
import type { Difficulty, Question, QuestionType, SubjectId } from "@/lib/types"

/** Local demo only: no AI service is connected. */
export default function generateMock(
  subject: SubjectId,
  types: QuestionType[],
  count: number,
  topics: string[],
  difficulty: Difficulty,
  revision: number,
  references: Question[],
): Question[] {
  return Array.from({ length: count }, (_, i): Question => {
    const type = types[i % types.length]
    const base = {
      id: uid("ai"),
      points: 1,
      skills: [topics[i % topics.length]],
    }
    const matches = references.filter((q) => q.type === type)
    if (matches.length) {
      const source = matches[(i + revision) % matches.length]
      return { ...structuredClone(source), id: base.id }
    }
    const a = 6 + ((i + revision) % 4)
    const b = 2 + ((i + revision + difficulty) % 8)
    const answer = String(a * b)
    const math = subject === "toan"
    const english = subject === "tieng-anh"
    const word = english
      ? ["hand", "eye", "head", "leg"][(i + revision) % 4]
      : ["chạy", "đọc", "viết", "hát"][(i + revision) % 4]
    const prompt = math
      ? `Tính ${a} × ${b}.`
      : english
        ? `Viết nghĩa tiếng Việt của từ “${word}”.`
        : `Tìm từ chỉ hoạt động trong câu: “Minh An ${word} cùng bạn.”`
    const result = math
      ? answer
      : english
        ? ({ hand: "bàn tay", eye: "mắt", head: "đầu", leg: "chân" }[word] ??
          "")
        : word
    switch (type) {
      case "trac-nghiem":
        return {
          ...base,
          type,
          prompt,
          options: math
            ? [String(a * b + 1), result, String(a * b - 1), String(a + b)]
            : ["ngôi nhà", result, "màu xanh", "cái bàn"],
          correctIndex: 1,
        }
      case "dung-sai":
        return {
          ...base,
          type,
          prompt: math
            ? `${a} × ${b} = ${answer}.`
            : english
              ? `“${word}” có nghĩa là “${result}”.`
              : `“${word}” là từ chỉ hoạt động.`,
          answer: true,
        }
      case "dien-cho-trong":
        return {
          ...base,
          type,
          prompt: `${prompt} Đáp án: ___`,
          answers: [result],
        }
      case "tra-loi-ngan":
        return { ...base, type, prompt, answer: result }
      case "noi":
        return {
          ...base,
          type,
          prompt: "Nối mỗi mục với đáp án đúng.",
          pairs: math
            ? [
                { left: `${a} × ${b}`, right: answer },
                { left: `${a} × ${b + 1}`, right: String(a * (b + 1)) },
              ]
            : english
              ? [
                  { left: "hand", right: "bàn tay" },
                  { left: "eye", right: "mắt" },
                ]
              : [
                  { left: "chạy", right: "hoạt động" },
                  { left: "cái bàn", right: "sự vật" },
                ],
        }
      case "sap-xep": {
        const tokens = math
          ? [String(a), "×", String(b), "=", answer]
          : english
            ? ["This", "is", "my", word]
            : ["Minh An", word, "cùng", "bạn"]
        return {
          ...base,
          type,
          prompt: "Sắp xếp các thẻ thành câu hoặc phép tính đúng.",
          tokens,
          shuffled: shuffleIndexes(tokens.length),
        }
      }
      case "tu-luan":
        return {
          ...base,
          type,
          prompt: math
            ? `Có ${a} hộp, mỗi hộp có ${b} chiếc bút. Hỏi có tất cả bao nhiêu chiếc bút? Trình bày bài giải.`
            : english
              ? "Viết 3 câu tiếng Anh giới thiệu các bộ phận cơ thể."
              : `Viết 3–5 câu về hoạt động yêu thích, sử dụng từ “${word}”.`,
          rubric: math
            ? `Phép tính ${a} × ${b} = ${answer}; đáp số ${answer} chiếc bút.`
            : "Đúng yêu cầu, dùng từ phù hợp, câu rõ nghĩa và đúng chính tả.",
        }
    }
  })
}
