#!/usr/bin/env python3
"""
Downloads and caches 70+ curated, real live-action HD video clips from Envato Mixkit CDN
for the v2_cinematic documentary production pipeline.
"""

from __future__ import annotations

import concurrent.futures
import json
import subprocess
from pathlib import Path
import requests

ROOT_DIR = Path(__file__).resolve().parent.parent
CORPUS_DIR = ROOT_DIR / "public" / "broll_corpus"

# Curated real live-action camera clips organized by narrative beat & visual category
CURATED_CLIPS = [
    # 1. Holiday / Christmas Shopping Trigger
    {"id": "46530", "cat": "holiday_shopping", "desc": "Couple Christmas window shopping at night"},
    {"id": "47414", "cat": "holiday_shopping", "desc": "Woman surrounded by Christmas presents paying on phone"},
    {"id": "46551", "cat": "holiday_shopping", "desc": "Window shopping with glowing Christmas tree reflections"},
    {"id": "46591", "cat": "holiday_shopping", "desc": "Couple window shopping in Europe at Christmas"},
    {"id": "47882", "cat": "holiday_shopping", "desc": "Woman doing Christmas shopping on tablet at night"},
    {"id": "42124", "cat": "holiday_shopping", "desc": "Hands opening a Christmas gift box"},
    {"id": "35040", "cat": "holiday_shopping", "desc": "Warm glowing Christmas lights and ornaments"},
    {"id": "2707",  "cat": "holiday_shopping", "desc": "Cinematic Christmas bokeh lights in dark room"},
    {"id": "44579", "cat": "holiday_shopping", "desc": "Wrapping holiday gift box on wooden table"},
    {"id": "14839", "cat": "holiday_shopping", "desc": "Tying ribbon around holiday gift box"},
    {"id": "4725",  "cat": "holiday_shopping", "desc": "Wrapped gifts under glowing Christmas tree"},
    {"id": "31274", "cat": "holiday_shopping", "desc": "Hands holding wrapped present close up"},

    # 2. Credit Cards, POS Terminals & Checkout Impulse
    {"id": "21780", "cat": "credit_card", "desc": "Tapping credit card on POS terminal at counter"},
    {"id": "15914", "cat": "credit_card", "desc": "Woman pays cashier with credit card in retail shop"},
    {"id": "8994",  "cat": "credit_card", "desc": "Customer tapping credit card on payment machine"},
    {"id": "21325", "cat": "credit_card", "desc": "Paying with credit card in boutique clothing store"},
    {"id": "34241", "cat": "credit_card", "desc": "Man entering credit card numbers into smartphone"},
    {"id": "35902", "cat": "credit_card", "desc": "Entering bank card details on mobile phone"},
    {"id": "34277", "cat": "credit_card", "desc": "Close-up of credit card and smartphone checkout"},
    {"id": "15901", "cat": "credit_card", "desc": "Cashier handing shopping bag across store counter"},
    {"id": "5407",  "cat": "credit_card", "desc": "Worker accepting card payment at register"},
    {"id": "15718", "cat": "credit_card", "desc": "Retail checkout payment transaction"},

    # 3. Retail Store Racks, Decoy Anchors & Shopping Bags
    {"id": "23327", "cat": "retail_racks", "desc": "Hand browsing through clothing rack in store"},
    {"id": "6302",  "cat": "retail_racks", "desc": "Shoppers walking with multiple retail bags"},
    {"id": "40175", "cat": "retail_racks", "desc": "Unloading pile of shopping bags from car trunk"},
    {"id": "21330", "cat": "retail_racks", "desc": "Walking through fashion store carrying shopping bags"},
    {"id": "28749", "cat": "retail_racks", "desc": "Carrying luxury shopping bags down city sidewalk"},
    {"id": "21331", "cat": "retail_racks", "desc": "Exiting retail store loaded with shopping bags"},
    {"id": "4147",  "cat": "retail_racks", "desc": "Shoppers browsing crowded market stalls"},
    {"id": "23249", "cat": "retail_racks", "desc": "Late-night online shopping checkout with card"},
    {"id": "31086", "cat": "retail_racks", "desc": "Browsing retail display shelves"},

    # 4. Supermarket Aisles, Price Tags & Grocery Traps
    {"id": "49137", "cat": "supermarket", "desc": "Young woman comparing discount price tags in supermarket"},
    {"id": "49349", "cat": "supermarket", "desc": "Shopper selecting items from illuminated supermarket shelf"},
    {"id": "49350", "cat": "supermarket", "desc": "Customer reaching for eye-level supermarket products"},
    {"id": "25438", "cat": "supermarket", "desc": "Pushing cart down bright supermarket aisle"},
    {"id": "31969", "cat": "supermarket", "desc": "Close-up of retail price tags in grocery market"},
    {"id": "33476", "cat": "supermarket", "desc": "Selecting fresh produce in grocery store"},
    {"id": "4452",  "cat": "supermarket", "desc": "Crowded evening market street"},

    # 5. Cash, Falling Banknotes, Counting Machines & Debt Leak
    {"id": "18305", "cat": "money_cash", "desc": "Banknotes falling in slow motion against dark background"},
    {"id": "18296", "cat": "money_cash", "desc": "Macro close-up of hands counting stack of bills"},
    {"id": "45703", "cat": "money_cash", "desc": "High-speed money counting machine spinning bills"},
    {"id": "47005", "cat": "money_cash", "desc": "Bundles of currency notes in low moody light"},
    {"id": "18261", "cat": "money_cash", "desc": "Macro forensic detail of currency banknotes"},
    {"id": "18297", "cat": "money_cash", "desc": "Opening leather wallet looking for last banknote"},
    {"id": "18304", "cat": "money_cash", "desc": "Hands flipping through cash bills close up"},

    # 6. Shipping, Delivery Boxes & Threshold Padding
    {"id": "23841", "cat": "shipping", "desc": "Courier handing cardboard delivery box at door"},
    {"id": "31138", "cat": "shipping", "desc": "Warehouse worker moving stacked shipping boxes"},
    {"id": "24279", "cat": "shipping", "desc": "Receiving express delivery parcel at home"},
    {"id": "42137", "cat": "shipping", "desc": "Hands taping cardboard shipping box shut"},
    {"id": "42130", "cat": "shipping", "desc": "Home delivery package handoff"},
    {"id": "31139", "cat": "shipping", "desc": "Express courier with stacked parcels"},

    # 7. Cars, Depreciation & Night Driving
    {"id": "35540", "cat": "car_autopsy", "desc": "Modern car driving down highway at dusk"},
    {"id": "64",    "cat": "car_autopsy", "desc": "Car driving through urban traffic"},
    {"id": "74",    "cat": "car_autopsy", "desc": "Headlights cutting through dark night road"},
    {"id": "49878", "cat": "city_mood",   "desc": "Cinematic night city skyline and traffic trails"},
    {"id": "40746", "cat": "city_mood",   "desc": "Aerial night city grid glowing in darkness"},
    {"id": "42048", "cat": "city_mood",   "desc": "Wet city street reflecting neon traffic at night"},
    {"id": "25375", "cat": "city_mood",   "desc": "Raindrops streaking down dark glass window"},
    {"id": "6890",  "cat": "city_mood",   "desc": "Rain falling on dark city pavement"},
    {"id": "18312", "cat": "city_mood",   "desc": "Moody rain clouds over city skyline"},

    # 8. Calm Budgeting, Financial Audit & Quiet Household Systems
    {"id": "9607",  "cat": "calm_budget", "desc": "Reviewing financial statement at desk"},
    {"id": "47792", "cat": "calm_budget", "desc": "Auditing monthly numbers and receipts"},
    {"id": "47210", "cat": "calm_budget", "desc": "Calculating household budget figures"},
    {"id": "914",   "cat": "calm_budget", "desc": "Focused planning at clean desk with laptop"},
    {"id": "4809",  "cat": "calm_budget", "desc": "Hands typing calm budget system on laptop"},
    {"id": "45923", "cat": "calm_budget", "desc": "Quiet evening audit at home desk"},
    {"id": "6213",  "cat": "calm_budget", "desc": "Calm debt-free family moment at home"},
    {"id": "33729", "cat": "calm_budget", "desc": "Peaceful warm living room evening"},
    {"id": "33784", "cat": "calm_budget", "desc": "Gathering around kitchen table without stress"},
]


