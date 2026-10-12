/* Turns free text (a search query, a Wikibooks page title plus its categories and ingredients)
   into the same controlled tags the bundled recipes carry, so live results and searches
   can be scored by the recommendation engine exactly like bundled recipes. */

const DISH = {
  cake: ['cake', 'gateau', 'sponge', 'torte', 'lamington'],
  brownie: ['brownie', 'blondie'],
  cookie: ['cookie', 'biscuit', 'shortbread', 'macaron', 'biscotti'],
  pie: ['pie'],
  tart: ['tart', 'galette'],
  pastry: ['pastry', 'croissant', 'baklava', 'churro', 'strudel', 'eclair', 'danish', 'cannoli', 'profiterole'],
  pudding: ['pudding', 'trifle', 'rice pudding', 'bread pudding'],
  custard: ['custard', 'flan', 'creme brulee', 'crème brûlée', 'creme caramel', 'crème caramel', 'panna cotta'],
  mousse: ['mousse', 'tiramisu'],
  cheesecake: ['cheesecake'],
  'ice-cream': ['ice cream', 'gelato', 'sorbet', 'semifreddo', 'kulfi'],
  'sweet-bread': ['banana bread', 'cinnamon roll', 'cinnamon bun', 'brioche', 'babka', 'scone', 'muffin', 'sticky bun'],
  doughnut: ['doughnut', 'donut', 'beignet'],
  confection: ['fudge', 'truffle', 'candy', 'toffee', 'brittle', 'gulab jamun', 'mochi', 'daifuku', 'nougat', 'turkish delight', 'barfi'],
  'fruit-dessert': ['crumble', 'cobbler', 'compote', 'poached pear', 'pavlova', 'baked apple', 'fruit salad'],
  'hot-drink': ['hot chocolate', 'hot cocoa', 'cocoa', 'latte', 'chai', 'mulled', 'cappuccino', 'matcha'],
  'cold-drink': ['smoothie', 'lemonade', 'milkshake', 'iced', 'cocktail', 'lassi', 'punch', 'horchata', 'juice'],
  pasta: ['pasta', 'spaghetti', 'lasagn', 'penne', 'fettuccine', 'macaroni', 'gnocchi', 'linguine', 'carbonara', 'bolognese', 'tagliatelle', 'alfredo', 'mac and cheese', 'ravioli'],
  noodles: ['noodle', 'ramen', 'pho', 'pad thai', 'japchae', 'laksa', 'udon', 'soba', 'chow mein', 'lo mein', 'yakisoba'],
  rice: ['rice', 'risotto', 'biryani', 'pilaf', 'paella', 'jollof', 'nasi goreng', 'bibimbap', 'congee', 'pulao', 'jambalaya'],
  pizza: ['pizza', 'calzone'],
  flatbread: ['flatbread', 'naan', 'pita', 'arepa', 'roti', 'chapati', 'paratha'],
  bread: ['bread', 'loaf', 'sourdough', 'baguette', 'focaccia', 'cornbread'],
  dumpling: ['dumpling', 'gyoza', 'jiaozi', 'pierogi', 'momo', 'wonton', 'samosa', 'empanada', 'bao', 'potsticker'],
  sandwich: ['sandwich', 'panini', 'toastie', 'grilled cheese', 'banh mi', 'club'],
  wrap: ['wrap', 'burrito', 'shawarma', 'doner', 'gyro', 'kebab'],
  taco: ['taco', 'enchilada', 'quesadilla', 'tostada', 'fajita'],
  curry: ['curry', 'masala', 'korma', 'vindaloo', 'rendang', 'tagine', 'dal', 'dhal', 'daal', 'saag', 'butter chicken', 'massaman', 'katsu curry'],
  stew: ['stew', 'goulash', 'chili con carne', 'chilli con carne', 'feijoada', 'cassoulet', 'ragout', 'doro wat', 'gumbo', 'bourguignon', 'hotpot', 'hot pot'],
  braise: ['braise', 'adobo', 'coq au vin', 'pot roast', 'short rib', 'osso buco'],
  roast: ['roast', 'roasted chicken', 'roast beef', 'roast lamb'],
  grill: ['grill', 'barbecue', 'bbq', 'jerk', 'ribs', 'skewer', 'satay', 'yakitori', 'tandoori', 'souvlaki', 'al pastor'],
  'stir-fry': ['stir-fry', 'stir fry', 'stir-fried', 'kung pao', 'teriyaki', 'chow'],
  fried: ['fried chicken', 'katsu', 'schnitzel', 'tempura', 'fritter', 'fish and chips', 'tonkatsu', 'karaage', 'falafel', 'croquette'],
  meatball: ['meatball', 'kofta', 'kofte', 'köfte'],
  burger: ['burger', 'slider'],
  soup: ['soup', 'chowder', 'broth', 'bisque', 'gazpacho', 'tom yum', 'minestrone', 'consomme', 'borscht', 'miso soup'],
  salad: ['salad', 'slaw', 'tabbouleh', 'caprese', 'coleslaw'],
  dip: ['dip', 'hummus', 'guacamole', 'salsa', 'tzatziki', 'baba ganoush', 'spread'],
  'egg-dish': ['omelette', 'omelet', 'frittata', 'shakshuka', 'scrambled egg', 'quiche', 'eggs benedict', 'tortilla española', 'spanish tortilla'],
  pancake: ['pancake', 'crepe', 'crêpe', 'waffle', 'blini', 'dosa', 'okonomiyaki'],
  porridge: ['porridge', 'oatmeal', 'polenta', 'grits'],
  casserole: ['casserole', 'moussaka', 'shepherd', 'cottage pie', 'bobotie', 'bake'],
  gratin: ['gratin', 'dauphinoise'],
  'savoury-pie': ['pot pie', 'meat pie', 'pasty', 'cornish', 'spanakopita'],
  'seafood-dish': ['ceviche', 'shrimp', 'prawn', 'salmon', 'fish', 'crab', 'mussel', 'clam', 'squid', 'tuna', 'cod', 'lobster', 'scallop', 'octopus'],
  'vegetable-dish': ['ratatouille', 'roasted vegetables', 'stuffed pepper', 'aubergine', 'eggplant', 'cauliflower', 'brussels']
};

