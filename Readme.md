![Preview of demo website](mockup.jpg)

## Usage
```
npm install
node server.js
```
Go to [http://localhost:8080](http://localhost:8080).

Green markers are cars that became available.

Grey markers are cars that became unavailable.

## How it works

### 1. Fetch city configuration
The app first fetches the list of available cities and their MQTT broker URLs from the Free2move REST API:

```
GET https://app.free2move.com/api/rental/appdata/v7/external/configurations
```

The response contains a `locations` array, each entry with a `locationId`, `locationName`, and `vserverMqttUri`.

### 2. Connect to MQTT
Connect to the MQTT broker URL from the city configuration (currently `mqtts://driver.prod.rental.ridedev.io:443` for all cities). No username or password is required for anonymous access. The clientId is a random UUID prefixed by `a:`.

### 3. Subscribe to topics
Subscribe to vehicle data topics. The schema is `C2G/S2C/<locationId>/<topic>.GZ` where `topic` is either `VEHICLELIST` or `VEHICLELISTDELTA`.

## Locations

Possible `locationId` values are:

- Germany
    - Hamburg - `3`
    - Berlin - `12`
    - Frankfurt am Main - `33`
    - München - `26`
    - Köln - `19`
    - Stuttgart - `18`
- Italy
    - Milan - `20`
    - Rome - `31`
    - Turin - `44`
- France
    - Paris - `48`
- Netherlands
    - Amsterdam - `5`
- Austria
    - Vienna - `7`
- Spain
    - Madrid - `36`
- USA
    - Washington DC - `57`

## MQTT Topics

All data received is JSON compressed with gzip.

### VEHICLELIST
Subscriptions to this topic give you a list of all available cars for the given location. A message is sent each time there is an update, so you should unsubscribe as soon as you get the first message.

<details>
    <summary>Example</summary>

```json
{
    "connectedVehicles": [
        {
            "id": "WBY8P210107E82494",
            "plate": "M-EV1558E",
            "geoCoordinate": {
                "latitude": 53.57132,
                "longitude": 9.95367
            },
            "fuellevel": 84,
            "address": "Fruchtallee 107, 20259 Hamburg",
            "locationId": "3",
            "buildSeries": "BMW_I3",
            "fuelType": "ELECTRIC",
            "primaryColor": "B85U",
            "hardwareVersion": "HW42",
            "imageUrl": "https://www.car2go.com/rentalassets/vehicles/{density}/bmw_i3_capparis_white.png",
            "transmission": "GA",
            "rank": 1,
            "vin": "WBY8P210107E82494",
            "locationIdAsLong": 3
        }
    ],
    "locationId": 3,
    "eventType": "CONNECTED_VEHICLES",
    "timestamp": 1589666154706
}
```
</details>

### VEHICLELISTDELTA
This topic receives messages whenever a car becomes available or unavailable.

<details>
    <summary>Example</summary>

```json
{
    "addedVehicles": [
        {
            "id": "WME4533421K323858",
            "plate": "HH-GO8560",
            "geoCoordinate": {
                "latitude": 53.55533,
                "longitude": 10.02782
            },
            "fuellevel": 59,
            "address": "Jungestra\u00c3\u0178e 6, 20535 Hamburg",
            "locationId": "3",
            "buildSeries": "C453",
            "fuelType": "GASOLINE",
            "primaryColor": "EN2U",
            "secondaryColor": "EDAO",
            "hardwareVersion": "HW3",
            "imageUrl": "https://www.car2go.com/rentalassets/vehicles/{density}/c453_silver.png",
            "transmission": "GA",
            "rank": 1,
            "vin": "WME4533421K323858",
            "locationIdAsLong": 3
        }
    ],
    "removedVehicles": [
        "WME4533421K291769"
    ],
    "locationId": 3,
    "timestamp": 1589656739007,
    "eventType": "VEHICLE_LIST_UPDATE"
}
```
</details>

### Code
All Free2move API related code is in [free2move.js](free2move.js). The rest of the files are for the demo webpage.
