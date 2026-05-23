const locations = {
    "Germany": [
        {name: "Hamburg", id: 3, geo: {lat: 53.57132, lng: 9.95367}},
        {name: "Berlin", id: 12, geo: {lat: 52.5069704, lng: 13.2846517}},
        {name: "Frankfurt am Main", id: 33, geo: {lat: 50.121301, lng: 8.5665248}},
        {name: "München", id: 26, geo: {lat: 48.155004, lng: 11.4717967}},
        {name: "Köln", id: 19, geo: {lat: 50.95779, lng: 6.8972834}},
        {name: "Stuttgart", id: 18, geo: {lat: 48.779301, lng: 9.1071762}}
    ],
    "France": [
        {name: "Paris", id: 48, geo: {lat: 48.8589101, lng: 2.3120407}}
    ],
    "Italy": [
        {name: "Mailand", id: 20, geo: {lat: 45.4627887, lng: 9.142713}},
        {name: "Rom", id: 31, geo: {lat: 41.9101776, lng: 12.4659587}},
        {name: "Turin", id: 44, geo: {lat: 45.073544, lng: 7.6405873}}
    ],
    "Netherlands": [
        {name: "Amsterdam", id: 5, geo: {lat: 52.3547498, lng: 4.8339214}}
    ],
    "Austria": [
        {name: "Wien", id: 7, geo: {lat: 48.220778, lng: 16.3100209}}
    ],
    "Spain": [
        {name: "Madrid", id: 36, geo: {lat: 40.4380638, lng: -3.7495758}}
    ],
    "USA": [
        {name: "Washington DC", id: 57, geo: {lat: 38.9072, lng: -77.0369}}
    ]
};
const idToCity = {};
Object.keys(locations).forEach(country => locations[country].forEach(city => idToCity[city.id] = city));

document.querySelectorAll("#countries li").forEach(li => {
    li.onclick = () => {
        updateCities(li.innerText);
        document.querySelectorAll("#countries li.selected").forEach(li => li.classList.remove("selected"));
        li.classList.add("selected");
    }
});
registerCityClickListeners();

function registerCityClickListeners() {
    document.querySelectorAll("#cities li").forEach(li => {
        li.onclick = () => {
            changeLocation(li.dataset.id);
            document.querySelectorAll("#cities li.selected").forEach(li => li.classList.remove("selected"));
            li.classList.add("selected");
        }
    });
}

function updateCities(country) {
    const ul = document.getElementById("cities");
    ul.innerHTML = "";
    locations[country].forEach(city => {
        ul.insertAdjacentHTML("beforeend", `<li data-id="${city.id}">${city.name}</li>`);
    });
    registerCityClickListeners();
}

function changeLocation(id) {
    const city = idToCity[id];
    if (!city) return;
    map.setView([city.geo.lat, city.geo.lng], 13);

    // Clear all existing markers
    Object.values(markers).forEach(marker => marker.removeFrom(map));
    markers = {};

    // Tell the server to switch MQTT location
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: "changeLocation", locationId: parseInt(id)}));
    }
}

var map = L.map('map').setView([53.57132, 9.95367], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let markers = {};

function addVehicleMarker(vehicle, initial = false) {
    let geoCoords = vehicle.geoCoordinate;
    if (geoCoords !== undefined) {
        const icon = L.divIcon({
            iconAnchor: [0, 24],
            labelAnchor: [-6, 0],
            popupAnchor: [0, -36],
            html: `<span class="marker ${initial ? "available" : "new"}"><i class="fas fa-car"></i></span>`
        });
        let fuelIcon = vehicle.fuelType === "ELECTRIC" ? '<i class="fas fa-bolt"></i>' : '<i class="fas fa-gas-pump"></i>';
        let marker = L.marker([geoCoords.latitude, geoCoords.longitude])
            .addTo(map)
            .setIcon(icon)
            .bindPopup(`
                <div class="popup-car">
                    <div>
                        <img width="150" height="150" src="${vehicle.imageUrl || ''}">
                    </div>
                    <div class="popup-car-details">
                        <div>${vehicle.plate || ''}</div>
                        <div>${vehicle.address ? vehicle.address.split(",")[0] : ''}</div>
                        <div>
                            <span>${vehicle.fuellevel || 0}%</span>
                            ${fuelIcon}
                        </div>
                    </div>
                </div>
            `);
        markers[vehicle.id || vehicle.vin] = marker;
    }
}

function removeVehicleMarker(id) {
    let marker = markers[id];
    if (marker !== undefined) {
        const icon = L.divIcon({
            iconAnchor: [0, 24],
            labelAnchor: [-6, 0],
            popupAnchor: [0, -36],
            html: `<span class="marker unavailable"><i class="fas fa-car"></i></span>`
        });
        marker.setIcon(icon);
    }
}

var ws = new WebSocket("ws://" + location.host);
ws.onmessage = event => {
    const json = JSON.parse(event.data);
    if (json.type === "initial") {
        // Full vehicle list (initial load or after location change)
        if (json.vehicles) {
            json.vehicles.forEach(v => addVehicleMarker(v, true));
        }
    } else if (json.eventType === "VEHICLE_LIST_UPDATE" || json.addedVehicles || json.removedVehicles) {
        // Delta update
        if (json.addedVehicles) {
            json.addedVehicles.forEach(addVehicleMarker);
        }
        if (json.removedVehicles) {
            json.removedVehicles.forEach(removeVehicleMarker);
        }
    }
};
