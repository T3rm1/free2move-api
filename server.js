const Free2moveClient = require("./free2move");
const express = require("express");
const WebSocket = require("ws");

const DEFAULT_LOCATION = 3; // Hamburg

const app = express();
app.use(express.static(__dirname));
app.get("/", (req, res) => {
    res.sendFile("index.html", { root: __dirname });
});

const server = app.listen(8080, () => {
    console.log("Server is up and running on port 8080.");
});

const client = new Free2moveClient();

// Fetch cities and connect to default location
client.fetchCities().then(cities => {
    console.log(`Loaded ${Object.keys(cities).length} cities from API`);
    client.connect(DEFAULT_LOCATION);
}).catch(err => {
    console.error("Failed to fetch city config, using fallback connection:", err.message);
    client.connect(DEFAULT_LOCATION);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
    // Send current vehicle list on connect
    ws.send(JSON.stringify({ type: "initial", vehicles: client.getVehicles() }));

    // Register for updates
    client.getVehicles(update => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(update));
        }
    });

    // Handle location change requests from the frontend
    ws.on("message", data => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === "changeLocation" && msg.locationId) {
                console.log(`Switching to location ${msg.locationId}`);
                client.connect(msg.locationId);
            }
        } catch (e) {
            console.error("Invalid message from client:", e.message);
        }
    });
});
