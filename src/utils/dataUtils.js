import allData from '../data.json';

// --- FUZZY NAME NORMALIZER ---
export const ALIASES = {
  // Historical CSV normalizations
  "Rahul Panchmukhi Paratha": "Punchmukhi Paratha",
  "SIMRAN SWEETS": "Simran Restaurant",
  "Parvez Bhiya Kalp": "Kalp",
  "M/S HOTEL AMORA": "Hotel Amora",
  "Chandu Chai And Cafe": "Chandu Chai",
  "Monu M@ggi": "Monu Maggie",
  "Maggie Center": "Monu Maggie",
  "Maggie Centre": "Monu Maggie",
  "Maggi Center": "Monu Maggie",
  "Maggi Centre": "Monu Maggie",
  "Maa Patal Bhairvi Hotel": "Maa Patal Bhairvi",
  "SHRI JALARAM FASTFOOD": "Jalaram Namkeen",
  "Route 66 Cafe Pendri": "Route 66",
  "Moti Sweets G-E Road": "Moti sweets GE Road",
  "Rasoi Resturant": "Rasoi Restaurant",
  "Bombay Misal Vada Pav": "Bombay Misal Pav",
  "Starlite Cafe": "Starlight Cafe",
  "Prateek Shadi Order Gas": "Prateek Shadi",
  "Bajrang Tadka Point": "Bajrang Tadka",
  "Paanj Tara Restuarant": "Paanj Tara",
  "A King's Food Hub": "A king's food hub",
  "Ravi Bhiya Chai": "Ravi Bhaiya",
  "Tum Main Or Coffee": "Tum Mai Or Coffee",
  "Singh's Restaurant 1": "Singh's Restaurant",
  "Amrit The Cafe": "Amrit the Cafe",
  "Herbal Tea Bhadoriya Chowk": "Herbal Tea",
  "Dudh Sagar": "Doodh Sagar",
  "Mangaura": "Magnaura",
  "Shivam": "Suryakant Sahu",

  // Samrat Bakery
  "Samrat Bamery": "Samrat Bakery",
  "Samrat Bakrry": "Samrat Bakery",
  "Samrat bakery -": "Samrat Bakery",
  "Samrat  Bakery": "Samrat Bakery",
  "Samrat bakery": "Samrat Bakery",
  // Namaskaram
  "Namaksaram": "Namaskaram",
  "Namaskarm": "Namaskaram",
  "Namaskaram-": "Namaskaram",
  // Sabor Cafe
  "Sabkr cafe": "Sabor Cafe",
  "Sabkr Cafe": "Sabor Cafe",
  "Sabor cafe": "Sabor Cafe",
  "Sabor": "Sabor Cafe",
  // Bawarchi
  "Bawarchii dhaba": "Bawarchi Dhaba",
  "Bawarchii Dhaba": "Bawarchi Dhaba",
  "Bawarchi dhaba": "Bawarchi Dhaba",
  // Punchmukhi
  "Panchmukhi Paratha": "Punchmukhi Paratha",
  "Punchmukhki Parartha": "Punchmukhi Paratha",
  "Punchmukhi  paratha": "Punchmukhi Paratha",
  "Panchmukhi": "Punchmukhi Paratha",
  "Punchmukhi": "Punchmukhi Paratha",
  "Punchmukhi paratha": "Punchmukhi Paratha",
  "Punchmukhi center": "Punchmukhi Paratha",
  // Rajwada
  "Rahwada Restaurant": "Rajwada Restaurant",
  "Rajwada": "Rajwada Restaurant",
  "Rajwada  restaurant": "Rajwada Restaurant",
  "Rajwada restaurant": "Rajwada Restaurant",
  // Rasoi
  "Rasoi Resturant": "Rasoi Restaurant",
  "Rasoi": "Rasoi Restaurant",
  "Rasoi restaurant": "Rasoi Restaurant",
  // Hotel Swagatam
  "Hotel Swagatm": "Hotel Swagatam",
  "Hotel swagatam-": "Hotel Swagatam",
  "Hotel swagatam": "Hotel Swagatam",
  // Amrit Veg Dhaba
  "Amri Veg Dhaba": "Amrit Veg Dhaba",
  "amrit veg dhaba dhaba": "Amrit Veg Dhaba",
  "Amrit dhaba": "Amrit Veg Dhaba",
  "Amrit veg dhaba": "Amrit Veg Dhaba",
  "amrit veg": "Amrit Veg Dhaba",
  "Amrit pure veg": "Amrit Veg Dhaba",
  "Amrit pure Veg": "Amrit Veg Dhaba",
  // Amrit the Cafe
  "Amrit cafe": "Amrit the Cafe",
  // Moti Sweets Market
  "Moto Sweets Market": "Moti Sweets Market",
  "Moto Sweets1 Market": "Moti Sweets Market",
  "Moti sweets market": "Moti Sweets Market",
  "Moti sweet market": "Moti Sweets Market",
  // Moti Sweets GE Road
  "Moti sweets g e road": "Moti sweets GE Road",
  "Moti sweets ge road": "Moti sweets GE Road",
  "Moti sweets Ge road": "Moti sweets GE Road",
  "Moti sweets GE road": "Moti sweets GE Road",
  // One Bite
  "Onebite": "One Bite",
  "One bite": "One Bite",
  // Singhs
  "Singhs Restaurant": "Singh's Restaurant",
  // Starlight
  "Star Light": "Starlight Cafe",
  "Starlight cafe": "Starlight Cafe",
  "Star light : 13-08": "Starlight Cafe",
  // SSD
  "Ssd Cafe": "SSD Cafe",
  "Ssd cafe": "SSD Cafe",
  // Tum Mai
  "Tum Mai Aur Coffee": "Tum Mai Or Coffee",
  "Tum mai or coffee": "Tum Mai Or Coffee",
  // Hydrabadi
  "Hydrabadi Hotel": "Hydrabadi Biryani",
  "Hydrabadi biryani": "Hydrabadi Biryani",
  // Mini Punjab
  "Mini Punjab": "Mini Punjab Dhaba",
  "Mini punjab dhaba": "Mini Punjab Dhaba",
  // Amritsari
  "Amritsari Punjabi Dhaba": "Amritsari Dhaba",
  "Amritsari Punjabi": "Amritsari Dhaba",
  "Amritsari dhaba": "Amritsari Dhaba",
  // Namak
  "Namak Cafe Pendri": "Namak Cafe",
  "Namak cafe pendri": "Namak Cafe",
  "Namak cafe-": "Namak Cafe",
  "Namak cafe": "Namak Cafe",
  // Bajrang
  "Bajrang hotel": "Bajrang Hotel",
  "Bajrang": "Bajrang Hotel",
  "Bajrang tadka": "Bajrang Tadka",
  // Khalsa
  "Khalaa hotel": "Khalsa Hotel",
  "Khalsa": "Khalsa Hotel",
  "Khalsa hotel-": "Khalsa Hotel",
  "Khalsa gurudwara": "Khalsa Hotel",
  "Khalsa hotel": "Khalsa Hotel",
  // Hotel Arena
  "Arena": "Hotel Arena",
  "Hotel arena -": "Hotel Arena",
  "Hotel arena": "Hotel Arena",
  // Sher-e-punjab
  "Sher e punjab": "Sher-e-punjab",
  "Sher -e-punjab": "Sher-e-punjab",
  "Sher-e-Punjab": "Sher-e-punjab",
  "Sher-e-punjab": "Sher-e-punjab",
  // Paanj Tara
  "Paanj tara": "Paanj Tara",
  // Manav Mandir
  "Manav Mandir-": "Manav Mandir",
  "Manav mandir": "Manav Mandir",
  // Juice bar
  "The juice bar amd cafe": "The Juice Bar And Cafe",
  "Juice bar and cafe": "The Juice Bar And Cafe",
  "The juice bar": "The Juice Bar And Cafe",
  "Juice Bar & Cafe": "The Juice Bar And Cafe",
  "The juice bar and cafe": "The Juice Bar And Cafe",
  "The Juice bar and cafe": "The Juice Bar And Cafe",
  // Unknown Entries
  "Ni pta": "Unknown",
  "Nhi pata": "Unknown",
  "Pta nhi": "Unknown",
  "From 14": "Unknown",
  "From 14 ": "Unknown",
  "After 34 empty cylinder 30-19 2kg  4": "Unknown",
  "After 34 empty cylinder 30-19 2kg 4": "Unknown",
  // Bhavi
  "Bhavi family dhaba": "Bhavi Family Dhaba",
  "Bhavi": "Bhavi Family Dhaba",
  "Bhavi dhaba": "Bhavi Family Dhaba",
  // Popeye
  "Popeye :": "Popeye",
  // Maa Paital
  "Maa paital": "Maa Patal Bhairvi",
  "Maa Paital bhairavi": "Maa Patal Bhairvi",
  "Maa paital bhairvai": "Maa Patal Bhairvi",
  "Maa paital bhairavi": "Maa Patal Bhairvi",
  "Maa paital bhairvi": "Maa Patal Bhairvi",
  // Bombay Misal
  "Bombay missal pav": "Bombay Misal Pav",
  "Bombay misal pav": "Bombay Misal Pav",
  // Suryakant sahu
  "Sahu hotel": "Sahu Hotel",
  "Suryakant sahu": "Suryakant Sahu",
  // Joshi
  "Joshi amritulya": "Joshi Amritulaya",
  "Joshi amritulaya": "Joshi Amritulaya",
  // Shri Venkatesh
  "Shri venkatesh": "Shri Venkatesh Fast Food",
  "Shri venkatesh fast food": "Shri Venkatesh Fast Food",
  // District court
  "Distirct court": "District Court",
  "District court": "District Court",
  // Krishna
  "Krishna cafe": "Krishna Cafe And Hotel",
  // Apna ghar
  "Apna ghr": "Apna Ghar Manki",
  "Apna ghar": "Apna Ghar Manki",
  // Ashwini
  "Ashwini amritulaya-": "Ashwini Amritulaya",
  "Ashwini": "Ashwini Amritulaya",
  // Ravi
  "Ravi bhiya": "Ravi Bhaiya",
  // King's
  "King's food hub": "A king's food hub",
  // Grill inn
  "Grill in": "Gril Inn",
  "Grill inn": "Gril Inn",
  // Simran
  "Simran restaurant -; 1  14": "Simran Restaurant",
  "Simran restaurant -; 1 14": "Simran Restaurant",
  "Simran": "Simran Restaurant",
  "Simran hotel": "Simran Restaurant",
  "Simran restaurant": "Simran Restaurant",
  // Route 66
  "Route-66": "Route 66",
  "Route": "Route 66",
  // Yummy
  "Yummy tummyy": "Yummy Tummy",
  "Yummy tummy": "Yummy Tummy",
  // Zig zag
  "Zig-zag": "Zig Zag",
  "Zig zag": "Zig Zag",
  // Gwalior
  "Gwalior chat corner": "Gwalior Chaat Corner",
  // Coffee Toffee
  "Coffe toffee": "Coffee Toffee",
  "Coffee toffee": "Coffee Toffee"
};