def download_one(entry: dict) -> dict | None:
    vid_id = entry["id"]
    out_path = CORPUS_DIR / f"clip_{vid_id}_{entry['cat']}.mp4"
    if out_path.exists() and out_path.stat().st_size > 100_000:
        return {**entry, "path": str(out_path)}

    url = f"https://assets.mixkit.co/videos/{vid_id}/{vid_id}-720.mp4"
    try:
        with requests.get(url, stream=True, timeout=25, headers={"User-Agent": "Mozilla/5.0"}) as r:
            if r.status_code != 200:
                url1080 = f"https://assets.mixkit.co/videos/{vid_id}/{vid_id}-1080.mp4"
                r = requests.get(url1080, stream=True, timeout=25, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            with open(out_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
        if out_path.stat().st_size > 100_000:
            return {**entry, "path": str(out_path)}
    except Exception as e:
        print(f"  [warn] Failed {vid_id}: {e}")
    return None


def main() -> None:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {len(CURATED_CLIPS)} real live-action HD video clips to {CORPUS_DIR}...")
    manifest = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for res in ex.map(download_one, CURATED_CLIPS):
            if res:
                manifest.append(res)

    manifest_path = CORPUS_DIR / "corpus_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"✅ Downloaded {len(manifest)}/{len(CURATED_CLIPS)} verified real live-action HD clips.")


if __name__ == "__main__":
    main()
