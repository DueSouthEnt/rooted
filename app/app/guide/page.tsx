import { PageHeader } from "@/components/floral";

const terms = [
  ["Frost date", "The average day a 0°C night arrives or leaves. Not a forecast, and not the same in a hollow as it is against a warm wall."],
  ["RHS hardiness", "A British rating, H1a to H7. Higher numbers survive colder winters. H5 copes with an average UK winter. H3 wants shelter or a lift in autumn."],
  ["USDA zone", "The American hardiness map, kept here because seed packets still print it. It is related to RHS ratings, not identical."],
  ["Hardy annual", "You can sow it in the cold. Autumn sowing — September or October in much of Britain — gives earlier, sturdier plants."],
  ["Half-hardy", "A light frost won't end it. A hard one will. Start it under cover and plant it out around the last frost."],
  ["Tender", "Frost kills it. Zinnias, basil, dahlias. Wait until the soil has actually warmed."],
  ["Direct sow", "Seed goes in the ground where the plant will flower. Larkspur and nigella prefer this and sulk if you move them."],
  ["Under cover", "A cold frame, an unheated greenhouse, or a bright windowsill. Not a propagator's sauna, unless the seed asked for heat."],
  ["Harden off", "A week or ten days of days outside and nights inside, so the plant meets the weather gradually."],
  ["Pinch out", "Snip the growing tip so the plant branches. Do it to cosmos and zinnias. Don't do it to a single-stem sunflower."],
  ["Succession", "Sow again a few weeks later so the flowers don't all arrive on the same Tuesday."],
  ["Tuber, corm, bulb", "Dahlias are tubers. Ranunculus and gladioli are corms. Tulips are bulbs. They are not the same thing in November, when some of them need lifting."],
  ["Vase life", "How long a cut stem usually lasts in clean water. It's a range, and a hot room shortens it."],
];

export default function GuidePage() {
  return (
    <div className="space-y-4">
      <PageHeader bloom="cosmos" kicker="Operations" title="What the words mean" lede="Short versions of the words the rest of the app uses without apology." />
      <p className="text-muted-foreground">Short versions. The beds will teach you the long ones.</p>
      <dl className="space-y-4">
        {terms.map(([term, copy]) => (
          <div key={term} className="rounded-xl border border-border bg-card p-4">
            <dt className="font-medium">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
