/* Nutrition from the recipe itself. Every ingredient line is read for its quantity and its food, the food is looked
   up in the per-100 g table (data/foods.js) and the totals are divided by the servings. Nothing is typed in by
   hand: change an ingredient and the label changes. Runs in the build (tools/build-data.mjs) for the bundled
   recipes and in the browser for recipes fetched live from the Wikibooks Cookbook.
   The estimate() result lists every nutrient as a number (0 when a dish has none), the serving and net weights,
   the ingredient list in packet order (heaviest first) and which lines could not be read. */
import { FOODS } from '../data/foods.js';

export const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'satfat', 'transfat', 'chol', 'sodium', 'vitd', 'calcium', 'iron', 'potassium'];

/* ---------- which food a line names: first matching rule wins, so the specific come before the general ---------- */
const RULES = [
  /* stock, bones and water */
  [/stock cube|bouillon|stock pot/, 'stock-cube'],
  [/(beef|pork|chicken|lamb|veal|marrow|ham|fish) bones?\b|\bbones\b|carcass|wings and backs|trotters?\b|\bbone\b(?!-in|less| in)/, 'bones'],
  [/chicken (or \w+ )?stock|chicken broth|prawn stock|shellfish stock/, 'chicken-stock'],
  [/beef stock|beef broth|lamb stock|veal stock|brown stock/, 'beef-stock'],
  [/fish stock/, 'fish-stock'],
  [/dashi/, 'dashi'],
  [/vegetable stock|veg stock|\bstock\b|\bbroth\b/, 'vegetable-stock'],
  [/coconut water/, 'coconut-water'],
  [/rose ?water|orange blossom water|orange flower water/, 'rose-water'],
  /* sauces, pastes and condiments before the foods they are made from */
  [/fish sauce|nam pla/, 'fish-sauce'],
  [/oyster sauce/, 'oyster-sauce'],
  [/shrimp paste|belacan|kapi/, 'shrimp-paste'],
  [/dried shrimp/, 'dried-shrimp'],
  [/kecap manis|sweet soy/, 'kecap-manis'],
  [/dark soy/, 'dark-soy'],
  [/soy sauce|shoyu|tamari|light soy/, 'soy-sauce'],
  [/hoisin/, 'hoisin'],
  [/worcestershire/, 'worcestershire'],
  [/ketchup|catsup/, 'ketchup'],
  [/mustard powder|dry mustard|ground mustard/, 'mustard-powder'],
  [/mustard seeds?/, 'mustard-seeds'],
  [/\bmustard\b/, 'mustard'],
  [/mayonnaise|mayo\b|aioli/, 'mayonnaise'],
  [/balsamic/, 'balsamic'],
  [/black vinegar|chinkiang|chinese vinegar/, 'black-vinegar'],
  [/vinegar/, 'vinegar'],
  [/\bmirin\b/, 'mirin'],
  [/\bsake\b/, 'sake'],
  [/shaoxing|rice wine|cooking wine/, 'shaoxing'],
  [/white wine|dry white|vermouth/, 'white-wine'],
  [/red wine|burgundy|chianti/, 'red-wine'],
  [/\b(port|sherry|marsala|madeira|dessert wine)\b/, 'fortified-wine'],
  [/\b(brandy|cognac|rum|whisk(e)?y|bourbon|vodka|gin|tequila|kirsch|grappa|liqueur|cointreau|amaretto|kahl[uú]a|calvados)\b/, 'spirits'],
  [/\b(beer|lager|stout|ale)\b/, 'beer'],
  [/\bcider\b(?! vinegar)/, 'cider'],
  [/curry (paste|leaves)/, (m) => (m.includes('leaves') ? 'curry-leaf' : 'curry-paste')],
  [/massaman|green curry|red curry|yellow curry|panang/, 'curry-paste'],
  [/nam prik|roasted chilli paste|chilli jam/, 'nam-prik-pao'],
  [/gochujang|gochugaru/, 'gochujang'],
  [/red bean paste|anko|sweet bean paste|adzuki/, 'red-bean-paste'],
  [/doubanjiang|chilli bean paste|bean paste|toban/, 'doubanjiang'],
  [/\bmiso\b/, 'miso'],
  [/fermented black beans|black bean sauce|douchi/, 'fermented-black-beans'],
  [/harissa/, 'harissa'],
  [/chipotle/, 'chipotle'],
  [/tamarind/, 'tamarind'],
  [/achiote|annatto/, 'achiote'],
  [/chutney|relish/, 'chutney'],
  [/pesto/, 'pesto'],
  [/sriracha/, 'sriracha'],
  [/sweet chilli sauce/, 'sweet-chilli'],
  [/hot sauce|tabasco|pepper sauce/, 'hot-sauce'],
  [/teriyaki/, 'teriyaki'],
  [/barbecue sauce|bbq sauce/, 'bbq-sauce'],
  [/horseradish/, 'horseradish'],
  [/wasabi/, 'wasabi'],
  [/pickled ginger|gari\b/, 'pickled-ginger'],
  [/pomegranate molasses/, 'pomegranate-molasses'],
  [/\bmolasses|treacle/, 'molasses'],
  [/golden syrup/, 'golden-syrup'],
  [/corn syrup|glucose syrup/, 'corn-syrup'],
  [/maple syrup/, 'maple-syrup'],
  [/\bhoney\b/, 'honey'],
  [/\bjam\b|marmalade|preserves?\b|fruit spread/, 'jam'],
  [/capers?/, 'capers'],
  [/gherkins?|cornichons?|dill pickles?/, 'gherkins'],
  [/kimchi/, 'kimchi'],
  [/sauerkraut/, 'sauerkraut'],
  [/\bolives?\b(?! oil)/, 'olives'],
  [/sun-?dried tomato/, 'sun-dried-tomato'],
  [/tomato (pur[eé]e|paste)|concentrated tomato/, 'tomato-puree'],
  [/passata|tomato sauce|crushed tomatoes|tomato juice/, 'passata'],
  [/tin(ned|s)? .*tomato|canned tomato|chopped tomatoes|plum tomatoes|whole peeled tomatoes/, 'tinned-tomatoes'],
  [/cherry tomato/, 'cherry-tomato'],
  [/tomato/, 'tomato'],
  /* oils and fats */
  [/sesame oil/, 'sesame-oil'],
  [/chilli oil|chili oil|chilli crisp/, 'chilli-oil'],
  [/olive oil/, 'olive-oil'],
  [/peanut oil|groundnut oil/, 'peanut-oil'],
  [/coconut oil/, 'coconut-oil'],
  [/duck fat|goose fat/, 'duck-fat'],
  [/\blard\b|shortening|dripping/, 'lard'],
  [/cooking spray|oil spray/, 'cooking-spray'],
  [/\boil\b/, 'vegetable-oil'],
  [/\bghee\b|clarified butter/, 'ghee'],
  [/peanut butter/, 'peanut-butter'],
  [/butter beans|lima beans/, 'beans-canned'],
  [/unsalted butter/, 'butter-unsalted'],
  [/\bbutter\b/, 'butter'],
  /* dairy and eggs */
  [/cream cheese/, 'cream-cheese'],
  [/sour(ed)? cream/, 'sour-cream'],
  [/cr[eè]me fra[iî]che/, 'creme-fraiche'],
  [/ice cream/, 'ice-cream'],
  [/coconut cream/, 'coconut-cream'],
  [/coconut milk/, 'coconut-milk'],
  [/condensed milk/, 'condensed-milk'],
  [/evaporated milk/, 'evaporated-milk'],
  [/double cream|heavy cream|whipping cream|thickened cream/, 'double-cream'],
  [/single cream|light cream|half and half/, 'single-cream'],
  [/\bcream\b(?! of tartar)/, 'cream'],
  [/buttermilk/, 'buttermilk'],
  [/greek yog(h)?urt|strained yog(h)?urt|labneh/, 'greek-yogurt'],
  [/yog(h)?urt|curd\b/, 'yogurt'],
  [/semi-?skimmed|skimmed milk|low-?fat milk|2% milk/, 'milk-semi'],
  [/\bmilk\b/, 'milk'],
  [/parmesan|parmigiano|pecorino|grana padano/, 'parmesan'],
  [/mozzarella|burrata/, 'mozzarella'],
  [/gruy[eè]re|comt[eé]/, 'gruyere'],
  [/emmental|swiss cheese|jarlsberg/, 'swiss-cheese'],
  [/\bfeta\b/, 'feta'],
  [/mascarpone/, 'mascarpone'],
  [/ricotta|cottage cheese/, 'ricotta'],
  [/paneer/, 'paneer'],
  [/halloumi/, 'halloumi'],
  [/blue cheese|gorgonzola|roquefort|stilton|dolcelatte/, 'blue-cheese'],
  [/goat('s)? cheese|ch[eè]vre/, 'goat-cheese'],
  [/\bbrie\b|camembert/, 'brie'],
  [/cheddar|monterey|jack cheese|gouda|edam|red leicester|provolone|fontina|\bcheese\b/, 'cheddar'],
  [/egg yolks?/, 'egg-yolk'],
  [/egg whites?/, 'egg-white'],
  [/egg noodles?/, 'egg-noodles'],
  [/\beggs?\b/, 'egg'],
  /* meat and fish */
  [/pork (spare ?)?ribs|baby back|spare ?ribs|rib rack/, 'pork-ribs'],
  [/beef short ribs|short ribs/, 'beef-short-rib'],
  [/oxtail/, 'oxtail'],
  [/beef (brisket)|brisket/, 'beef-brisket'],
  [/beef (chuck|stewing|braising|casserole)|chuck steak|stewing steak|braising steak|stewing beef/, 'beef-chuck'],
  [/beef shin|shin of beef|beef shank/, 'beef-shin'],
  [/rib-?eye|rib eye|entrec[oô]te/, 'beef-ribeye'],
  [/beef fillet|fillet steak|tenderloin of beef|beef tenderloin|filet mignon/, 'beef-fillet'],
  [/sirloin|rump|flank|skirt|bavette|flat iron|strip steak|t-bone|porterhouse|beef steak|steaks?\b.*beef|beef.*steaks?/, 'beef-sirloin'],
  [/lean (minced|ground) beef|extra-lean/, 'beef-mince-lean'],
  [/(minced|ground) beef|beef mince/, 'beef-mince'],
  [/\bveal\b/, 'veal'],
  [/\bbeef\b/, 'beef-chuck'],
  [/(minced|ground) pork|pork mince/, 'pork-mince'],
  [/pork belly|belly pork/, 'pork-belly'],
  [/pork (shoulder|butt|collar)|boston butt/, 'pork-shoulder'],
  [/pork tenderloin|pork fillet/, 'pork-tenderloin'],
  [/pork chops?|bone-in pork/, 'pork-chop'],
  [/pork loin|pork steaks?|pork escalopes?|pork cutlets?|pork leg/, 'pork-loin'],
  [/\bbacon\b|pancetta|lardons|speck/, 'bacon'],
  [/prosciutto|parma ham|serrano|jam[oó]n/, 'prosciutto'],
  [/chorizo/, 'chorizo'],
  [/salami|pepperoni/, 'salami'],
  [/sausages?|bratwurst|kielbasa|merguez/, 'sausage'],
  [/\bham\b|gammon/, 'ham'],
  [/\bpork\b/, 'pork-shoulder'],
  [/(minced|ground) lamb|lamb mince/, 'lamb-mince'],
  [/racks? of lamb|lamb racks?|lamb cutlets?|best end/, 'lamb-rack'],
  [/lamb (loin )?chops?/, 'lamb-chop'],
  [/lamb shanks?/, 'lamb-shank'],
  [/leg of lamb|lamb leg/, 'lamb-leg'],
  [/\blamb\b|\bmutton\b/, 'lamb-shoulder'],
  [/\bgoat\b/, 'goat'],
  [/chicken livers?/, 'chicken-liver'],
  [/(minced|ground) chicken|chicken mince/, 'chicken-mince'],
  [/(minced|ground) turkey|turkey mince/, 'turkey-mince'],
  [/\bturkey\b/, 'turkey'],
  [/cooked chicken|leftover chicken|roast(ed)? chicken|rotisserie|shredded chicken/, 'chicken-cooked'],
  [/chicken wings?/, 'chicken-wing'],
  [/chicken breasts?|chicken fillets?|chicken escalopes?|chicken mini/, 'chicken-breast'],
  [/drumsticks?|chicken legs?/, 'chicken-drumstick'],
  [/bone-in.*thigh|thighs?.*bone-in|skin-on.*thigh.*bone|thighs and drumsticks|chicken pieces|chicken portions|jointed chicken/, 'chicken-thigh-bone'],
  [/chicken thighs?/, 'chicken-thigh'],
  [/whole chicken|chicken, about|\bchicken\b.*whole|\bchicken\b/, (m) => (/whole|\babout\b|cut into|jointed|pieces|spatchcock|butterfl/.test(m) ? 'chicken-whole' : 'chicken-thigh')],
  [/duck breasts?/, 'duck-breast'],
  [/\bduck\b/, 'duck-whole'],
  [/smoked salmon|gravlax|lox/, 'smoked-salmon'],
  [/\bsalmon\b|\btrout\b/, 'salmon'],
  [/black cod|sablefish/, 'black-cod'],
  [/\bcod\b|haddock|pollock|hake|coley/, 'cod'],
  [/sea bass|bream|branzino|barramundi|snapper|tilapia|halibut|sole\b|plaice|monkfish|turbot/, (m) => (/whole/.test(m) ? 'whole-fish' : 'sea-bass')],
  [/whole fish/, 'whole-fish'],
  [/tinned tuna|canned tuna|tin of tuna|tuna in/, 'tuna-canned'],
  [/\btuna\b|swordfish/, 'tuna'],
  [/mackerel|herring|kippers?/, 'mackerel'],
  [/sardines?|pilchards?/, 'sardines'],
  [/anchov/, 'anchovy'],
  [/prawns?|shrimps?/, 'prawns'],
  [/squid|calamari|cuttlefish|octopus/, 'squid'],
  [/mussels?/, 'mussels'],
  [/clams?|cockles?/, 'clams'],
  [/scallops?/, 'scallops'],
  [/\bcrab/, 'crab'],
  [/lobster|langoustine|crayfish/, 'lobster'],
  [/white fish|firm fish|fish fillets?/, 'white-fish'],
  /* grains, flours, pasta, bread */
  [/breadcrumbs?|bread crumbs/, (m) => (/panko/.test(m) ? 'panko' : 'breadcrumbs')],
  [/\bpanko\b/, 'panko'],
  [/strong (white )?(bread )?flour|bread flour|'00' flour|00 flour|tipo 00/, 'bread-flour'],
  [/self-?raising|self-?rising/, 'self-raising-flour'],
  [/wholemeal|whole-?wheat flour|rye flour|spelt flour/, 'wholemeal-flour'],
  [/corn ?flour|corn ?starch/, 'cornflour'],
  [/potato (starch|flour)|tapioca (starch|flour)|arrowroot/, 'potato-starch'],
  [/rice flour|glutinous rice flour|mochiko/, 'rice-flour'],
  [/(chickpea|gram|besan) flour|besan/, 'chickpea-flour'],
  [/semolina|fine polenta flour/, 'semolina'],
  [/corn tortillas?/, 'corn-tortilla'],
  [/tortillas?|wraps?\b/, 'tortilla'],
  [/\bpitt?a\b|flatbreads?|naan|chapat(t)?i|roti/, 'pita'],
  [/buns?\b|rolls?\b|brioche|baps?\b|ciabatta/, 'bun'],
  [/sourdough|baguette|french bread/, 'sourdough'],
  [/\bbread\b|\btoast\b|\bloaf\b/, 'bread'],
  [/(plain|all-?purpose|cake|pastry|white) flour|\bflour\b/, 'flour'],
  [/cocoa|cacao powder/, 'cocoa'],
  [/baking powder/, 'baking-powder'],
  [/bicarbonate|baking soda|bicarb/, 'baking-soda'],
  [/fresh yeast/, 'fresh-yeast'],
  [/\byeast\b/, 'yeast'],
  [/gelatin|gelatine|agar/, 'gelatin'],
  [/cream of tartar/, 'cream-of-tartar'],
  [/cooked (and chilled )?(long-grain |jasmine |basmati |white |brown |day-old )?rice|leftover rice|cold rice|day-old rice/, 'cooked-rice'],
  [/rice noodles?|vermicelli|rice sticks?|pad thai noodles|pho noodles/, 'rice-noodles'],
  [/glass noodles|dangmyeon|sweet potato noodles|cellophane|bean thread/, 'glass-noodles'],
  [/\bsoba\b/, 'soba'],
  [/fresh (ramen|udon|egg|chinese|wheat|wonton|hokkien|lo mein)? ?noodles|udon|fresh ramen|cooked noodles|hokkien/, 'fresh-noodles'],
  [/(ramen|wheat|chinese|dan dan|lo mein|chow mein|somen|wonton|dried) noodles|\bnoodles\b/, 'wheat-noodles'],
  [/fresh (pasta|lasagne|tagliatelle|pappardelle|ravioli|tortellini|gnocchi)|gnocchi|tortellini|ravioli/, 'fresh-pasta'],
  [/lasagne|lasagna|spaghetti|linguine|fettuccine|tagliatelle|pappardelle|penne|rigatoni|macaroni|orzo|fusilli|farfalle|conchiglie|bucatini|tagliolini|cannelloni|\bpasta\b|ziti|orecchiette|cavatappi|shells\b/, 'pasta'],
  [/couscous/, 'couscous'],
  [/bulgur|burghul|cracked wheat|freekeh/, 'bulgur'],
  [/quinoa/, 'quinoa'],
  [/polenta|cornmeal|grits|masa harina/, 'polenta'],
  [/rolled oats|porridge oats|\boats\b|oatmeal/, 'oats'],
  [/cornflakes|corn flakes|rice krispies|puffed rice|cereal/, 'cornflakes'],
  [/arborio|carnaroli|risotto rice|paella rice|bomba|calasparra/, 'risotto-rice'],
  [/sushi rice|short-?grain|japanese rice|koshihikari|calrose/, 'short-grain-rice'],
  [/brown rice|wild rice/, 'brown-rice'],
  [/glutinous rice|sticky rice|sweet rice/, 'glutinous-rice'],
  [/\brice\b/, 'rice'],
  [/puff pastry/, 'puff-pastry'],
  [/shortcrust|pie crust|pastry case|pastry/, 'shortcrust'],
  [/\bfilo\b|phyllo/, 'filo'],
  [/wrappers?|gyoza skins|wonton skins|dumpling skins/, 'wrappers'],
  [/pizza (dough|base)/, 'pizza-base'],
  [/croissants?/, 'croissant'],
  [/sponge fingers|ladyfingers|savoiardi/, 'ladyfingers'],
  [/oreo|chocolate sandwich|bourbon biscuits/, 'sandwich-biscuits'],
  [/digestive|graham|biscuits?|cookies?|shortbread/, 'biscuits'],
  [/crackers?|saltines|matzo/, 'crackers'],
  [/marshmallows?/, 'marshmallows'],
  [/sprinkles|hundreds and thousands|nonpareils/, 'sprinkles'],
  /* sugars and chocolate */
  [/icing sugar|powdered sugar|confectioners/, 'icing-sugar'],
  [/brown sugar|muscovado|demerara|palm sugar|jaggery|coconut sugar|turbinado|raw sugar|piloncillo/, 'brown-sugar'],
  [/\bsugar\b|sucrose/, 'sugar'],
  [/white chocolate/, 'white-chocolate'],
  [/milk chocolate/, 'milk-chocolate'],
  [/chocolate|cocoa nibs/, 'dark-chocolate'],
  [/vanilla (pod|bean)/, 'vanilla-pod'],
  [/vanilla/, 'vanilla'],
  [/food colou?ring|gel colou?r/, 'food-colouring'],
  /* vegetables and fresh herbs */
  [/spring onions?|scallions?|green onions?/, 'spring-onion'],
  [/onion powder/, 'onion-powder'],
  [/garlic powder|granulated garlic/, 'garlic-powder'],
  [/garlic chives|chinese chives/, 'garlic-chives'],
  [/\bchives\b/, 'chives'],
  [/shallots?|eschalots?/, 'shallot'],
  [/\bonions?\b/, 'onion'],
  [/\bleeks?\b/, 'leek'],
  [/\bgarlic\b/, 'garlic'],
  [/ground ginger|ginger powder/, 'ground-ginger'],
  [/galangal/, 'galangal'],
  [/\bginger\b/, 'ginger'],
  [/lemongrass|lemon grass/, 'lemongrass'],
  [/lime leaves|kaffir|makrut/, 'lime-leaf'],
  [/bay leaves|bay leaf/, 'bay-leaf'],
  [/curry leaves/, 'curry-leaf'],
  [/chilli powder|chili powder|cayenne|kashmiri/, 'chilli-powder'],
  [/chilli flakes|chili flakes|red pepper flakes|crushed chillies|crushed red pepper|aleppo|gochugaru/, 'chilli-flakes'],
  [/dried (red |whole )?chill?i(e)?s?|dried chillies|ancho|guajillo|chipotle/, 'dried-chilli'],
  [/bird'?s?-?eye|thai chill?i|scotch bonnet|habanero/, 'birds-eye-chilli'],
  [/jalape[nñ]o|serrano/, 'jalapeno'],
  [/chill?i(e)?s?\b|chile\b/, 'chilli'],
  [/(red|green|yellow|bell|sweet|capsicum) peppers?|capsicum/, 'bell-pepper'],
  [/peppercorns?|black pepper|ground pepper|freshly ground pepper|\bpepper\b/, (m) => (/white/.test(m) ? 'white-pepper' : /sichuan|szechuan/.test(m) ? 'sichuan-pepper' : 'black-pepper')],
  [/sweet potato|kumara/, 'sweet-potato'],
  [/potato(es)?/, 'potato'],
  [/carrots?/, 'carrot'],
  [/celery|celeriac/, 'celery'],
  [/pumpkin seeds|pepitas/, 'pumpkin-seeds'],
  [/pumpkin|butternut|squash\b|kabocha/, 'pumpkin'],
  [/courgettes?|zucchini/, 'courgette'],
  [/aubergines?|eggplants?/, 'aubergine'],
  [/cucumber/, 'cucumber'],
  [/spinach/, 'spinach'],
  [/\bkale\b|cavolo nero|chard|collard/, 'kale'],
  [/chinese (leaf|cabbage)|napa|wombok/, 'chinese-cabbage'],
  [/pak choi|bok choy|choy sum|gai lan|chinese broccoli/, 'pak-choi'],
  [/cabbage|brussels sprouts?/, 'cabbage'],
  [/broccoli|tenderstem|broccolini/, 'broccoli'],
  [/cauliflower/, 'cauliflower'],
  [/green beans|french beans|runner beans|haricots verts|snake beans|long beans|mangetout|sugar snap/, 'green-beans'],
  [/\bpeas\b|petits pois/, 'peas'],
  [/sweetcorn|corn on the cob|corn kernels|\bcorn\b/, 'sweetcorn'],
  [/dried shiitake|dried mushrooms|porcini/, 'dried-shiitake'],
  [/shiitake|oyster mushrooms|straw mushrooms|enoki|king oyster|wood ear|portobello|chestnut mushrooms|button mushrooms|mushrooms?/, (m) => (/shiitake|oyster|straw|enoki|wood ear/.test(m) ? 'shiitake' : 'mushroom')],
  [/beansprouts|bean sprouts/, 'beansprouts'],
  [/bamboo shoots/, 'bamboo-shoots'],
  [/water chestnuts/, 'water-chestnuts'],
  [/asparagus/, 'asparagus'],
  [/avocados?/, 'avocado'],
  [/lettuce|romaine|cos\b|iceberg|little gem|salad leaves|mixed leaves/, 'lettuce'],
  [/rocket|arugula|watercress/, 'rocket'],
  [/beetroot|beets?\b/, 'beetroot'],
  [/daikon|mooli|white radish/, 'daikon'],
  [/radish/, 'radish'],
  [/fennel seeds?/, 'fennel-seeds'],
  [/fennel/, 'fennel'],
  [/\bokra\b|ladies' fingers/, 'okra'],
  [/plantains?/, 'plantain'],
  [/cassava|yuca/, 'cassava'],
  [/\byams?\b/, 'yam'],
  [/turnips?|swede|rutabaga|kohlrabi/, 'turnip'],
  [/parsnips?/, 'parsnip'],
  [/\bnori\b|seaweed sheets/, 'nori'],
  [/kombu|kelp/, 'kombu'],
  [/wakame|seaweed/, 'wakame'],
  [/thai basil|holy basil|\bbasil\b/, (m) => (/dried/.test(m) ? 'dried-basil' : 'basil')],
  [/coriander (leaves|leaf|stems|stalks)|fresh coriander|cilantro|coriander, chopped|bunch.*coriander|coriander\b(?! seeds?| powder|, ground)/, (m) => (/seed|ground|powder/.test(m) ? 'coriander-seed' : 'coriander-leaf')],
  [/parsley/, (m) => (/dried/.test(m) ? 'dried-parsley' : 'parsley')],
  [/\bmint\b/, 'mint'],
  [/\bdill\b/, (m) => (/dried/.test(m) ? 'dried-dill' : 'dill')],
  [/thyme/, (m) => (/dried/.test(m) ? 'dried-thyme' : 'thyme')],
  [/rosemary/, (m) => (/dried/.test(m) ? 'dried-rosemary' : 'rosemary')],
  [/\bsage\b/, (m) => (/dried/.test(m) ? 'dried-sage' : 'sage')],
  [/oregano|marjoram/, (m) => (/fresh/.test(m) ? 'oregano' : 'dried-oregano')],
  [/tarragon|chervil|lovage|sorrel/, 'tarragon'],
  [/mixed herbs|italian (herbs|seasoning)|herbes de provence|bouquet garni/, 'mixed-herbs'],
  /* fruit */
  [/lemon juice|juice of .*lemon|lemons?, juiced/, 'lemon-juice'],
  [/lime juice|juice of .*lime|limes?, juiced/, 'lime-juice'],
  [/orange juice|juice of .*orange/, 'orange-juice'],
  [/zest/, 'zest'],
  [/lemons?\b/, 'lemon'],
  [/limes?\b/, 'lime'],
  [/oranges?\b|clementine|mandarin|satsuma/, 'orange'],
  [/apple juice/, 'apple-juice'],
  [/pineapple juice/, 'pineapple-juice'],
  [/dried apricots?/, 'apricot-dried'],
  [/raisins?|sultanas?|currants?/, 'raisins'],
  [/\bdates?\b/, 'dates'],
  [/dried cranberr/, 'cranberries-dried'],
  [/prunes?/, 'prunes'],
  [/desiccated|shredded coconut|coconut flakes/, 'coconut-desiccated'],
  [/fresh coconut|coconut (flesh|meat)/, 'coconut-fresh'],
  [/pomegranate/, 'pomegranate'],
  [/apples?\b/, 'apple'],
  [/bananas?\b/, 'banana'],
  [/strawberr/, 'strawberry'],
  [/raspberr|blackberr/, 'raspberry'],
  [/blueberr/, 'blueberry'],
  [/cherries? in (syrup|kirsch)|jarred cherries|tinned cherries|cherry pie filling|morello/, 'cherries-syrup'],
  [/cherr/, 'cherry'],
  [/mango(es)?\b/, 'mango'],
  [/pineapple/, 'pineapple'],
  [/peach|nectarine|apricots?/, 'peach'],
  [/pears?\b/, 'pear'],
  [/grapes?\b/, 'grapes'],
  [/\bfigs?\b/, 'figs'],
  [/rhubarb/, 'rhubarb'],
  [/mixed berries|summer fruits|frozen berries|berries\b/, 'mixed-berries'],
  [/kiwi/, 'kiwi'],
  [/passion ?fruit/, 'passion-fruit'],
  [/matcha|green tea powder/, 'matcha'],
  [/instant (coffee|espresso)|espresso powder|coffee granules/, 'instant-coffee'],
  [/espresso/, 'espresso'],
  [/\bcoffee\b/, 'coffee'],
  [/\btea\b|earl grey|tea ?bags?/, 'tea'],
  /* pulses, soy, nuts, seeds */
  [/tin(ned|s)? .*chickpeas|canned chickpeas|chickpeas, drained|chickpeas \(/, 'chickpeas-canned'],
  [/dried chickpeas/, 'chickpeas-dried'],
  [/chickpeas?|garbanzo/, (m) => (/dried/.test(m) ? 'chickpeas-dried' : 'chickpeas-canned')],
  [/tin(ned|s)? .*lentils|canned lentils|cooked lentils/, 'lentils-canned'],
  [/lentils?|\bdal\b|dhal|toor|moong|urad|masoor|chana dal|split peas/, 'lentils'],
  [/baked beans/, 'baked-beans'],
  [/black beans/, (m) => (/dried/.test(m) ? 'beans-dried' : 'black-beans-canned')],
  [/dried (kidney |pinto |haricot |cannellini |borlotti |white |navy |black )?beans|dried pulses/, 'beans-dried'],
  [/kidney beans|pinto beans|cannellini|haricot|borlotti|navy beans|white beans|flageolet|black-eyed|beans, drained|tin(ned|s)? .*beans|canned beans|mixed beans/, 'beans-canned'],
  [/edamame|soy ?beans|broad beans|fava/, 'edamame'],
  [/silken|soft tofu/, 'silken-tofu'],
  [/\btofu\b|bean curd/, 'tofu'],
  [/tempeh|seitan/, 'tempeh'],
  [/peanuts?|groundnuts/, 'peanuts'],
  [/ground almonds|almond (flour|meal)/, 'ground-almonds'],
  [/almonds?/, 'almonds'],
  [/walnuts?/, 'walnuts'],
  [/pecans?/, 'pecans'],
  [/cashews?/, 'cashews'],
  [/pistachios?/, 'pistachios'],
  [/hazelnuts?|filberts?/, 'hazelnuts'],
  [/pine ?nuts|pignoli/, 'pine-nuts'],
  [/\btahini\b|sesame paste/, 'tahini'],
  [/sesame/, 'sesame-seeds'],
  [/sunflower seeds/, 'sunflower-seeds'],
  [/chia/, 'chia'],
  [/flax|linseed/, 'flax'],
  [/poppy seeds/, 'poppy-seeds'],
  [/mixed nuts|\bnuts\b/, 'almonds'],
  /* spices */
  [/garam masala/, 'garam-masala'],
  [/curry powder|madras|tandoori/, 'curry-powder'],
  [/five-?spice/, 'five-spice'],
  [/ras el hanout|baharat|berbere|jerk|dukkah|chaat masala|sambar|panch phoran|shichimi|togarashi|pumpkin pie spice|mixed spice|chinese spice|advieh|chermoula/, 'spice-blend'],
  [/cajun|creole|taco seasoning|fajita|old bay|seasoned salt|celery salt|lemon pepper|steak seasoning|all-?purpose seasoning|seasoning/, 'seasoning-salted'],
  [/cumin/, 'cumin'],
  [/coriander (seeds?|powder)|ground coriander|coriander, ground/, 'coriander-seed'],
  [/turmeric/, 'turmeric'],
  [/paprika|pimentón/, 'paprika'],
  [/sichuan|szechuan/, 'sichuan-pepper'],
  [/white pepper/, 'white-pepper'],
  [/cinnamon|cassia/, 'cinnamon'],
  [/\bcloves?\b/, 'cloves'],
  [/star anise|anise|aniseed/, 'star-anise'],
  [/black cardamom/, 'black-cardamom'],
  [/cardamom/, 'cardamom'],
  [/nutmeg|mace\b/, 'nutmeg'],
  [/allspice|pimento/, 'allspice'],
  [/kasuri methi|fenugreek leaves|dried fenugreek/, 'kasuri-methi'],
  [/fenugreek/, 'fenugreek'],
  [/caraway/, 'caraway'],
  [/carom|ajwain/, 'ajwain'],
  [/nigella|kalonji|black onion seeds/, 'nigella'],
  [/asafoetida|hing\b/, 'asafoetida'],
  [/saffron/, 'saffron'],
  [/sumac/, 'sumac'],
  [/za'?atar/, 'zaatar'],
  [/amchoor|amchur|mango powder/, 'amchoor'],
  [/\bmsg\b|monosodium/, 'msg'],
  [/sea salt flakes|flaky salt|maldon|salt flakes|kosher salt/, 'flaky-salt'],
  [/\bsalt\b/, 'salt'],
  [/\b(water|ice cubes?|ice)\b/, 'water']   /* last: "cornflour mixed with 2 tbsp water" is cornflour */
];

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const WEIGHT = { g: 1, gram: 1, grams: 1, gm: 1, kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000, mg: 0.001, oz: 28.35, ounce: 28.35, ounces: 28.35, lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6 };
const VOLUME = { ml: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1, l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000, cl: 10, dl: 100, cup: 240, cups: 240, tbsp: 15, tbs: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, pint: 568, pints: 568, 'fl oz': 29.6, dessertspoon: 10, dessertspoons: 10, quart: 946, quarts: 946, gallon: 3785 };
const SMALL = { pinch: 0.4, pinches: 0.8, dash: 0.6, splash: 10, drizzle: 8, glug: 12, squeeze: 6, few: 3, drop: 0.1, drops: 0.3, knob: 15, sprinkle: 1, handful: 25, handfuls: 50, bunch: 25, bunches: 50 };
const COUNT_WORDS = /^(cloves?|sticks?|stalks?|sprigs?|leaves|leaf|pods?|sheets?|slices?|pieces?|racks?|fillets?|portions?|cans?|tins?|packs?|packets?|heads?|ears?|bulbs?|rashers?|whole|wedges?|nests?|rounds?|strips?|balls?|cubes?|blocks?|knobs?|bars?|squares?|punnets?|boxes?|jars?|bottles?|sachets?)$/;
const EXCLUDE = /\b(to serve|for serving|to garnish|for garnish|garnish|optional|for dusting|to dust|for greasing|to grease|for the (tin|pan|dish|tray|mould|mold|baking)|for brushing|to brush|for rolling|for sprinkling|for drizzling|for the glaze|to glaze|to decorate|for decorating|for decoration|for the pasta water|salted water|for boiling|to cover|for soaking|as needed|if needed|to taste|or to taste|for the table|to finish|for finishing|for the bowl|for the work surface|for the surface|for kneading|for the tray|for the dish|for the mould|for the mold|to coat the tin|for the pan|for frying the|to top|for topping)\b/;
const SIZE = { large: 1.3, big: 1.3, extra: 1.5, small: 0.7, baby: 0.5, medium: 1, mini: 0.4, jumbo: 1.5, king: 1.5, heaped: 1.3, heaping: 1.3, level: 1, scant: 0.9, generous: 1.2, rounded: 1.2 };

const num = (s) => {
  if (!s) return NaN;
  s = String(s).trim().replace(/,/g, '.');
  let v = 0, any = false;
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔⅛⅜⅝⅞])?(?:\s*(\d+)\/(\d+))?$/);
  if (!m) return NaN;
  if (m[1]) { v += parseFloat(m[1]); any = true; }
  if (m[2]) { v += FRACTIONS[m[2]]; any = true; }
  if (m[3]) { v += parseInt(m[3], 10) / parseInt(m[4], 10); any = true; }
  return any ? v : NaN;
};
const NUM = '(\\d+(?:[.,]\\d+)?\\s*[½¼¾⅓⅔⅛⅜⅝⅞]?|[½¼¾⅓⅔⅛⅜⅝⅞]|\\d+\\s*/\\s*\\d+)';
const UNIT = Object.keys(WEIGHT).concat(Object.keys(VOLUME)).sort((a, b) => b.length - a.length).join('|').replace('fl oz', 'fl\\.? ?oz');
const MEASURE = new RegExp('(?:about |approx\\.? |roughly |around |scant |heaped |generous )?' + NUM + '(?:\\s*(?:-|–|to)\\s*' + NUM + ')?\\s*(?:(x|×)\\s*' + NUM + '\\s*)?(' + UNIT + ')\\b', 'i');

function measureIn(text) {
  /* a weight or volume anywhere in a piece of text: "400 g", "1½ lb", "¾ cup", "2 x 400 ml" */
  const m = text.match(MEASURE);
  if (!m) return null;
  let q = num(m[1]);
  if (m[2]) q = (q + num(m[2])) / 2;
  const mult = m[3] ? num(m[4]) : 1;
  if (m[3]) { const t = q; q = mult; var count = t; } else count = 1;   /* "2 x 400 g" → count 2 of 400 g */
  const unit = m[5].toLowerCase().replace(/\./g, '').replace(/\s+/, ' ');
  const key = unit in WEIGHT ? unit : unit in VOLUME ? unit : unit.replace(/\s/g, '') === 'floz' ? 'fl oz' : unit;
  return { q, count, unit: key, weight: key in WEIGHT, grams: key in WEIGHT ? q * count * WEIGHT[key] : null, ml: key in VOLUME ? q * count * VOLUME[key] : null, each: /\beach\b/.test(text.slice(m.index)) };
}

function foodFor(name) {
  for (const [re, key] of RULES) {
    const m = name.match(re);
    if (m) return typeof key === 'function' ? key(name) : key;
  }
  return null;
}

const cleanName = (s) => s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

/* read one ingredient line into { food, grams, name, counted } */
export function readLine(raw, servings) {
  const nServ = servings || 4;
  const line = String(raw || '').replace(/ /g, ' ').trim();
  if (!line) return null;
  const lower = line.toLowerCase();
  const main = line.split(/\s+plus\s+(?!\d)/i)[0];                 /* "..., plus extra for dusting" counts only the first part */
  const noParens = cleanName(main).replace(/^(about|approx\.?|approximately|roughly|around|some|a few|a couple of)\s+/, '');
  const parens = (main.match(/\(([^)]*)\)/g) || []).map((p) => p.slice(1, -1).toLowerCase());
  const food = foodFor(noParens.replace(/^[^a-z]*/, '') || lower);
  const mainLower = cleanName(main);   /* notes in brackets ("gluten-free if needed") never exclude a line */
  const excluded = EXCLUDE.test(mainLower) && !/^salt\b|^(sea |flaky |fine )?salt and/.test(mainLower);
  const info = food ? FOODS[food] : null;
  const opt = info ? info[15] || {} : {};
  let grams = null, how = '';

  /* 1. a weight stated anywhere ("about 2 kg in total", "(14 oz)", "170 g each") settles it */
  const mainM = measureIn(noParens);
  const parenM = parens.map(measureIn).find((x) => x && x.weight) || null;
  const leadCount = (() => { const m = noParens.match(new RegExp('^' + NUM)); return m ? num(m[1]) : NaN; })();
  const sizeWord = (noParens.match(/\b(large|big|extra|small|baby|medium|mini|jumbo|king|heaped|heaping|level|scant|generous|rounded)\b/) || [])[1];
  const size = sizeWord ? SIZE[sizeWord] : 1;
  const anyWeight = (mainM && mainM.weight && mainM) || parenM || null;
  if (anyWeight) {
    grams = anyWeight.grams;
    if (anyWeight.each && !isNaN(leadCount) && leadCount > 0 && leadCount !== anyWeight.q) grams *= leadCount;
    how = 'weight';
  } else if (mainM && mainM.ml != null) {
    grams = mainM.ml * (opt.d || 1);
    how = 'volume';
  } else {
    const pm = parens.map(measureIn).find((x) => x && x.ml != null);
    if (pm) { grams = pm.ml * (opt.d || 1); how = 'volume'; }
  }
  /* 2. a count of items: "2 onions", "4 cloves garlic", "3 eggs", "1 whole chicken" */
  if (grams == null && !isNaN(leadCount) && leadCount > 0) {
    const after = noParens.replace(new RegExp('^' + NUM + '\\s*(?:(?:-|–|to)\\s*' + NUM + '\\s*)?'), '').trim();
    const range = noParens.match(new RegExp('^' + NUM + '\\s*(?:-|–|to)\\s*' + NUM));
    const count = range ? (num(range[1]) + num(range[2])) / 2 : leadCount;
    const word = (after.match(/^([a-z'-]+)/) || [])[1] || '';
    if (word in SMALL) { grams = SMALL[word] * count; how = 'small'; }
    else if (/^cm$/.test(word)) { grams = count * 5; how = 'cm'; }   /* a thumb of ginger: about 5 g per centimetre */
    else if (/^(inch|inches|in)$/.test(word)) { grams = count * 12; how = 'cm'; }
    else if (/^(cloves?)$/.test(word) && food === 'cloves') { grams = count * 0.1; how = 'count'; }
    else if (COUNT_WORDS.test(word)) {
      const per = { cloves: 4, clove: 4, sticks: food === 'cinnamon' ? 3 : 40, stick: food === 'cinnamon' ? 3 : 40, stalks: 15, stalk: 15, sprigs: opt.piece || 1, sprig: opt.piece || 1, leaves: opt.piece || 0.3, leaf: opt.piece || 0.3, pods: opt.piece || 0.15, pod: opt.piece || 0.15, sheets: opt.piece || 3, sheet: opt.piece || 3, slices: opt.piece || 30, slice: opt.piece || 30, rashers: 28, rasher: 28, cans: opt.piece || 400, can: opt.piece || 400, tins: opt.piece || 400, tin: opt.piece || 400, heads: food === 'garlic' ? 45 : opt.piece || 400, head: food === 'garlic' ? 45 : opt.piece || 400, ears: 150, ear: 150, nests: 60, nest: 60, portions: 125, portion: 125, racks: opt.piece || 1000, rack: opt.piece || 1000, fillets: opt.piece || 150, fillet: opt.piece || 150 };
      grams = count * (per[word] || opt.piece || 30) * size;
      how = 'count';
    } else if (opt.piece) { grams = count * opt.piece * size; how = 'count'; }
    else if (info) { grams = count * 30 * size; how = 'count?'; }
  }
  /* 3. no number at all: "Salt", "Vegetable oil, for frying", "Handful of coriander", "Juice of ½ lemon" */
  if (grams == null && info) {
    const juice = noParens.match(new RegExp('juice (?:and zest )?of\\s*' + NUM + '?\\s*(lemons?|limes?|oranges?)'));
    if (juice) { const n = juice[1] ? num(juice[1]) : 1; grams = n * ({ lemon: 45, lime: 30, orange: 80 }[juice[2].replace(/s$/, '')] || 40); how = 'juice'; }
    else if (/zest of/.test(noParens)) { grams = 3; how = 'zest'; }
    else {
      const w = (noParens.match(/^(?:a |an |some |few )?(large |small |big |generous )?(pinch|dash|splash|drizzle|glug|squeeze|knob|handful|bunch|sprinkle|few)/) || []);
      if (w[2]) grams = SMALL[w[2]] * (w[1] ? SIZE[w[1].trim()] || 1 : 1), how = 'small';
      else if (opt.cls === 'salt') grams = 0.6 * nServ, how = 'default';   /* salt to taste: about an eighth of a teaspoon a serving */
      else if (opt.cls === 'spice') grams = 0.15 * nServ, how = 'default';
      else if (opt.cls === 'oil' || opt.cls === 'fat') { if (/deep/.test(lower)) { grams = 0; how = 'deep-fry'; } else if (/fry|frying|shallow/.test(lower)) { grams = 0; how = 'shallow-fry'; } else { grams = 10; how = 'default'; } }
      else if (opt.cls === 'herb') grams = 8, how = 'default';
      else if (opt.cls === 'water') grams = 0, how = 'default';
      else grams = opt.piece || 30, how = 'default';
    }
  }
  /* 4. cooking rules */
  if (info && grams != null) {
    if (opt.cls === 'oil' && /deep-?fry|deep fry|for frying|for deep|shallow-?fry|for shallow/.test(lower) && how !== 'default') grams = Math.max(12, grams * 0.12); /* oil absorbed by fried food */
    if (opt.cls === 'water' && /boil|cook the|pasta|rice|soak|to cover|blanch|poach/.test(lower)) grams = 0;
    if ((food === 'chickpeas-canned' || food === 'beans-canned' || food === 'black-beans-canned' || food === 'lentils-canned') && /tins?\b|cans?\b|drained/.test(lower) && anyWeight) grams = (anyWeight.count || 1) * (opt.piece || 240); /* a 400 g tin drains to 240 g */
  }
  const display = info ? info[0] : cleanName(main).replace(/^[\d½¼¾⅓⅔⅛⅜⅝⅞.\s/x×-]+(?:(?:kg|g|ml|l|oz|lb|cups?|tbsp|tsp|tablespoons?|teaspoons?|cloves?|large|small|medium|tins?|cans?|sheets?|sticks?|stalks?|sprigs?|slices?|pieces?|bunch|handful)\b\s*)*(?:of\s+)?/, '').split(/,|;/)[0].trim();
  return { line, food, grams: grams == null ? 0 : Math.max(0, grams), name: display.charAt(0).toUpperCase() + display.slice(1), counted: !excluded && !!info, excluded, how };
}

/* "Serves 4", "Serves 4 to 6", "Makes 12", "Makes 1 loaf (12 slices)" */
export function servingsOf(s) {
  if (!s) return 4;
  const t = String(s).toLowerCase();
  const slices = t.match(/(\d+)\s*(slices|pieces|squares|bars|portions|servings)/);
  if (slices) return parseInt(slices[1], 10);
  const range = t.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
  if (range) return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2);
  const each = { loaf: 10, loaves: 10, cake: 10, cakes: 10, tart: 8, tarts: 8, pie: 8, pies: 8, pizza: 2, pizzas: 2, quiche: 6, quiches: 6, cheesecake: 10, baguette: 4, baguettes: 4, batch: 4, tray: 12, trays: 12 };
  const made = t.match(/makes (?:about |around )?(one|two|three|\d+)\s+(?:large |small |medium |big )?(loaf|loaves|cake|cakes|tart|tarts|pie|pies|pizza|pizzas|quiche|quiches|cheesecake|baguette|baguettes|batch|tray|trays)\b/);
  if (made) return ({ one: 1, two: 2, three: 3 }[made[1]] || parseInt(made[1], 10)) * each[made[2]];
  if (/makes (one|1|a) (large |small |medium )?(loaf|cake|tart|pie|pizza|quiche|cheesecake)/.test(t)) return /pizza/.test(t) ? 2 : 10;
  const n = t.match(/(\d+)/);
  return n ? Math.max(1, Math.min(60, parseInt(n[1], 10))) : 4;
}

/* water lost or gained in the pot, by the way the dish is mostly cooked */
const YIELD = { roasted: 0.75, grilled: 0.78, 'deep-fried': 0.85, fried: 0.85, 'stir-fried': 0.85, baked: 0.88, simmered: 0.85, braised: 0.85, stewed: 0.85, boiled: 0.95, steamed: 0.95, poached: 0.95, 'no-cook': 1, chilled: 1, raw: 1 };

/* split "1 cinnamon stick, 4 cardamom pods and 2 bay leaves" or "Salt and black pepper" into their items */
function splitItems(line) {
  const parts = line.split(/,\s*(?=\d|[½¼¾⅓⅔])|\s+and\s+(?=\d|[½¼¾⅓⅔])/);
  if (parts.length > 1 && parts.every((p) => /^[\d½¼¾⅓⅔]/.test(p.trim()) && foodFor(cleanName(p)))) return parts;
  if (/^(sea |flaky |fine )?salt and (freshly ground |ground |black |white |plenty of )*pepper/i.test(line)) return ['Salt', line.replace(/^.*?salt and /i, '')];
  if (!/\d/.test(line) && /\s+and\s+/.test(line) && !EXCLUDE.test(line.toLowerCase())) { const ps = line.split(/,\s*|\s+and\s+/); if (ps.every((p) => foodFor(cleanName(p)))) return ps; }
  return [line];
}

export function estimate(recipe) {
  const n = servingsOf(recipe.serves);
  const tot = Object.fromEntries(NUTRIENTS.map((k) => [k, 0]));
  let added = 0, grams = 0, counted = 0, readable = 0, liquid = 0;
  const items = [], unread = [], reads = [];
  for (const raw of recipe.ingredients || []) for (const part of splitItems(raw)) { const it = readLine(part, n); if (it && !it.excluded) reads.push(it); }
  /* oil "for deep-frying" with no amount: fried food takes up about a tenth of its weight in oil, a twentieth when shallow-fried */
  const solids = reads.filter((it) => it.food && !/stock|water|liquid|oil|fat/.test((FOODS[it.food][15] || {}).cls || '')).reduce((a, it) => a + it.grams, 0);
  reads.forEach((it) => {
    if (it.how === 'deep-fry') it.grams = Math.max(20, solids * 0.1); else if (it.how === 'shallow-fry') it.grams = Math.max(10, solids * 0.05);
    else if (it.food && /oil/.test(it.food) && /plus (extra|more) for (deep-?)?fry/.test(it.line.toLowerCase())) it.grams += /deep/.test(it.line.toLowerCase()) ? solids * 0.1 : solids * 0.05;
  });
  for (const it of reads) {
    {
      readable++;
      if (!it.food) { unread.push(it.line); items.push({ name: it.name, grams: 0 }); continue; }
      counted++;
      const f = FOODS[it.food], opt = f[15] || {};
      const g = it.grams;
      NUTRIENTS.forEach((k, i) => { tot[k] += f[i + 1] * g / 100; });
      added += f[6] * g / 100 * (opt.added || 0);
      items.push({ name: it.name, grams: g, food: it.food });
      if (opt.cls === 'bones') continue;                       /* bones are strained out: no weight */
      if (opt.cls === 'stock' || opt.cls === 'water' || opt.cls === 'liquid' || opt.cls === 'dairy' && /milk/.test(it.food)) liquid += g;
      grams += g * (1 + (opt.absorb && liquid < 300 ? opt.absorb : 0));
    }
  }
  const method = (recipe.method || [])[0];
  const net = Math.round(grams * (YIELD[method] || 0.9));
  const r1 = (v) => Math.round(v * 10) / 10, r0 = (v) => Math.round(v);
  const per = (k, dec) => (dec ? r1(tot[k] / n) : r0(tot[k] / n));
  const out = {
    kcal: per('kcal'), protein: per('protein'), carbs: per('carbs'), fat: per('fat'),
    fibre: per('fibre', 1), sugar: per('sugar', 1), satfat: per('satfat', 1), transfat: per('transfat', 1),
    chol: per('chol'), sodium: per('sodium'), added: r1(added / n), vitd: per('vitd', 1), calcium: per('calcium'), iron: per('iron', 1), potassium: per('potassium'),
    servings: n, serving_g: Math.round(net / n), net_g: net,
    ingredients: items.filter((i) => i.name).sort((a, b) => b.grams - a.grams).map((i) => i.name).filter((v, i, a) => a.indexOf(v) === i),
    coverage: readable ? Math.round(counted / readable * 100) / 100 : 0,
    unread
  };
  return out;
}
