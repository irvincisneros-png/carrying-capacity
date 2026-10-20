/**
 * Green Valley dilemma cards (the tutorial): three, each with one evidence-backed option. Plain and kind.
 */
import type { DilemmaDef } from '../../sim/dilemmas';

export const GREEN_VALLEY_DILEMMAS: readonly DilemmaDef[] = [
  {
    id: 'gv-factory-waste',
    title: 'Where does the factory waste go?',
    phase: 'act1',
    years: [1980, 2010],
    speaker: 'jo-marsh',
    setup: 'The factory makes jobs, and also muddy waste. Right now it trickles into the creek. Jo\'s orchard is downstream and she has noticed the water looks odd. A settling pit would catch the worst of it, but it costs money and space.',
    options: [
      {
        id: 'creek', label: 'Let it run into the creek for now',
        outcome: 'The factory stays cheap and busy. Downstream, the creek turns a murky brown after rain, and Jo frowns at her irrigation pipes.',
        effects: { budget: 10, incomePerYear: 1, mood: { 'jo-marsh': -6 }, tiles: [{ op: 'water', scope: 'river', add: 0.08 }] },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'Cheaper to run, so more money for the town' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'Dirty water reaches her orchard' }, { type: 'planet', id: 'planet', why: 'Waste builds up in the creek' }],
        },
      },
      {
        id: 'pit', label: 'Dig a settling pit for the waste',
        outcome: 'Workers dig a lined pit by the factory. Heavy waste sinks to the bottom and cleaner water flows on. Jo walks the creek and gives a thumbs up.',
        effects: { budget: -14, society: 1, mood: { 'jo-marsh': 6 }, tiles: [{ op: 'water', scope: 'river', mult: 0.85 }] },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'Cleaner water for her trees' }, { type: 'planet', id: 'planet', why: 'Less waste reaches the creek' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'The pit costs money to build and empty' }],
        },
      },
    ],
    evidence: 'Settling ponds work because heavy particles sink when water moves slowly. They catch many solids and some metals, but not everything dissolved. The waste in the pit still has to be stored safely, because it can leak or wash out later. Cleaning waste at the source is usually cheaper than cleaning a river afterwards.',
  },
  {
    id: 'gv-solar-site',
    title: 'Where do the solar panels go?',
    phase: 'act2',
    years: [2025, 2035],
    speaker: 'ali-rahman',
    setup: 'The valley needs more solar power. Jo has offered her top paddock, which is flat and sunny. Ali points to the old landfill instead: it is already cleared, and nobody can grow food there. Rooftops are a third choice, though small.',
    options: [
      {
        id: 'paddock', label: 'Put the panels on Jo\'s top paddock',
        outcome: 'The paddock is fast to build on, and the power flows. Jo loses her spring grazing, and the sheep look rather confused.',
        effects: { budget: -10, incomePerYear: 1, mood: { 'jo-marsh': -3, 'ali-rahman': -2 } },
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'Fast, cheap clean power' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'She loses good farm land' }],
        },
      },
      {
        id: 'landfill', label: 'Put the panels on the old landfill',
        outcome: 'The old landfill gets a second life. The rubbish is capped and panels go on top, while the farmland stays green. It takes a bit more care to build.',
        effects: { budget: -16, society: 1, mood: { 'jo-marsh': 4, 'ali-rahman': 5 }, flags: { 'circular.landfillSolar': 1 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'Her paddock stays for the farm' }, { type: 'planet', id: 'planet', why: 'Clean power without clearing new ground' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'Building on a capped landfill costs more' }],
        },
      },
      {
        id: 'roofs', label: 'Only use rooftops for now',
        outcome: 'Cottage roofs fill with panels, one by one. Nobody loses any land, but the valley is still waiting on its big share of clean power.',
        effects: { budget: -6, mood: { 'ali-rahman': -1 } },
        preview: {
          helps: [{ type: 'town', id: 'town', why: 'Households save on power bills' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Slower cut in coal power' }],
        },
      },
    ],
    evidence: 'Compare roofs and already-disturbed land before clearing habitat. A capped landfill may suit solar if engineers check settlement, drainage, gas systems and the cap. Rooftop solar helps but is usually too small to meet all demand.',
  },
  {
    id: 'gv-dam-or-wetland',
    title: 'A farm dam or a frog wetland?',
    phase: 'act2',
    years: [2030, 2040],
    speaker: 'ali-rahman',
    setup: 'There is a low, boggy patch beside the creek. Jo wants a deep dam to store water for the dry months. Ali wants a shallow wetland, which cleans the runoff and could bring the green and golden bell frog home. Money is limited.',
    options: [
      {
        id: 'dam', label: 'Build a deep farm dam',
        outcome: 'The dam fills with the next rain and Jo breathes out. The edges are steep and bare, though, and the frogs have nowhere shallow to lay their eggs.',
        effects: { budget: -14, mood: { 'jo-marsh': 6, 'ali-rahman': -3 } },
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'Stored water for the dry months' }],
          hurts: [{ type: 'creature', id: 'frogs', why: 'No shallow, sunny pools to breed in' }],
        },
      },
      {
        id: 'wetland', label: 'Build a shallow stormwater wetland',
        outcome: 'Reeds go in and the water spreads out shallow and slow. Runoff comes out cleaner, and within a season something croaks in the dusk. Jo still wants a little extra water for the trees.',
        effects: { budget: -12, society: 1, mood: { 'ali-rahman': 7, 'jo-marsh': -2 }, tiles: [{ op: 'water', scope: 'river', mult: 0.9 }] },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'creature', id: 'frogs', why: 'Shallow, sunny ponds to breed in' }, { type: 'planet', id: 'planet', why: 'Reeds filter dirt from runoff' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'Less stored water for the farm' }],
        },
      },
    ],
    evidence: 'Constructed wetlands slow runoff so sediment settles, and reeds take up nutrients such as nitrogen. The green and golden bell frog breeds in shallow, still, sunny water and has been lost from much of its old range, partly through wetland drainage and a fungal disease. A wetland helps, but cannot promise frogs will arrive.',
  },
];
