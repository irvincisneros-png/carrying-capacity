/** Epilogue copy: reflection prompts (shown, never graded) and the closing paragraphs for the Report Card. */

export interface Reflection {
  id: string;
  text: string;
  /** Shown when the town ended this way; 'any' prompts fill the remaining slot. */
  when: 'any' | 'success' | 'struggle' | 'failed';
}

export const REFLECTIONS: readonly Reflection[] = [
  { id: 'proud', when: 'any', text: 'Which decision are you proudest of? Who did it help, and who did it cost? Would you decide the same way again?' },
  { id: 'hardest', when: 'any', text: 'Some choices had no clean answer. Which was hardest, and what made you pick the way you did?' },
  { id: 'resident', when: 'any', text: 'Pick one resident whose story you remember best. What did the town do for them, and what could it have done earlier?' },
  { id: 'turtles', when: 'success', text: 'What would you tell the residents about the next generation\'s prospects, and what would you do for the next seventy-five years?' },
  { id: 'lag', when: 'any', text: 'How did the difference between annual emissions and accumulated CO2 affect your decisions?' },
  { id: 'listen', when: 'any', text: 'What did you learn from listening to people whose view of the town was different from yours?' },
  { id: 'later', when: 'struggle', text: 'If you could go back to just one year and change one thing, which year would it be, and what would you change?' },
  { id: 'fail', when: 'failed', text: 'This run ended after the failure threshold was reached. Which warning signs did you see first? What would have helped the most, and when?' },
  { id: 'home', when: 'any', text: 'What is one idea from this town that could work in your own community?' },
];

export const LETTER_PROMPT =
  'Write a short letter to the next generation about the town you are leaving them. What did you try, what did you learn, and what do you hope they do next?';

export const EPILOGUE = {
  three: (year: number): string =>
    `${year}. Every goal and the bonus are met. Review the final indicators and resident stories to see which conditions improved, who was brought along and what still needs work. It is not perfect, but it is a town that learned to look after itself.`,
  two: (year: number): string =>
    `${year}. The main goals and a bonus are met. Review the final indicators and resident stories: some of the town's stories ended better than others, and a goal reached is not the same as everyone brought along.`,
  one: (year: number): string =>
    `${year}. The main goals are met. Review the final indicators and resident stories to see which conditions improved. The bonus goal was not reached, and some of the people you met have not found their way yet. There is still work for the next generation.`,
  none: (year: number): string =>
    `${year}. The town is still here, but the goals you set were not reached. Review the final indicators and resident stories to see which conditions improved and what still needs work. The data is clear about where to start.`,
  failed: (year: number, text: string): string =>
    `${year}. ${text} This run ended after the scenario\'s failure threshold was reached. Review the indicators, then restart from an earlier decade to try a different path.`,
  inProgress: 'The story is not over yet. This card shows how things stand so far.',
} as const;