export const VALID_RESTAURANTS = [
  "A king's food hub",
  "Amrit the Cafe",
  "Amrit Veg Dhaba",
  "Amritsari Dhaba",
  "Annapurna Dairy",
  "Apna Ghar Manki",
  "Ashwini Amritulaya",
  "Bajrang Hotel",
  "Bajrang Tadka",
  "Bawarchi Dhaba",
  "Bhavi Family Dhaba",
  "Bombay Misal Pav",
  "Chandu Chai",
  "Coffee Rhythm",
  "Coffee Toffee",
  "District Court",
  "Doodh Sagar",
  "Embassy",
  "Gagan Engineering",
  "Gril Inn",
  "Gwalior Chaat Corner",
  "Herbal Tea",
  "Highway Dhaba",
  "Hotel Arena",
  "Hotel Ark",
  "Hotel Railies",
  "Hotel Swagatam",
  "Hydrabadi Biryani",
  "Jalaram Cafe",
  "Joshi Amritulaya",
  "Khalsa Hotel",
  "Khandelwal Hotel",
  "Krishna Cafe And Hotel",
  "Hotel Amora",
  "Maa Patal Bhairvi",
  "Manav Mandir",
  "Magnaura",
  "Mini Punjab Dhaba",
  "Mitra Da Dhaba",
  "Monu Maggie",
  "Moti sweets GE Road",
  "Moti Sweets Market",
  "Namak Cafe",
  "Namaskaram",
  "One Bite",
  "Paanj Tara",
  "Kalp",
  "Pizza Gold",
  "Popeye",
  "Prateek Shadi",
  "Punchmukhi Paratha",
  "Raj Imperial",
  "Rajwada Restaurant",
  "Rajawada Restaurant Dhara",
  "Rasoi Restaurant",
  "Ravi Bhaiya",
  "Route 66",
  "Sabor Cafe",
  "Sahu Hotel",
  "Suryakant Sahu",
  "Samrat Bakery",
  "Sharma Bakery",
  "Sher-e-punjab",
  "Gurudev Rice Mill",
  "Jalaram Namkeen",
  "Shri Venkatesh Fast Food",
  "Shivam",
  "Silver Spoon",
  "Simran Restaurant",
  "Singh's Restaurant",
  "South Express",
  "Spice Delight",
  "SSD Cafe",
  "Starlight Cafe",
  "The Juice Bar And Cafe",
  "Tum Mai Or Coffee",
  "Unknown",
  "Vijay Laxmi Project",
  "Yummy Tummy",
  "Zig Zag"
];


