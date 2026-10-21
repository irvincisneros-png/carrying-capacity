/**
 * "My household" page (WP8d): links the town's choices to the students' own lives in five areas and offers a few
 * things they could try. Short and kind. No one is told they are to blame.
 */
import type { ScenarioId } from '../sim/types';

export interface HouseholdIdea {
  id: string;
  text: string;
}

export interface HouseholdArea {
  id: 'transport' | 'food' | 'energy' | 'water' | 'waste';
  title: string;
  /** What the town did, linked to a number from the game where there is one (the UI fills in {…} from the run). */
  link: string;
  /** Why it matters at home. */
  why: string;
  ideas: readonly HouseholdIdea[];
}

export const HOUSEHOLD_AREAS: readonly HouseholdArea[] = [
  {
    id: 'transport', title: 'Getting around',
    link: 'In your town, commuting and freight added CO₂ every year. A town where homes are near jobs and there is public transport emits less.',
    why: 'Cars and trucks are a big share of what a household adds to the air.',
    ideas: [
      { id: 'tr-walk', text: 'Walk, cycle or scoot for one short trip a week instead of being driven.' },
      { id: 'tr-bus', text: 'Try the bus or train for a trip you normally take by car.' },
      { id: 'tr-share', text: 'Share a lift with a friend on the way to sport or school.' },
    ],
  },
  {
    id: 'food', title: 'Food',
    link: 'Your farmland, fish and bush can only renew so much each year. When the town ate and farmed more than that, the soil and the fish stocks ran down.',
    why: 'Growing and moving food uses land, water and fuel, and wasted food rots into methane.',
    ideas: [
      { id: 'fd-waste', text: 'Plan one meal a week to use up leftovers, and compost the scraps.' },
      { id: 'fd-local', text: 'Pick something in season and local when you can.' },
      { id: 'fd-meatfree', text: 'Try a meat-free dinner once a week.' },
    ],
  },
  {
    id: 'energy', title: 'Power at home',
    link: 'Your town\'s power came from coal and gas at first, then from sun, wind and batteries. Each switch cut the CO₂ added to the air.',
    why: 'Most home electricity in Australia still comes partly from fossil fuels, so saving power cuts emissions.',
    ideas: [
      { id: 'en-off', text: 'Switch off lights, chargers and screens when no one is using them.' },
      { id: 'en-cool', text: 'Use a fan, curtains and shade before the air conditioner.' },
      { id: 'en-talk', text: 'Ask at home whether rooftop solar or a green power plan could suit your family.' },
    ],
  },
  {
    id: 'water', title: 'Water',
    link: 'The creek and rain only refill so much water. When your town took more than that, the creek ran lower, got dirtier and the fish suffered.',
    why: 'Less water taken means more left in rivers for fish and bugs, and less pumping and treating.',
    ideas: [
      { id: 'wa-shower', text: 'Time your shower and try to shave off one minute.' },
      { id: 'wa-tap', text: 'Turn off the tap while you brush your teeth.' },
      { id: 'wa-garden', text: 'Water the garden in the evening, or use a rain tank.' },
    ],
  },
  {
    id: 'waste', title: 'Rubbish and stuff',
    link: 'Rubbish in landfill gives off methane and can leak into the creek. Reusing and recycling keeps materials in use.',
    why: 'Everything we buy used land, water and energy to make, and the cheapest waste to deal with is the waste never made.',
    ideas: [
      { id: 'ws-bottle', text: 'Carry a refillable bottle and a reusable bag.' },
      { id: 'ws-repair', text: 'Repair, swap or buy second-hand before buying new.' },
      { id: 'ws-sort', text: 'Check the recycling bin at home. Is everything in the right bin?' },
    ],
  },
];

export const HOUSEHOLD_INTRO: Record<ScenarioId, string> = {
  'green-valley': 'The valley was small, but its choices were the same ones your own household makes every day.',
  'coal-coast': 'A coal town\'s choices were big, but a town is made of households.',
  'river-town': 'River Town shared a river. Your household shares water, food and power with everyone else too.',
  'reef-island': 'The island\'s reef felt every choice. Your household\'s choices reach the sea too.',
  'red-dirt': 'Red Dirt\'s mine fed the world. Your household uses what places like it dig up.',
  'net-zero-city': 'A city is millions of households. What changes the city is a lot of small changes at once.',
};

export const HOUSEHOLD_NOTE = 'These are ideas, not a test. Pick one or two that suit you and your family.';
