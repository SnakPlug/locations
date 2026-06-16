# Old Vienna Chicago Locations

Static map site for `SnakPlug/locations`.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`.

## Add locations

Edit `locations.json`:

```json
[
  {
    "id": "store-name-60600",
    "name": "Store Name",
    "address": "123 Example Ave, Chicago, IL 60600",
    "neighborhood": "Neighborhood",
    "area": "north",
    "zip": "60600",
    "lat": 41.8781,
    "lng": -87.6298,
    "hours": "Daily 9 AM-9 PM",
    "products": ["Old Vienna chips"],
    "notes": "Endcap display near checkout"
  }
]
```

Valid `area` values: `north`, `west`, `south`, `suburbs`.
