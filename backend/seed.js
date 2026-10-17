const mountains = {
  apo: {
    included: ["Roundtrip transportation", "Tourism permit fee", "Environmental fee", "Accredited guide fee", "Climb certificate", "5 hosted meals", "Personalized bag tag"],
    excluded: ["Personal expenses", "Personal travel insurance"]
  },
  pulag: {
    included: ["Van transport", "Registration fee (DENR)", "Climbing certificate", "3 meals (dinner, breakfast, lunch)", "Local tour guide", "Entrance fee", "Environmental and cultural heritage fee", "Personalized bag tag"],
    excluded: ["Personal expenses", "Personal hiking gear rental", "Meals outside the included 3 meals"]
  },
  guiting: {
    included: ["Guide fee", "Porter fee (food and logistics)", "DENR registration fee", "Tourism registration fee", "Climb certificate", "All transportation within Sibuyan", "8 hosted meals", "Food and transportation for guide and porter", "Free homestay"],
    excluded: ["Personal porter", "Ferry fare"]
  },
  batulao: {
    included: ["Trail snacks and electrolyte drink", "Free use of DJI Osmo and Action 4", "Souvenir bag tag", "Roundtrip transfer", "Expert guides", "Registration and environmental fees"],
    excluded: ["Meals", "Shower fee", "Other personal expenses"]
  },
  pico: {
    included: ["Roundtrip van transfer", "Parking fee", "Registration fee", "DENR fee", "Guide fee", "On-board coordinator", "Trail snacks", "Personalized bag tag"],
    excluded: ["Personal expenses", "Meals", "Personal hiking gear"]
  },
  pinatubo: {
    included: ["4x4 ride adventure", "Tourism and environmental fees", "Local tour guide", "Entrance fee", "Capas tourism permit", "Aeta community fee", "Coordinator assistance", "Basic first aid kit", "Free breakfast", "Personalized bag tag", "Climb certificate"],
    excluded: ["Solo drone shots/videos (optional ₱150)", "Lunch (optional ₱250)", "Other personal expenses"]
  },
  sembrano: {
    included: ["Solo and group drone shots", "2 coordinators on board", "High-roof van transfers", "Registration fee", "Environmental fee", "Guide fee", "Personalized bag tag"],
    excluded: ["Meals", "Shower fee", "Other personal expenses"]
  }
};

const hike = (name, tagline, startDate, days, price, difficulty, slots, craterId, trail, details) => ({
  name, tagline, startDate, days, price, difficulty, slots, craterId, trail,
  included: details.included, excluded: details.excluded
});

const hikes = [
  hike("Mt. Guiting Guiting", "Romblon's highest and most feared mountain", "2026-10-23", 3, 5499, 9, 12, 1, "Backtrail", mountains.guiting),
  hike("Mt. Apo", "The highest mountain in the Philippines", "2026-10-18", 3, 6799, 8, 15, 3, "Traverse (Sta Cruz - Bansalan Trail)", {
    included: ["Permit fee", "Environmental fee", "Accredited guide fee", "Climb certificate", "Logistic porter", "5 hosted meals", "Transportation (Davao base)", "Personalized bag tag"],
    excluded: ["Personal expenses", "Travel to Davao", "Accommodation outside the package"]
  }),
  hike("Mt. Apo", "The highest mountain in the Philippines", "2026-10-23", 3, 4999, 8, 15, 2, "Sta Cruz backtrail", {
    included: ["Roundtrip transportation", "Tourism permit fee", "Environmental fee", "Accredited guide fee", "Climb certificate", "5 hosted meals", "Personalized bag tag"],
    excluded: mountains.apo.excluded
  }),
  hike("Mt. Pulag", "The playground of the Gods", "2026-10-21", 2, 3599, 4, 20, 4, "Ambangeg backtrail", mountains.pulag),
  hike("Mt. Pulag", "The playground of the Gods", "2026-11-07", 2, 4499, 4, 20, 5, "Ambangeg backtrail", {
    included: [...mountains.pulag.included, "Drone shot", "DSLR shot"],
    excluded: ["Personal expenses", "Personal hiking gear rental", "Personal travel insurance"]
  }),
  hike("Mt. Batulao", "Rolling slopes with scenic views of Batangas", "2026-10-20", 1, 1299, 4, 25, 1, "New trail", mountains.batulao),
  hike("Mt. Batulao", "The kingdom of sunlit ridges", "2026-10-21", 1, 1499, 4, 25, 2, "Old trail", {
    included: ["High-roof van transfer", "Registration fees", "Environmental fees", "2-3 tour guide fees", "Coordinator fees", "Free bag tag", "Free solo, group, and couple drone shots"],
    excluded: ["Shower fee", "Other personal expenses"]
  }),
  hike("Mt. Pico De Loro", "Highest peak in Cavite", "2026-11-12", 1, 1699, 3, 18, 3, "", mountains.pico),
  hike("Mt. Pinatubo", "Beginner friendly trail within the Beautiful disaster", "2026-12-05", 1, 2499, 3, 24, 1, "", mountains.pinatubo),
  hike("Mt. Pinatubo", "Beginner friendly trail within the Beautiful disaster", "2026-11-29", 1, 2499, 3, 24, 2, "", mountains.pinatubo),
  hike("Mt. Sembrano", "The sentinel of the rising sun", "2026-10-18", 1, 1199, 3, 20, 3, "", mountains.sembrano),
  hike("Mt. Sembrano", "The sentinel of the rising sun", "2026-10-31", 1, 1199, 3, 20, 4, "Barangay Malaya backtrail", mountains.sembrano),
  hike("Mt. Sembrano", "The sentinel of the rising sun", "2026-10-18", 1, 1299, 3, 20, 5, "Traverse", mountains.sembrano)
];

const craterAccounts = [
  { name: "Misty Peak Tours", email: "misty.peak@hikeventures.test", ratingPoints: 47, ratingCount: 10 },
  { name: "Sunrise Summiteers", email: "sunrise.summiteers@hikeventures.test", ratingPoints: 44, ratingCount: 10 },
  { name: "Peak Chasers", email: "peak.chasers@hikeventures.test", ratingPoints: 45, ratingCount: 9 },
  { name: "Tara Akyat PH", email: "tara.akyat@hikeventures.test", ratingPoints: 42, ratingCount: 9 },
  { name: "Summit Squad", email: "summit.squad@hikeventures.test", ratingPoints: 55, ratingCount: 12 }
];

module.exports = { craterAccounts, hikes };
