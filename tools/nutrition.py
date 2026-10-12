#!/usr/bin/env python3
"""Estimates per-serving nutrition for every recipe in data/batch-*.json from its ingredient lines.

Writes data/nutrition.json: { id: {kcal, protein, carbs, fat, fibre, sugar, servings, coverage} }.
Values are estimates from a compact per-100 g table (USDA-style averages); the page labels them as such.
Run: python3 tools/nutrition.py
"""
import json, re, glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')

# key: (kcal, protein, carbs, fat, fibre, sugar, grams per cup, grams per piece)   per 100 g
T = {
    # grains, flours, starches
    'plain flour': (364, 10, 76, 1, 2.7, 0.3, 125, 0), 'all-purpose flour': (364, 10, 76, 1, 2.7, 0.3, 125, 0), 'flour': (364, 10, 76, 1, 2.7, 0.3, 125, 0),
    'bread flour': (361, 12, 72, 1.7, 2.4, 0.3, 127, 0), 'cornflour': (381, 0.3, 91, 0.1, 0.9, 0, 128, 0), 'cornstarch': (381, 0.3, 91, 0.1, 0.9, 0, 128, 0),
    'rice flour': (366, 6, 80, 1.4, 2.4, 0.1, 158, 0), 'glutinous rice flour': (366, 6, 80, 1.4, 2.4, 0.1, 158, 0), 'chickpea flour': (387, 22, 58, 7, 11, 11, 92, 0),
    'cornmeal': (370, 8, 79, 2, 7, 0.6, 157, 0), 'masa': (365, 9, 76, 4, 6, 0.6, 114, 0), 'polenta': (370, 8, 79, 2, 7, 0.6, 157, 0),
    'breadcrumbs': (395, 13, 72, 5, 4.5, 6, 108, 0), 'panko': (370, 12, 72, 3, 3, 2, 60, 0), 'oats': (389, 17, 66, 7, 10, 1, 90, 0),
    'rice noodles': (364, 6, 83, 0.6, 1.6, 0, 100, 0), 'glass noodles': (351, 0.2, 86, 0, 0.5, 0, 100, 0), 'ramen noodles': (280, 10, 55, 2, 2, 0, 100, 0), 'egg noodles': (384, 14, 71, 4.4, 3.3, 1.9, 100, 0),
    'noodles': (350, 11, 71, 1.5, 3, 1, 100, 0), 'spaghetti': (371, 13, 75, 1.5, 3.2, 2.7, 100, 0), 'pasta': (371, 13, 75, 1.5, 3.2, 2.7, 100, 0), 'lasagne sheets': (371, 13, 75, 1.5, 3.2, 2.7, 100, 0), 'macaroni': (371, 13, 75, 1.5, 3.2, 2.7, 100, 0), 'penne': (371, 13, 75, 1.5, 3.2, 2.7, 100, 0), 'rigatoni': (371, 13, 75, 1.5, 3.2, 2.7, 100, 0),
    'basmati rice': (360, 7, 79, 0.6, 1.3, 0.1, 190, 0), 'jasmine rice': (360, 7, 79, 0.6, 1.3, 0.1, 190, 0), 'sushi rice': (360, 7, 79, 0.6, 1.3, 0.1, 200, 0), 'brown rice': (367, 7.5, 76, 2.7, 3.5, 0.7, 190, 0), 'arborio': (360, 7, 79, 0.6, 1.3, 0.1, 200, 0), 'bomba rice': (360, 7, 79, 0.6, 1.3, 0.1, 200, 0), 'rice': (360, 7, 79, 0.6, 1.3, 0.1, 190, 0),
    'cooked rice': (130, 2.7, 28, 0.3, 0.4, 0, 160, 0), 'quinoa': (368, 14, 64, 6, 7, 0, 170, 0), 'couscous': (376, 13, 77, 0.6, 5, 0, 173, 0), 'bulgur': (342, 12, 76, 1.3, 18, 0.4, 140, 0),
    'tortilla': (312, 8, 51, 8, 3, 2, 0, 45), 'corn tortilla': (218, 5.7, 45, 2.9, 6, 0.9, 0, 26), 'pita': (275, 9, 55, 1.2, 2.2, 0.8, 0, 60), 'naan': (310, 9, 50, 8, 2, 3, 0, 90),
    'bread': (265, 9, 49, 3.2, 2.7, 5, 0, 30), 'baguette': (274, 9.5, 54, 1.5, 2.5, 2.5, 0, 250), 'burger bun': (280, 9, 50, 4, 2, 6, 0, 55), 'bun': (280, 9, 50, 4, 2, 6, 0, 55), 'brioche': (350, 9, 48, 14, 2, 8, 0, 60),
    'puff pastry': (551, 7, 45, 38, 1.5, 1, 0, 0), 'filo': (300, 7, 52, 6, 2, 0, 0, 18), 'phyllo': (300, 7, 52, 6, 2, 0, 0, 18), 'shortcrust': (480, 6, 50, 29, 2, 2, 0, 0), 'pastry': (480, 6, 50, 29, 2, 2, 0, 0), 'ladyfinger': (365, 9, 68, 5, 1, 30, 0, 11), 'savoiardi': (365, 9, 68, 5, 1, 30, 0, 11), 'digestive': (480, 6, 65, 21, 3, 20, 0, 15), 'graham': (430, 7, 77, 10, 3, 25, 0, 14),
    'dumpling wrappers': (290, 9, 60, 1, 2, 0, 0, 8), 'wonton wrappers': (290, 9, 60, 1, 2, 0, 0, 8), 'nori': (35, 6, 5, 0.3, 0.3, 0, 0, 3),
    # sugars, sweeteners
    'caster sugar': (387, 0, 100, 0, 0, 100, 200, 0), 'granulated sugar': (387, 0, 100, 0, 0, 100, 200, 0), 'brown sugar': (380, 0, 98, 0, 0, 97, 200, 0), 'palm sugar': (380, 0, 98, 0, 0, 97, 200, 0), 'icing sugar': (389, 0, 100, 0, 0, 98, 120, 0), 'powdered sugar': (389, 0, 100, 0, 0, 98, 120, 0), 'sugar': (387, 0, 100, 0, 0, 100, 200, 0),
    'honey': (304, 0.3, 82, 0, 0.2, 82, 340, 0), 'maple syrup': (260, 0, 67, 0, 0, 60, 320, 0), 'golden syrup': (325, 0, 80, 0, 0, 80, 330, 0), 'condensed milk': (321, 8, 54, 9, 0, 54, 306, 0), 'molasses': (290, 0, 75, 0, 0, 75, 328, 0), 'jam': (278, 0.4, 69, 0, 1, 49, 320, 0), 'treacle': (290, 0, 75, 0, 0, 75, 328, 0),
    # dairy, eggs
    'butter': (717, 0.9, 0.1, 81, 0, 0, 227, 0), 'ghee': (900, 0, 0, 100, 0, 0, 220, 0), 'margarine': (717, 0.2, 0.7, 80, 0, 0, 227, 0),
    'double cream': (340, 2, 3, 36, 0, 3, 240, 0), 'heavy cream': (340, 2, 3, 36, 0, 3, 240, 0), 'whipping cream': (340, 2, 3, 36, 0, 3, 240, 0), 'cream cheese': (342, 6, 4, 34, 0, 3, 230, 0), 'mascarpone': (430, 5, 4, 44, 0, 4, 240, 0),
    'sour cream': (198, 2.4, 4.6, 19, 0, 3, 240, 0), 'crème fraîche': (300, 2.5, 3, 30, 0, 3, 240, 0), 'creme fraiche': (300, 2.5, 3, 30, 0, 3, 240, 0), 'single cream': (195, 3, 4, 19, 0, 4, 240, 0), 'cream': (340, 2, 3, 36, 0, 3, 240, 0),
    'greek yogurt': (97, 9, 4, 5, 0, 4, 245, 0), 'yogurt': (61, 3.5, 4.7, 3.3, 0, 4.7, 245, 0), 'buttermilk': (40, 3.3, 4.8, 0.9, 0, 4.8, 245, 0), 'cottage cheese': (98, 11, 3.4, 4.3, 0, 2.7, 225, 0), 'ricotta': (174, 11, 3, 13, 0, 0.3, 246, 0),
    'whole milk': (61, 3.2, 4.8, 3.3, 0, 5, 244, 0), 'skimmed milk': (34, 3.4, 5, 0.1, 0, 5, 245, 0), 'coconut milk': (197, 2, 3, 21, 0, 3, 240, 0), 'coconut cream': (330, 3.6, 6.7, 34, 2, 3, 240, 0), 'evaporated milk': (134, 7, 10, 7.5, 0, 10, 252, 0), 'milk': (61, 3.2, 4.8, 3.3, 0, 5, 244, 0),
    'parmesan': (431, 38, 4, 29, 0, 0.9, 100, 0), 'pecorino': (387, 32, 4, 27, 0, 0, 100, 0), 'mozzarella': (280, 22, 3, 20, 0, 1, 112, 0), 'cheddar': (403, 25, 1.3, 33, 0, 0.5, 113, 0), 'gruyère': (413, 30, 0.4, 32, 0, 0.4, 108, 0), 'gruyere': (413, 30, 0.4, 32, 0, 0.4, 108, 0), 'feta': (264, 14, 4, 21, 0, 4, 150, 0), 'paneer': (321, 21, 3.6, 25, 0, 0, 150, 0), 'halloumi': (321, 22, 2, 25, 0, 0, 150, 0), 'emmental': (380, 29, 0, 28, 0, 0, 108, 0), 'cheese curds': (350, 24, 2, 28, 0, 0, 113, 0), 'cheese': (350, 24, 2, 28, 0, 0, 113, 0),
    'egg white': (52, 11, 0.7, 0.2, 0, 0.7, 243, 33), 'egg yolk': (322, 16, 3.6, 27, 0, 0.6, 243, 17), 'eggs': (143, 12.6, 0.7, 9.5, 0, 0.4, 243, 50), 'egg': (143, 12.6, 0.7, 9.5, 0, 0.4, 243, 50),
    # fats, oils
    'olive oil': (884, 0, 0, 100, 0, 0, 216, 0), 'vegetable oil': (884, 0, 0, 100, 0, 0, 218, 0), 'sesame oil': (884, 0, 0, 100, 0, 0, 218, 0), 'coconut oil': (892, 0, 0, 100, 0, 0, 218, 0), 'lard': (900, 0, 0, 100, 0, 0, 205, 0), 'oil': (884, 0, 0, 100, 0, 0, 218, 0), 'mayonnaise': (680, 1, 1, 75, 0, 1, 220, 0), 'tahini': (595, 17, 21, 54, 9, 0.5, 240, 0), 'peanut butter': (588, 25, 20, 50, 6, 9, 258, 0),
    # proteins
    'chicken breast': (165, 31, 0, 3.6, 0, 0, 0, 180), 'chicken thigh': (209, 26, 0, 11, 0, 0, 0, 120), 'chicken wings': (203, 30, 0, 8.1, 0, 0, 0, 90), 'chicken leg': (214, 26, 0, 12, 0, 0, 0, 200), 'whole chicken': (215, 18, 0, 15, 0, 0, 0, 1500), 'chicken': (190, 27, 0, 8, 0, 0, 0, 150),
    'turkey mince': (150, 20, 0, 8, 0, 0, 0, 0), 'ground turkey': (150, 20, 0, 8, 0, 0, 0, 0), 'turkey': (150, 20, 0, 8, 0, 0, 0, 0),
    'beef mince': (250, 17, 0, 20, 0, 0, 0, 0), 'ground beef': (250, 17, 0, 20, 0, 0, 0, 0), 'lean beef mince': (176, 20, 0, 10, 0, 0, 0, 0), 'minced beef': (250, 17, 0, 20, 0, 0, 0, 0), 'beef sirloin': (200, 27, 0, 10, 0, 0, 0, 0), 'ribeye': (291, 24, 0, 22, 0, 0, 0, 350), 'beef fillet': (191, 26, 0, 9, 0, 0, 0, 0), 'beef tenderloin': (191, 26, 0, 9, 0, 0, 0, 0), 'chuck': (240, 19, 0, 18, 0, 0, 0, 0), 'brisket': (250, 19, 0, 19, 0, 0, 0, 0), 'stewing beef': (240, 19, 0, 18, 0, 0, 0, 0), 'braising steak': (240, 19, 0, 18, 0, 0, 0, 0), 'flank steak': (192, 28, 0, 8, 0, 0, 0, 0), 'beef': (230, 22, 0, 15, 0, 0, 0, 0), 'veal': (172, 24, 0, 8, 0, 0, 0, 150),
    'lamb mince': (282, 17, 0, 23, 0, 0, 0, 0), 'lamb shoulder': (280, 17, 0, 23, 0, 0, 0, 0), 'lamb': (258, 25, 0, 17, 0, 0, 0, 0),
    'pork belly': (518, 9, 0, 53, 0, 0, 0, 0), 'pork shoulder': (240, 17, 0, 19, 0, 0, 0, 0), 'pork mince': (263, 17, 0, 21, 0, 0, 0, 0), 'ground pork': (263, 17, 0, 21, 0, 0, 0, 0), 'pork ribs': (280, 20, 0, 22, 0, 0, 0, 0), 'pork loin': (143, 21, 0, 6, 0, 0, 0, 0), 'pork': (240, 20, 0, 17, 0, 0, 0, 0),
    'bacon': (417, 13, 1.4, 40, 0, 0, 0, 25), 'pancetta': (417, 13, 1.4, 40, 0, 0, 0, 0), 'guanciale': (600, 10, 0, 62, 0, 0, 0, 0), 'chorizo': (455, 24, 2, 38, 0, 0, 0, 0), 'sausage': (300, 14, 3, 26, 0, 1, 0, 70), 'ham': (145, 21, 1.5, 6, 0, 1, 0, 30), 'prosciutto': (250, 26, 0, 16, 0, 0, 0, 15),
    'salmon': (208, 20, 0, 13, 0, 0, 0, 170), 'tuna steak': (144, 23, 0, 5, 0, 0, 0, 170), 'tuna': (144, 23, 0, 5, 0, 0, 0, 170), 'cod': (82, 18, 0, 0.7, 0, 0, 0, 170), 'haddock': (90, 20, 0, 0.6, 0, 0, 0, 170), 'white fish': (90, 19, 0, 1, 0, 0, 0, 170), 'sea bass': (97, 18, 0, 2, 0, 0, 0, 170), 'fish fillet': (100, 19, 0, 2, 0, 0, 0, 170), 'fish': (100, 19, 0, 2, 0, 0, 0, 170), 'anchov': (210, 29, 0, 10, 0, 0, 0, 4),
    'prawns': (99, 24, 0.2, 0.3, 0, 0, 0, 12), 'shrimp': (99, 24, 0.2, 0.3, 0, 0, 0, 12), 'mussels': (86, 12, 4, 2, 0, 0, 0, 10), 'clams': (86, 15, 3, 1, 0, 0, 0, 10), 'squid': (92, 16, 3, 1.4, 0, 0, 0, 0), 'scallops': (88, 17, 2, 0.8, 0, 0, 0, 20), 'crab': (87, 18, 0, 1, 0, 0, 0, 0), 'surimi': (95, 8, 12, 1, 0, 3, 0, 15),
    'tofu': (76, 8, 1.9, 4.8, 0.3, 0, 250, 0), 'tempeh': (193, 19, 9, 11, 0, 0, 165, 0), 'edamame': (121, 11, 9, 5, 5, 2, 155, 0),
    'chickpeas': (364, 19, 61, 6, 17, 11, 200, 0), 'canned chickpeas': (139, 7, 22, 2.6, 6, 0, 240, 0), 'red lentils': (352, 25, 63, 1, 11, 2, 190, 0), 'lentils': (352, 25, 63, 1, 11, 2, 190, 0), 'black beans': (341, 21, 62, 1.4, 16, 2, 190, 0), 'kidney beans': (333, 24, 60, 0.8, 25, 2, 190, 0), 'canned beans': (127, 8, 22, 0.5, 7, 0, 240, 0), 'beans': (333, 22, 60, 1, 20, 2, 190, 0), 'split peas': (341, 25, 60, 1, 25, 8, 200, 0),
    # vegetables
    'onion': (40, 1.1, 9.3, 0.1, 1.7, 4.2, 160, 150), 'shallot': (72, 2.5, 17, 0.1, 3, 8, 160, 30), 'spring onion': (32, 1.8, 7.3, 0.2, 2.6, 2.3, 100, 15), 'scallion': (32, 1.8, 7.3, 0.2, 2.6, 2.3, 100, 15), 'leek': (61, 1.5, 14, 0.3, 1.8, 3.9, 90, 90), 'garlic': (149, 6.4, 33, 0.5, 2.1, 1, 136, 4), 'ginger': (80, 1.8, 18, 0.8, 2, 1.7, 96, 15),
    'tomato': (18, 0.9, 3.9, 0.2, 1.2, 2.6, 180, 120), 'cherry tomato': (18, 0.9, 3.9, 0.2, 1.2, 2.6, 150, 17), 'chopped tomatoes': (24, 1.2, 4.8, 0.2, 1.2, 3, 240, 0), 'tomato purée': (82, 4.3, 19, 0.5, 4, 12, 262, 0), 'tomato puree': (82, 4.3, 19, 0.5, 4, 12, 262, 0), 'tomato paste': (82, 4.3, 19, 0.5, 4, 12, 262, 0), 'passata': (30, 1.4, 6, 0.2, 1.5, 4, 245, 0), 'tomato sauce': (40, 1.5, 8, 0.5, 1.5, 5, 245, 0), 'tomato': (18, 0.9, 3.9, 0.2, 1.2, 2.6, 180, 120),
    'potato': (77, 2, 17, 0.1, 2.2, 0.8, 150, 170), 'sweet potato': (86, 1.6, 20, 0.1, 3, 4.2, 133, 150), 'carrot': (41, 0.9, 9.6, 0.2, 2.8, 4.7, 128, 70), 'celery': (16, 0.7, 3, 0.2, 1.6, 1.3, 100, 40), 'bell pepper': (31, 1, 6, 0.3, 2.1, 4.2, 150, 150), 'red pepper': (31, 1, 6, 0.3, 2.1, 4.2, 150, 150), 'green pepper': (20, 0.9, 4.6, 0.2, 1.7, 2.4, 150, 150), 'pepper': (31, 1, 6, 0.3, 2.1, 4.2, 150, 150),
    'courgette': (17, 1.2, 3.1, 0.3, 1, 2.5, 124, 200), 'zucchini': (17, 1.2, 3.1, 0.3, 1, 2.5, 124, 200), 'aubergine': (25, 1, 6, 0.2, 3, 3.5, 82, 350), 'eggplant': (25, 1, 6, 0.2, 3, 3.5, 82, 350), 'mushroom': (22, 3.1, 3.3, 0.3, 1, 2, 70, 15), 'shiitake': (34, 2.2, 7, 0.5, 2.5, 2.4, 70, 15),
    'spinach': (23, 2.9, 3.6, 0.4, 2.2, 0.4, 30, 0), 'kale': (49, 4.3, 9, 0.9, 3.6, 2.3, 67, 0), 'lettuce': (15, 1.4, 2.9, 0.2, 1.3, 0.8, 47, 300), 'romaine': (17, 1.2, 3.3, 0.3, 2.1, 1.2, 47, 300), 'cabbage': (25, 1.3, 5.8, 0.1, 2.5, 3.2, 89, 900), 'kimchi': (15, 1.1, 2.4, 0.5, 1.6, 1, 150, 0), 'broccoli': (34, 2.8, 7, 0.4, 2.6, 1.7, 91, 300), 'cauliflower': (25, 1.9, 5, 0.3, 2, 1.9, 100, 600), 'beansprouts': (30, 3, 6, 0.2, 1.8, 4, 104, 0), 'bean sprouts': (30, 3, 6, 0.2, 1.8, 4, 104, 0),
    'cucumber': (15, 0.7, 3.6, 0.1, 0.5, 1.7, 120, 300), 'avocado': (160, 2, 8.5, 15, 6.7, 0.7, 150, 200), 'olives': (115, 0.8, 6, 11, 3.2, 0, 135, 4), 'peas': (81, 5.4, 14, 0.4, 5.7, 5.7, 145, 0), 'green beans': (31, 1.8, 7, 0.2, 2.7, 3.3, 110, 0), 'corn': (86, 3.3, 19, 1.4, 2.7, 6.3, 145, 0), 'sweetcorn': (86, 3.3, 19, 1.4, 2.7, 6.3, 145, 0), 'pumpkin': (26, 1, 6.5, 0.1, 0.5, 2.8, 116, 0), 'squash': (26, 1, 6.5, 0.1, 0.5, 2.8, 116, 0), 'pumpkin purée': (34, 1.1, 8, 0.1, 2.9, 3.2, 245, 0), 'pumpkin puree': (34, 1.1, 8, 0.1, 2.9, 3.2, 245, 0),
    'beetroot': (43, 1.6, 10, 0.2, 2.8, 7, 136, 80), 'radish': (16, 0.7, 3.4, 0.1, 1.6, 1.9, 116, 5), 'bamboo shoots': (27, 2.6, 5, 0.3, 2.2, 3, 120, 0), 'water chestnut': (97, 1.4, 24, 0.1, 3, 5, 120, 0), 'lemongrass': (99, 1.8, 25, 0.5, 0, 0, 67, 10), 'chilli': (40, 1.9, 9, 0.4, 1.5, 5, 90, 5), 'chili': (40, 1.9, 9, 0.4, 1.5, 5, 90, 5), 'jalape': (29, 0.9, 6.5, 0.4, 2.8, 4, 90, 14), 'dried chillies': (282, 12, 50, 14, 29, 0, 0, 1), 'chipotle': (40, 1.9, 9, 0.4, 1.5, 5, 90, 5),
    # fruit, nuts
    'lemon juice': (22, 0.4, 7, 0.2, 0.3, 2.5, 244, 0), 'lime juice': (25, 0.4, 8.4, 0.1, 0.4, 1.7, 244, 0), 'lemon': (29, 1.1, 9, 0.3, 2.8, 2.5, 0, 60), 'lime': (30, 0.7, 11, 0.2, 2.8, 1.7, 0, 50), 'orange': (47, 0.9, 12, 0.1, 2.4, 9, 0, 130), 'apple': (52, 0.3, 14, 0.2, 2.4, 10, 125, 180), 'banana': (89, 1.1, 23, 0.3, 2.6, 12, 150, 120), 'strawberr': (32, 0.7, 7.7, 0.3, 2, 4.9, 150, 12), 'raspberr': (52, 1.2, 12, 0.7, 6.5, 4.4, 123, 0), 'blueberr': (57, 0.7, 14, 0.3, 2.4, 10, 148, 0), 'cherr': (63, 1.1, 16, 0.2, 2.1, 13, 155, 8), 'mango': (60, 0.8, 15, 0.4, 1.6, 14, 165, 300), 'pineapple': (50, 0.5, 13, 0.1, 1.4, 10, 165, 0), 'mixed berries': (50, 1, 12, 0.4, 3.5, 7, 150, 0), 'berries': (50, 1, 12, 0.4, 3.5, 7, 150, 0),
    'raisins': (299, 3.1, 79, 0.5, 3.7, 59, 145, 0), 'sultanas': (299, 3.1, 79, 0.5, 3.7, 59, 145, 0), 'dates': (277, 1.8, 75, 0.2, 6.7, 63, 147, 7), 'apricot': (241, 3.4, 63, 0.5, 7.3, 53, 130, 8), 'desiccated coconut': (660, 7, 24, 65, 16, 7, 93, 0), 'coconut flakes': (660, 7, 24, 65, 16, 7, 93, 0), 'coconut': (354, 3.3, 15, 33, 9, 6, 80, 0),
    'almonds': (579, 21, 22, 50, 12, 4.4, 143, 1.2), 'ground almonds': (579, 21, 22, 50, 12, 4.4, 96, 0), 'walnuts': (654, 15, 14, 65, 6.7, 2.6, 117, 0), 'pecans': (691, 9, 14, 72, 9.6, 4, 109, 0), 'pistachio': (560, 20, 28, 45, 10, 7.7, 123, 0), 'hazelnut': (628, 15, 17, 61, 9.7, 4.3, 135, 0), 'cashew': (553, 18, 30, 44, 3.3, 5.9, 130, 0), 'peanuts': (567, 26, 16, 49, 8.5, 4.7, 146, 0), 'pine nuts': (673, 14, 13, 68, 3.7, 3.6, 135, 0), 'sesame seeds': (573, 18, 23, 50, 12, 0.3, 144, 0), 'chia': (486, 17, 42, 31, 34, 0, 160, 0),
    # chocolate, baking extras
    'dark chocolate': (546, 5, 61, 31, 7, 48, 170, 0), 'milk chocolate': (535, 7.7, 59, 30, 3.4, 52, 170, 0), 'white chocolate': (539, 5.9, 59, 32, 0.2, 59, 170, 0), 'chocolate chips': (480, 4, 63, 25, 6, 50, 170, 0), 'chocolate': (546, 5, 61, 31, 7, 48, 170, 0), 'cocoa powder': (228, 20, 58, 14, 33, 1.8, 86, 0), 'cocoa': (228, 20, 58, 14, 33, 1.8, 86, 0), 'matcha': (300, 30, 40, 5, 38, 0, 110, 0),
    'baking powder': (53, 0, 28, 0, 0, 0, 220, 0), 'bicarbonate': (0, 0, 0, 0, 0, 0, 220, 0), 'baking soda': (0, 0, 0, 0, 0, 0, 220, 0), 'yeast': (325, 40, 41, 8, 27, 0, 150, 7), 'gelatine': (335, 86, 0, 0, 0, 0, 150, 2), 'gelatin': (335, 86, 0, 0, 0, 0, 150, 2), 'vanilla': (288, 0, 13, 0, 0, 13, 208, 0), 'cream of tartar': (258, 0, 62, 0, 0, 0, 160, 0),
    'coffee': (2, 0.1, 0, 0, 0, 0, 240, 0), 'espresso': (9, 0.1, 1.7, 0.2, 0, 0, 240, 0), 'marsala': (160, 0, 12, 0, 0, 10, 240, 0), 'rum': (231, 0, 0, 0, 0, 0, 240, 0), 'brandy': (231, 0, 0, 0, 0, 0, 240, 0), 'kirsch': (231, 0, 0, 0, 0, 0, 240, 0), 'red wine': (85, 0.1, 2.6, 0, 0, 0.6, 240, 0), 'white wine': (82, 0.1, 2.6, 0, 0, 1, 240, 0), 'wine': (85, 0.1, 2.6, 0, 0, 0.6, 240, 0), 'sake': (134, 0.5, 5, 0, 0, 0, 240, 0), 'mirin': (240, 0.2, 45, 0, 0, 40, 240, 0), 'shaoxing': (120, 0.5, 5, 0, 0, 0, 240, 0), 'beer': (43, 0.5, 3.6, 0, 0, 0, 240, 0),
    # sauces, condiments, stocks
    'soy sauce': (53, 8, 5, 0.6, 0.8, 0.4, 255, 0), 'fish sauce': (35, 5, 4, 0, 0, 0, 255, 0), 'oyster sauce': (51, 1.4, 11, 0.3, 0.3, 6, 255, 0), 'hoisin': (220, 3.3, 44, 3.4, 2.8, 27, 270, 0), 'gochujang': (200, 4, 44, 2, 3, 20, 290, 0), 'miso': (199, 12, 26, 6, 5, 6, 275, 0), 'sriracha': (93, 2, 19, 1, 2, 15, 255, 0), 'hot sauce': (20, 1, 3, 0.5, 0, 1, 255, 0), 'worcestershire': (78, 0, 19, 0, 0, 10, 255, 0), 'ketchup': (101, 1, 27, 0.1, 0.3, 21, 270, 0), 'mustard': (66, 4, 6, 3, 3, 1, 250, 0), 'vinegar': (18, 0, 0.4, 0, 0, 0.4, 240, 0), 'tamarind': (239, 2.8, 63, 0.6, 5, 39, 240, 0), 'curry paste': (120, 2, 12, 7, 3, 4, 250, 0), 'harissa': (90, 3, 12, 4, 4, 5, 250, 0), 'pesto': (450, 5, 6, 45, 2, 2, 240, 0), 'bbq sauce': (170, 1, 40, 0.5, 1, 33, 280, 0), 'barbecue sauce': (170, 1, 40, 0.5, 1, 33, 280, 0),
    'stock': (5, 0.5, 0.5, 0.1, 0, 0, 240, 0), 'broth': (5, 0.5, 0.5, 0.1, 0, 0, 240, 0), 'dashi': (3, 0.4, 0.2, 0, 0, 0, 240, 0), 'water': (0, 0, 0, 0, 0, 0, 240, 0), 'ice': (0, 0, 0, 0, 0, 0, 240, 0),
    'capers': (23, 2.4, 4.9, 0.9, 3.2, 0.4, 130, 0), 'preserved lemon': (20, 0.5, 5, 0, 2, 1, 0, 40), 'pickled ginger': (50, 0.2, 12, 0, 1, 10, 0, 0), 'wasabi': (290, 5, 60, 10, 8, 10, 0, 0), 'kombu': (43, 1.7, 10, 0.6, 1.3, 0, 0, 5), 'bonito': (350, 77, 0, 3, 0, 0, 10, 0),
    'salt': (0, 0, 0, 0, 0, 0, 290, 0), 'black pepper': (251, 10, 64, 3, 25, 0.6, 115, 0), 'white pepper': (296, 10, 69, 2, 26, 0, 115, 0), 'sichuan pepper': (250, 10, 60, 3, 25, 0, 115, 0), 'peppercorn': (251, 10, 64, 3, 25, 0.6, 115, 0),
    # herbs, spices (small quantities)
    'cumin': (375, 18, 44, 22, 11, 2, 96, 0), 'coriander': (23, 2, 4, 0.5, 2.8, 0.9, 16, 0), 'cilantro': (23, 2, 4, 0.5, 2.8, 0.9, 16, 0), 'parsley': (36, 3, 6, 0.8, 3.3, 0.9, 60, 0), 'basil': (23, 3.2, 2.7, 0.6, 1.6, 0.3, 24, 0), 'mint': (44, 3.3, 8.4, 0.7, 6.8, 0, 24, 0), 'dill': (43, 3.5, 7, 1.1, 2.1, 0, 9, 0), 'thyme': (101, 5.6, 24, 1.7, 14, 0, 40, 1), 'rosemary': (131, 3.3, 21, 5.9, 14, 0, 40, 2), 'oregano': (265, 9, 69, 4.3, 43, 4, 45, 0), 'bay': (313, 7.6, 75, 8.4, 26, 0, 0, 0.5), 'sage': (315, 11, 61, 13, 40, 2, 40, 0.5), 'chives': (30, 3.3, 4.4, 0.7, 2.5, 1.9, 48, 0), 'tarragon': (295, 23, 50, 7, 7, 0, 40, 0),
    'paprika': (282, 14, 54, 13, 35, 10, 108, 0), 'turmeric': (312, 10, 67, 3, 22, 3, 150, 0), 'garam masala': (350, 14, 50, 15, 25, 5, 100, 0), 'curry powder': (325, 14, 56, 14, 53, 3, 100, 0), 'chilli powder': (282, 13, 50, 14, 35, 7, 128, 0), 'chili powder': (282, 13, 50, 14, 35, 7, 128, 0), 'cayenne': (318, 12, 57, 17, 27, 10, 90, 0), 'cinnamon': (247, 4, 81, 1.2, 53, 2.2, 125, 0), 'nutmeg': (525, 6, 49, 36, 21, 3, 110, 0), 'cardamom': (311, 11, 68, 7, 28, 0, 90, 0), 'cloves': (274, 6, 66, 13, 34, 2.4, 100, 0), 'allspice': (263, 6, 72, 9, 22, 0, 100, 0), 'star anise': (337, 18, 50, 16, 15, 0, 100, 1), 'fennel seed': (345, 16, 52, 15, 40, 0, 100, 0), 'mustard seed': (508, 26, 28, 36, 12, 7, 160, 0), 'coriander seed': (298, 12, 55, 18, 42, 0, 80, 0), 'cumin seed': (375, 18, 44, 22, 11, 2, 96, 0), 'saffron': (310, 11, 65, 6, 4, 0, 80, 0), 'five spice': (330, 10, 55, 10, 25, 0, 100, 0), 'ginger powder': (335, 9, 72, 4, 14, 3, 100, 0), 'garlic powder': (331, 17, 73, 0.7, 9, 2.4, 155, 0), 'onion powder': (341, 10, 79, 1, 15, 6.6, 110, 0), 'smoked paprika': (282, 14, 54, 13, 35, 10, 108, 0), 'sumac': (300, 5, 60, 10, 20, 0, 100, 0), 'za\'atar': (300, 10, 50, 15, 20, 0, 100, 0), 'spice': (300, 10, 55, 10, 25, 2, 100, 0),
}
KEYS = sorted(T.keys(), key=len, reverse=True)

