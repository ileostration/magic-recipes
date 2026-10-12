#!/usr/bin/env python3
"""Content-based nearest neighbours with scikit-learn.

Builds a TF-IDF document per recipe from its tags and ingredient words, computes cosine similarity,
and writes data/similar.json: { id: [[other_id, score], ...] } with the 12 closest recipes each.
The page blends these scores into its tiered recommendations (js/recommend.js).
Run: python3 tools/similarity.py   (needs: pip install scikit-learn numpy)
"""
import json, re, glob, os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
STOP = {'and', 'or', 'of', 'the', 'to', 'for', 'with', 'into', 'cut', 'chopped', 'sliced', 'finely', 'fresh', 'large', 'small', 'medium',
        'tbsp', 'tsp', 'cup', 'cups', 'ml', 'kg', 'oz', 'lb', 'about', 'plus', 'extra', 'serve', 'serving', 'taste', 'optional', 'g', 'l',
        'peeled', 'diced', 'crushed', 'grated', 'ground', 'roughly', 'thinly', 'pieces', 'piece', 'whole', 'halved', 'drained', 'rinsed'}

def words(s):
    s = re.sub(r'\([^)]*\)', ' ', s.lower())
    return [w for w in re.findall(r'[a-zà-ÿ]{3,}', s) if w not in STOP]

def doc(r):
    parts = []
    parts += [r['dish'].replace('-', '_')] * 4
    parts += [('flavor_' + f).replace('-', '_') for f in r.get('flavors', [])] * 3
    parts += [('main_' + m).replace('-', '_') for m in r.get('mains', [])] * 2
    parts += ['cuisine_' + r['cuisine'].replace('-', '_'), 'cat_' + r['category']] * 2
    parts += ['goal_' + g for g in r.get('goal', [])] * 3
    parts += words(r['title']) * 2
    for line in r['ingredients']: parts += words(line)
    return ' '.join(parts)

def main():
    recipes = []
    for f in sorted(glob.glob(os.path.join(DATA, 'batch-*.json'))):
        recipes += json.load(open(f, encoding='utf8'))
    docs = [doc(r) for r in recipes]
    vec = TfidfVectorizer(sublinear_tf=True, min_df=1, token_pattern=r'[^\s]+')
    X = vec.fit_transform(docs)
    S = cosine_similarity(X)
    out = {}
    for i, r in enumerate(recipes):
        order = S[i].argsort()[::-1]
        out[r['id']] = [[recipes[j]['id'], round(float(S[i, j]), 3)] for j in order if j != i][:12]
    json.dump(out, open(os.path.join(DATA, 'similar.json'), 'w', encoding='utf8'), indent=0)
    print(len(out), 'recipes -> data/similar.json  (%d features)' % X.shape[1])
    for probe in ('chocolate-cake', 'pad-thai', 'chicken-tikka-masala'):
        if probe in out: print(' ', probe, '->', ', '.join('%s %.2f' % (a, b) for a, b in out[probe][:6]))

if __name__ == '__main__':
    main()