const FLAVORS = {
  chocolate: ['chocolate', 'cocoa', 'cacao', 'brownie', 'ganache', 'mocha', 'fudge'],
  vanilla: ['vanilla'],
  caramel: ['caramel', 'dulce de leche', 'toffee', 'butterscotch'],
  coffee: ['coffee', 'espresso', 'mocha', 'tiramisu'],
  citrus: ['lemon', 'lime', 'orange', 'citrus', 'yuzu', 'grapefruit'],
  berry: ['strawberr', 'raspberr', 'blueberr', 'berry', 'berries', 'cranberr'],
  apple: ['apple'],
  banana: ['banana'],
  tropical: ['mango', 'pineapple', 'passion fruit', 'papaya'],
  'stone-fruit': ['peach', 'plum', 'apricot', 'cherry', 'cherries'],
  nut: ['almond', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'cashew', 'nutty'],
  coconut: ['coconut'],
  honey: ['honey'],
  cinnamon: ['cinnamon'],
  spice: ['spiced', 'cardamom', 'clove', 'nutmeg', 'cumin', 'turmeric', 'garam', 'masala', 'curry', 'allspice', 'saffron'],
  ginger: ['ginger'],
  garlic: ['garlic'],
  onion: ['onion', 'shallot', 'leek'],
  herb: ['basil', 'parsley', 'cilantro', 'coriander', 'thyme', 'rosemary', 'herb', 'dill', 'oregano', 'pesto', 'sage'],
  cheese: ['cheese', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'ricotta', 'gruyere', 'gruyère', 'brie', 'halloumi', 'paneer'],
  creamy: ['cream', 'creamy', 'custard', 'alfredo', 'yogurt', 'mascarpone', 'béchamel', 'bechamel'],
  tomato: ['tomato', 'marinara', 'passata'],
  smoky: ['smok', 'barbecue', 'bbq', 'chipotle', 'paprika', 'charred'],
  spicy: ['spicy', 'chili', 'chilli', 'jalapeno', 'jalapeño', 'sriracha', 'harissa', 'kimchi', 'jerk', 'vindaloo', 'szechuan', 'sichuan', 'gochujang', 'hot sauce', 'cayenne'],
  sour: ['sour', 'vinegar', 'pickle', 'tamarind', 'ceviche'],
  umami: ['soy', 'miso', 'fish sauce', 'mushroom', 'anchovy', 'dashi', 'oyster sauce'],
  'sweet-savoury': ['teriyaki', 'hoisin', 'sweet and sour', 'honey glaze', 'maple', 'glazed'],
  peanut: ['peanut', 'satay'],
  sesame: ['sesame', 'tahini'],
  mint: ['mint'],
  wine: ['wine', 'marsala', 'sherry']
};

