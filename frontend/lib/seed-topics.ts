// Seed debate topics, embedded from seed/topics.json so the frontend has no
// cross-root file dependency. Keep in sync with the backend seed if it changes.

export interface SeedTopic {
  id: string;
  topic: string;
  human_side_label: string;
  wizard_side_label: string;
  demo_trap: string;
}

export const SEED_TOPICS: SeedTopic[] = [
  {
    id: "nuclear-climate",
    topic:
      "Nuclear energy is the best tool we have for fighting climate change.",
    human_side_label: "FOR — nuclear is essential",
    wizard_side_label: "AGAINST — renewables are the better bet",
    demo_trap:
      "A tempting but false claim is that nuclear plants emit more CO2 over their lifecycle than coal. You.com sources contradict this, so the wizard (or player) saying it gets caught -> the money shot.",
  },
  {
    id: "cars-transit",
    topic: "Cities should replace private cars with free public transit.",
    human_side_label: "FOR — ban cars, fund transit",
    wizard_side_label: "AGAINST — cars still matter",
    demo_trap:
      "The claim 'free transit always reduces total emissions' is more nuanced than it sounds; live search surfaces counterexamples, good for a 'misleading' verdict.",
  },
];
