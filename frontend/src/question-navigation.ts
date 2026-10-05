import type { Question } from "@/src/api";

let pendingQuestion: Question | null = null;

export const selectSwipeQuestion = (question: Question) => { pendingQuestion = question; };
export const takeSwipeQuestion = () => {
  const question = pendingQuestion;
  pendingQuestion = null;
  return question;
};