const MAINS = {
  chicken: ['chicken', 'poultry'], beef: ['beef', 'steak', 'mince', 'ground beef', 'brisket'], pork: ['pork', 'bacon', 'ham', 'sausage', 'pancetta', 'ribs'],
  lamb: ['lamb', 'mutton'], fish: ['fish', 'salmon', 'cod', 'tuna', 'trout', 'haddock', 'sea bass'], shrimp: ['shrimp', 'prawn'],
  seafood: ['seafood', 'clam', 'mussel', 'crab', 'squid', 'lobster', 'scallop', 'octopus'], egg: ['egg'], tofu: ['tofu', 'tempeh'],
  beans: ['bean', 'black beans', 'kidney', 'edamame'], lentils: ['lentil', 'dal', 'dhal'], chickpeas: ['chickpea', 'hummus', 'falafel', 'chana'],
  rice: ['rice', 'risotto'], noodles: ['noodle', 'ramen', 'pho', 'udon', 'soba'], pasta: ['pasta', 'spaghetti', 'macaroni', 'penne', 'lasagn'],
  potato: ['potato', 'fries', 'chips', 'gnocchi'], flour: ['flour', 'dough', 'batter'], cornmeal: ['cornmeal', 'polenta', 'masa', 'corn'], bread: ['bread', 'bun', 'baguette', 'toast'],
  cheese: ['cheese', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'ricotta', 'paneer'], milk: ['milk'], cream: ['cream'], yogurt: ['yogurt', 'yoghurt'], butter: ['butter'],
  cocoa: ['cocoa', 'chocolate', 'cacao'], sugar: ['sugar', 'syrup', 'honey'], fruit: ['fruit', 'apple', 'banana', 'berry', 'mango', 'lemon', 'orange', 'pear', 'peach'],
  vegetables: ['vegetable', 'pepper', 'courgette', 'zucchini', 'broccoli', 'onion', 'tomato', 'cucumber'], mushroom: ['mushroom'], eggplant: ['eggplant', 'aubergine'],
  spinach: ['spinach', 'greens', 'kale'], cabbage: ['cabbage', 'kimchi', 'sauerkraut', 'slaw'], pumpkin: ['pumpkin', 'squash'], carrot: ['carrot'], nuts: ['almond', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'cashew', 'peanut'], coconut: ['coconut']
};

const CUISINE = {
  american: ['american', 'usa', 'southern', 'new england', 'cajun', 'tex-mex', 'texas'], mexican: ['mexican', 'mexico'], brazilian: ['brazil'], peruvian: ['peru'], argentinian: ['argentin'],
  canadian: ['canad'], caribbean: ['caribbean', 'jamaica', 'cuban'], british: ['british', 'english', 'scottish', 'welsh', 'irish', 'uk'], french: ['french', 'france', 'provenc'],
  italian: ['italian', 'italy', 'sicilian', 'tuscan', 'neapolitan'], spanish: ['spanish', 'spain', 'catalan'], greek: ['greek', 'greece'], german: ['german', 'bavarian'],
  austrian: ['austria', 'vienn'], hungarian: ['hungar'], polish: ['polish', 'poland'], swedish: ['swedish', 'sweden', 'scandinavian', 'nordic'], russian: ['russian', 'ukrain'],
  turkish: ['turkish', 'turkey'], lebanese: ['lebanese', 'lebanon'], 'middle-eastern': ['middle east', 'levant', 'persian', 'iranian', 'israeli', 'syrian', 'arab'],
  moroccan: ['morocc', 'maghreb'], nigerian: ['nigeria', 'west african', 'ghana'], 'south-african': ['south africa', 'cape malay'], ethiopian: ['ethiopia', 'eritrea'],
  indian: ['indian', 'india', 'punjabi', 'bengali', 'south indian', 'goan', 'pakistani', 'sri lanka'], thai: ['thai', 'thailand'], vietnamese: ['vietnam'],
  japanese: ['japanese', 'japan'], chinese: ['chinese', 'china', 'cantonese', 'sichuan', 'szechuan', 'hunan'], korean: ['korea'], indonesian: ['indonesia', 'javanese', 'balinese'],
  malaysian: ['malaysia', 'singapore'], filipino: ['filipino', 'philippine'], australian: ['australia', 'new zealand', 'kiwi']
};