export function norm(n) {
  if (!n) return "Unknown";
  let name = n.trim();
  // Attempt to match lowercase as well to avoid large alias maps
  for (let key in ALIASES) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return ALIASES[key];
    }
  }
  // Title case for general normalization if no alias matched
  return name.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

// --- COMPUTE STATS ---
export function computeAll(batches) {
  const restMap = {};
  const dateMap = {};
  const batchStats = [];

  batches.forEach(b => {
    let b21 = 0, b192 = 0, bEmpty = 0, bEmpty21 = 0, bEmpty192 = 0;
    b.entries.forEach((e) => {
      let rawName = e.name;
      // Strip trailing colon or dash
      rawName = rawName.replace(/[:\-]+\s*$/, '');
      const name = norm(rawName);

      if (!restMap[name]) {
        restMap[name] = { 
          "21kg": 0, "19.2kg": 0, 
          "Empty21kg": 0, "Empty19.2kg": 0, "Empty": 0 
        };
      }

      if (e.isReturn) {
        const returnKey = e.type === "21kg" ? "Empty21kg" : "Empty19.2kg";
        restMap[name][returnKey] = (restMap[name][returnKey] || 0) + e.qty;
        restMap[name]["Empty"] = (restMap[name]["Empty"] || 0) + e.qty;
      } else {
        restMap[name][e.type] = (restMap[name][e.type] || 0) + e.qty;
      }

      if (e.date) {
        if (!dateMap[e.date]) {
          dateMap[e.date] = { 
            "21kg": 0, "19.2kg": 0, 
            "Empty21kg": 0, "Empty19.2kg": 0, "Empty": 0, 
            details: [] 
          };
        }
        if (e.isReturn) {
          const returnKey = e.type === "21kg" ? "Empty21kg" : "Empty19.2kg";
          dateMap[e.date][returnKey] = (dateMap[e.date][returnKey] || 0) + e.qty;
          dateMap[e.date]["Empty"] = (dateMap[e.date]["Empty"] || 0) + e.qty;
        } else {
          dateMap[e.date][e.type] = (dateMap[e.date][e.type] || 0) + e.qty;
        }
        dateMap[e.date].details.push({ 
          name, 
          qty: e.qty, 
          type: e.type, 
          isReturn: !!e.isReturn, 
          batch: b.batch, 
          originalEntry: e 
        });
      }

      if (e.isReturn) {
        bEmpty += e.qty;
        if (e.type === "21kg") bEmpty21 += e.qty;
        else if (e.type === "19.2kg") bEmpty192 += e.qty;
      } else {
        if (e.type === "21kg") b21 += e.qty; 
        else if (e.type === "19.2kg") b192 += e.qty;
      }
    });
    batchStats.push({ 
      batch: b.batch, 
      khaliDate: b.khaliDate, 
      note: b.note, 
      count: b.entries.length, 
      kg21: b21, 
      kg192: b192, 
      empty: bEmpty,
      empty21: bEmpty21,
      empty192: bEmpty192
    });
  });

  return { restMap, dateMap, batchStats };
}

export const INITIAL_DATA = allData;
