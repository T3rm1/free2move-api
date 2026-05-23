const mqtt = require("mqtt");
const zlib = require("zlib");
const uuid = require("uuid-random");
const https = require("https");

const CONFIG_URL = "https://app.free2move.com/api/rental/appdata/v7/external/configurations?oauth_consumer_key=car2go";
const USER_AGENT = "rideApp;Android;4.55.0;34;Samsung Galaxy S24";

class Free2moveClient {
    vehicles = [];
    cities = {};
    #client = null;
    #clientId = uuid();
    #currentLocationId = null;
    #updateCallback = null;

    /**
     * Fetch city configurations from the Free2move REST API.
     * Returns a map of locationId -> { name, locationId, mqttUri }
     */
    fetchCities() {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept-Language": "en",
                    "Accept-Encoding": "gzip"
                }
            };
            https.get(CONFIG_URL, options, res => {
                let chunks = [];
                res.on("data", chunk => chunks.push(chunk));
                res.on("end", () => {
                    try {
                        let buffer = Buffer.concat(chunks);
                        if (res.headers["content-encoding"] === "gzip") {
                            buffer = zlib.gunzipSync(buffer);
                        }
                        const response = JSON.parse(buffer.toString());
                        const cities = {};
                        if (response && Array.isArray(response.locations)) {
                            response.locations.forEach(city => {
                                cities[city.locationId] = {
                                    name: city.locationName,
                                    locationId: city.locationId,
                                    mqttUri: city.vserverMqttUri
                                };
                            });
                        }
                        this.cities = cities;
                        resolve(cities);
                    } catch (e) {
                        reject(e);
                    }
                });
                res.on("error", reject);
            }).on("error", reject);
        });
    }

    /**
     * Connect to the MQTT broker for a given locationId.
     * Disconnects any existing connection first.
     */
    async connect(locationId) {
        if (Object.keys(this.cities).length === 0) {
            await this.fetchCities();
        }

        const city = this.cities[locationId];
        if (!city) {
            console.error(`Unknown locationId: ${locationId}. Available: ${Object.keys(this.cities).join(", ")}`);
            return;
        }

        // Disconnect previous connection if any
        if (this.#client) {
            this.#client.end(true);
            this.#client = null;
        }

        this.vehicles = [];
        this.#currentLocationId = locationId;

        const vehicleListTopic = `C2G/S2C/${locationId}/VEHICLELIST.GZ`;
        const vehicleListDeltaTopic = `C2G/S2C/${locationId}/VEHICLELISTDELTA.GZ`;

        // The vserverMqttUri from the API is in the format "ssl://host:port"
        // mqtt.js expects "mqtts://host:port"
        const brokerUrl = city.mqttUri.replace(/^ssl:\/\//, "mqtts://");
        console.log(`Connecting to ${city.name} (${locationId}) via ${brokerUrl}`);

        const client = mqtt.connect(brokerUrl, {
            clientId: "a:" + this.#clientId,
            rejectUnauthorized: false,
            clean: true,
        });
        this.#client = client;

        client.on("connect", () => {
            console.log(`Connected to MQTT broker for ${city.name}. Subscribing to topics.`);
            client.subscribe(vehicleListTopic, { qos: 0 });
            client.subscribe(vehicleListDeltaTopic, { qos: 1 });
        });

        client.on("message", (topic, message) => {
            let json;
            try {
                json = JSON.parse(zlib.gunzipSync(message));
            } catch (e) {
                console.error("Failed to decompress/parse message:", e.message);
                return;
            }

            if (topic === vehicleListDeltaTopic) {
                if (this.#updateCallback) {
                    // for some reason the server sends the full list of vehicles every minute
                    if (json.addedVehicles.length < 50) {
                        this.updateVehicles(json);
                        this.#updateCallback(json);
                    }
                }
            } else if (topic === vehicleListTopic) {
                console.log(`Received initial vehicle list: ${json.connectedVehicles ? json.connectedVehicles.length : 0} vehicles`);
                client.unsubscribe(vehicleListTopic);
                this.vehicles = json.connectedVehicles || [];
                if (this.#updateCallback) {
                    this.#updateCallback({ type: "initial", vehicles: this.vehicles });
                }
            }
        });

        client.on("error", error => {
            console.error(`MQTT Error: ${error}`);
        });

        client.on("close", () => {
            console.log("MQTT connection closed");
        });
    }

    getVehicles(callback) {
        this.#updateCallback = callback;
        return this.vehicles;
    }

    updateVehicles(vehicleUpdate) {
        if (vehicleUpdate.addedVehicles) {
            this.vehicles = this.vehicles.concat(vehicleUpdate.addedVehicles);
        }
        if (vehicleUpdate.removedVehicles) {
            vehicleUpdate.removedVehicles.forEach(vehicleId => {
                this.vehicles = this.vehicles.filter(e => e.id !== vehicleId);
            });
        }
    }
}

module.exports = Free2moveClient;