const CATEGORY = {
  dessert: ['dessert', 'sweet', 'pudding', 'cake', 'cookie', 'pie', 'tart', 'ice cream', 'candy', 'confection'],
  baking: ['baking', 'bread', 'pastry', 'bun', 'loaf'],
  main: ['main course', 'main dish', 'dinner', 'entree', 'entrée', 'supper'],
  soup: ['soup', 'chowder', 'broth', 'stew'], salad: ['salad'], side: ['side dish', 'side'], snack: ['snack', 'appetizer', 'appetiser', 'starter', 'finger food', 'street food'],
  breakfast: ['breakfast', 'brunch', 'pancake', 'omelette', 'porridge', 'waffle'], drink: ['drink', 'beverage', 'smoothie', 'cocktail', 'tea', 'coffee', 'hot chocolate', 'juice'], sauce: ['sauce', 'dressing', 'condiment', 'dip', 'chutney']
};

const DISH_CATEGORY = {
  cake: 'dessert', brownie: 'dessert', cookie: 'dessert', pie: 'dessert', tart: 'dessert', pastry: 'dessert', pudding: 'dessert', custard: 'dessert', mousse: 'dessert',
  cheesecake: 'dessert', 'ice-cream': 'dessert', 'sweet-bread': 'baking', doughnut: 'dessert', confection: 'dessert', 'fruit-dessert': 'dessert',
  'hot-drink': 'drink', 'cold-drink': 'drink', pasta: 'main', noodles: 'main', rice: 'main', pizza: 'main', flatbread: 'baking', bread: 'baking', dumpling: 'main',
  sandwich: 'main', wrap: 'main', taco: 'main', curry: 'main', stew: 'main', braise: 'main', roast: 'main', grill: 'main', 'stir-fry': 'main', fried: 'main',
  meatball: 'main', burger: 'main', soup: 'soup', salad: 'salad', dip: 'snack', 'egg-dish': 'breakfast', pancake: 'breakfast', porridge: 'breakfast',
  casserole: 'main', gratin: 'side', 'savoury-pie': 'main', 'seafood-dish': 'main', 'vegetable-dish': 'side'
};

const SAVOURY_DISHES = new Set(['pasta', 'noodles', 'rice', 'pizza', 'flatbread', 'dumpling', 'sandwich', 'wrap', 'taco', 'curry', 'stew', 'braise', 'roast', 'grill', 'stir-fry', 'fried', 'meatball', 'burger', 'soup', 'salad', 'dip', 'egg-dish', 'casserole', 'gratin', 'savoury-pie', 'seafood-dish', 'vegetable-dish']);
const SWEET_ONLY_FLAVORS = new Set(['chocolate', 'vanilla', 'caramel', 'coffee', 'berry', 'apple', 'banana', 'tropical', 'stone-fruit']);

function norm(s) { return ' ' + String(s || '').toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ') + ' '; }

function hits(text, table) {
  const out = [];
  for (const key in table) {
    let best = 0;
    for (const kw of table[key]) {
      const i = text.indexOf(kw);
      if (i >= 0) best = Math.max(best, kw.length);
    }
    if (best) out.push([key, best]);
  }
  return out.sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}

/* title weighs more than body: pass them separately */
export function tagText(title, body) {
  const t = norm(title), b = norm(body);
  const all = t + b;
  const dishT = hits(t, DISH), dishB = hits(b, DISH);
  const dish = dishT[0] || dishB[0] || null;
  let flavors = [...new Set([...hits(t, FLAVORS), ...hits(b, FLAVORS)])];
  if (dish && SAVOURY_DISHES.has(dish)) flavors = flavors.filter((f) => !SWEET_ONLY_FLAVORS.has(f) || t.indexOf(f) >= 0);
  const mains = [...new Set([...hits(t, MAINS), ...hits(b, MAINS)])].slice(0, 6);
  const cuisine = hits(all, CUISINE)[0] || 'international';
  const catHit = hits(t, CATEGORY)[0];
  const category = (dish && DISH_CATEGORY[dish]) || catHit || (flavors.some((f) => SWEET_ONLY_FLAVORS.has(f)) ? 'dessert' : 'main');
  return { dish, flavors: flavors.slice(0, 4), mains, cuisine, category, method: [] };
}

export const STAPLES = new Set(['flour', 'sugar', 'butter', 'egg', 'milk', 'cream', 'bread', 'vegetables', 'onion']);
