# Old Vienna Chicago Locations

Static map site for `SnakPlug/locations`.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`.

## Add locations

Edit `locations.csv`. Latitude and longitude are preferred because the static
site does not need a geocoding API key.

```csv
id,name,address,neighborhood,area,zip,lat,lng,hours,products,notes,demo
store-name-60600,Store Name,"123 Example Ave, Chicago, IL 60600",Neighborhood,north,60600,41.8781,-87.6298,Daily 9 AM-9 PM,"Old Vienna chips; Riplets",Endcap display near checkout,false
```

Valid `area` values: `north`, `west`, `south`, `suburbs`.
