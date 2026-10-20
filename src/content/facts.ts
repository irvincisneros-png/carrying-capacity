import type { Fact } from '../sim/types';

/** One "Did you know?" fact per decade. `decade` is the decade being completed (e.g. 1850 = the 1850s). */
export const FACTS: readonly Fact[] = [
  { decade: 1850, year: 1859, text: 'In 1859 the physicist John Tyndall showed in his lab that carbon dioxide and water vapour trap heat, while oxygen and nitrogen barely do.' },
  { decade: 1860, year: 1824, text: 'Back in the 1820s Joseph Fourier worked out that Earth would be much colder without its atmosphere. This is the idea behind the natural greenhouse effect.' },
  { decade: 1870, year: 1870, text: 'Coal is made from plants that lived hundreds of millions of years ago. Burning it releases that stored carbon as CO2 in minutes.' },
  { decade: 1880, year: 1882, text: 'In 1882 the Pearl Street Station in New York began supplying electricity to customers. It burned coal.' },
  { decade: 1890, year: 1896, text: 'In 1896 the Swedish chemist Svante Arrhenius calculated by hand how much warming extra CO2 could cause. Modern climate models estimate a smaller number than his, but the idea held up.' },
  { decade: 1900, year: 1908, text: 'The Ford Model T went on sale in 1908. Cheap petrol cars started a century of rising transport emissions.' },
  { decade: 1910, year: 1912, text: 'A 1912 newspaper article in Australia and New Zealand noted that burning coal could warm the planet over time. The idea was already in the news a century ago.' },
  { decade: 1920, year: 1920, text: 'In the 1920s electricity networks spread across industrial countries and coal became the main fuel for power stations.' },
  { decade: 1930, year: 1938, text: 'In 1938 the engineer Guy Callendar gathered temperature records and argued that a rise in CO2 from burning fuel had already warmed the land.' },
  { decade: 1940, year: 1945, text: 'Steel and heavy industry boomed during and after the Second World War. Global fossil fuel use took off from the late 1940s.' },
  { decade: 1950, year: 1958, text: 'In 1958 Charles Keeling began measuring CO2 on Mauna Loa in Hawaii. His "Keeling curve" is the longest direct record of CO2 and shows a steady rise.' },
  { decade: 1960, year: 1960, text: 'From the 1940s to the 1970s global temperatures rose slowly in part because smog particles (aerosols) reflect sunlight and have a cooling effect.' },
  { decade: 1970, year: 1970, text: 'The first Earth Day was held on 22 April 1970, helping launch the modern environmental movement.' },
  { decade: 1980, year: 1988, text: 'The Intergovernmental Panel on Climate Change (IPCC) was set up in 1988 to assess the science of climate change for governments.' },
  { decade: 1990, year: 1997, text: 'In 1997 countries adopted the Kyoto Protocol, the first treaty to set legally binding emissions targets for developed countries.' },
  { decade: 2000, year: 2007, text: 'In 2007 the IPCC shared the Nobel Peace Prize for building and spreading knowledge about human-caused climate change.' },
  { decade: 2010, year: 2015, text: 'In 2015 countries agreed to the Paris Agreement, aiming to hold warming well below 2 degrees C and pursue 1.5 degrees C.' },
  { decade: 2020, year: 2013, text: 'In 2013 the daily CO2 reading at Mauna Loa passed 400 ppm for the first time in human history. Today it is higher than at any time in at least hundreds of thousands of years.' },
];

export function getFactForDecade(decade: number): Fact | null {
  const d = Math.floor(decade / 10) * 10;
  return FACTS.find((f) => f.decade === d) ?? null;
}