UNIT_G = {'g': 1, 'gram': 1, 'grams': 1, 'kg': 1000, 'oz': 28.35, 'ounce': 28.35, 'ounces': 28.35, 'lb': 453.6, 'lbs': 453.6, 'pound': 453.6, 'pounds': 453.6}
UNIT_ML = {'ml': 1, 'millilitre': 1, 'milliliter': 1, 'l': 1000, 'litre': 1000, 'liter': 1000, 'litres': 1000}
UNIT_CUP = {'cup': 1, 'cups': 1, 'tbsp': 1 / 16, 'tablespoon': 1 / 16, 'tablespoons': 1 / 16, 'tsp': 1 / 48, 'teaspoon': 1 / 48, 'teaspoons': 1 / 48, 'pinch': 1 / 200, 'pinches': 1 / 100, 'dash': 1 / 150, 'handful': 0.5, 'handfuls': 0.5}
PIECE_WORDS = {'clove', 'cloves', 'large', 'medium', 'small', 'whole', 'piece', 'pieces', 'slice', 'slices', 'sheet', 'sheets', 'stalk', 'stalks', 'sprig', 'sprigs', 'leaf', 'leaves', 'stick', 'sticks', 'head', 'heads', 'bunch', 'can', 'cans', 'tin', 'tins', 'portion', 'portions', 'fillet', 'fillets', 'breast', 'breasts', 'thigh', 'thighs', 'ear', 'ears', 'wedge', 'wedges', 'x'}
CAN_G = 400
FRAC = {'½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875}

def num(s):
    s = s.strip()
    m = re.match(r'^(\d+)?\s*([½¼¾⅓⅔⅛⅜⅝⅞])', s)
    if m: return (float(m.group(1)) if m.group(1) else 0) + FRAC[m.group(2)]
    m = re.match(r'^(\d+)\s*/\s*(\d+)', s)
    if m: return float(m.group(1)) / float(m.group(2))
    m = re.match(r'^(\d+(?:\.\d+)?)', s)
    return float(m.group(1)) if m else None

def parse_line(line):
    """-> (grams or None, matched key or None, text)"""
    t = line.lower().replace('–', '-').replace('—', '-')
    t = re.sub(r'\([^)]*\)', ' ', t)             # drop imperial brackets
    t = re.sub(r'\b(\d+)\s*(?:-|to)\s*(\d+)\b', r'\1', t)   # ranges -> first
    key = next((k for k in KEYS if k in t), None)
    # tinned pulses are already cooked and hydrated: roughly 38% of the dry values per gram
    if key in ('chickpeas', 'red lentils', 'lentils', 'black beans', 'kidney beans', 'beans', 'split peas') and re.search(r'\b(tin|tins|can|cans|canned|tinned|drained|rinsed)\b', t):
        key = 'canned chickpeas' if key == 'chickpeas' else 'canned beans'
    # "2 x 400 g tins", "3 × 200 ml cans": multiply out
    mm = re.match(r'^\s*(\d+)\s*[x×]\s*([\d.]+)\s*(g|kg|ml|l)\b', t)
    if mm: t = str(float(mm.group(1)) * float(mm.group(2))) + ' ' + mm.group(3) + t[mm.end():]
    # quantity + unit
    m = re.match(r'^\s*(about |approx\.? )?([\d½¼¾⅓⅔⅛⅜⅝⅞./ ]+)\s*([a-zA-Z]+)?', t)
    qty = num(m.group(2)) if m and m.group(2).strip() else None
    unit = (m.group(3) or '').lower() if m else ''
    grams = None
    if key:
        kcal, p, c, f, fi, su, gcup, gpiece = T[key]
        if qty is not None:
            if unit in UNIT_G: grams = qty * UNIT_G[unit]
            elif unit in UNIT_ML: grams = qty * UNIT_ML[unit] * (0.92 if 'oil' in key else 1.0)
            elif unit in UNIT_CUP: grams = qty * UNIT_CUP[unit] * (gcup or 240)
            elif unit in ('can', 'cans', 'tin', 'tins'): grams = qty * CAN_G
            elif unit in PIECE_WORDS or unit == '' or unit == key.split()[0] or gpiece:
                grams = qty * (gpiece or 60)
            else:
                grams = qty * (gpiece or 30)
        else:
            # no quantity: "salt", "black pepper", "nori sheets, to serve"
            grams = 2 if T[key][0] > 200 and key in ('salt', 'black pepper', 'white pepper', 'spice') else (3 if key in ('salt',) else 10)
    if grams:
        if re.search(r'for (deep[- ])?frying|for the fryer|to deep[- ]fry|for shallow[- ]frying', t): grams *= 0.12   # oil absorbed, not the whole pot
        elif re.search(r'wings and backs|carcass|bones|for the (stock|broth)', t): grams *= 0.3         # simmered for stock, mostly discarded
        elif re.search(r'to serve|to garnish|for dusting|for greasing|optional', t): grams *= 0.5
    return grams, key, t

def servings_of(s):
    m = re.search(r'(\d+)', s or '')
    return int(m.group(1)) if m else 4

def estimate(recipe):
    tot = [0, 0, 0, 0, 0, 0]
    matched = 0
    for line in recipe['ingredients']:
        grams, key, _ = parse_line(line)
        if key and grams:
            matched += 1
            vals = T[key][:6]
            for i in range(6): tot[i] += vals[i] * grams / 100
    n = servings_of(recipe.get('serves'))
    per = [v / n for v in tot]
    return {
        'kcal': round(per[0]), 'protein': round(per[1]), 'carbs': round(per[2]), 'fat': round(per[3]), 'fibre': round(per[4]), 'sugar': round(per[5]),
        'servings': n, 'coverage': round(matched / max(1, len(recipe['ingredients'])), 2)
    }

def main():
    out = {}
    low = []
    for f in sorted(glob.glob(os.path.join(DATA, 'batch-*.json'))):
        for r in json.load(open(f, encoding='utf8')):
            out[r['id']] = estimate(r)
            if out[r['id']]['coverage'] < 0.75: low.append((r['id'], out[r['id']]['coverage']))
    json.dump(out, open(os.path.join(DATA, 'nutrition.json'), 'w', encoding='utf8'), indent=1)
    print(len(out), 'recipes -> data/nutrition.json')
    if low:
        print('low coverage:', ', '.join('%s (%.0f%%)' % (i, c * 100) for i, c in low))
    if '--debug' in sys.argv:
        for f in sorted(glob.glob(os.path.join(DATA, 'batch-*.json'))):
            for r in json.load(open(f, encoding='utf8')):
                if r['id'] in sys.argv:
                    for line in r['ingredients']: print(parse_line(line))
                    print(out[r['id']])

if __name__ == '__main__':
    main()
