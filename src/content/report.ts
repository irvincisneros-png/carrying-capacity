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
  { id: 'turtles', when: 'success', text: 'Sam and Jordan asked whether there would still be turtles when they were old. What would you tell them now, and what would you do for the next seventy-five years?' },
  { id: 'lag', when: 'any', text: 'Priya explained that some warming is already committed because the climate lags behind emissions. How did that change when you decided to act?' },
  { id: 'listen', when: 'any', text: 'What did you learn from listening to people whose view of the town was different from yours?' },
  { id: 'later', when: 'struggle', text: 'If you could go back to just one year and change one thing, which year would it be, and what would you change?' },
  { id: 'fail', when: 'failed', text: 'The town could not hold on. Which warning signs did you see first? What would have helped the most, and when?' },
  { id: 'home', when: 'any', text: 'What is one idea from this town that could work in your own community?' },
];

export const LETTER_PROMPT =
  'Write a short letter to Sam and Jordan about the town you are leaving them. What did you try, what did you learn, and what do you hope they do next?';

export const EPILOGUE = {
  three: (year: number): string =>
    `${year}. The sun is low over the estuary, and the whole town is out on the headland. Every one of the people you met has a place here, the animals are back in the places they belong, and the sky over the old works is clear. It is not perfect. It is a town that learned to look after itself.`,
  two: (year: number): string =>
    `${year}. The bush is green, the estuary is clean and the animals are coming home. Some of the town's stories ended better than others, and the people who remember them know that a goal reached is not the same as everyone brought along.`,
  one: (year: number): string =>
    `${year}. The main goals are met: the climate held, the water recovered and the town held together. The bonus animals have not all returned, and some of the people you met have not found their way yet. There is still work for the next generation.`,
  none: (year: number): string =>
    `${year}. The town is still here, but the goals you set were not reached. Warming, the estuary or the old industrial sites still need work. The data is clear about where to start.`,
  failed: (year: number, text: string): string =>
    `${year}. ${text} The town could not hold on. What happened here is a record of what to do differently, and a restart from any decade is waiting.`,
  inProgress: 'The story is not over yet. This card shows how things stand so far.',
} as const;
