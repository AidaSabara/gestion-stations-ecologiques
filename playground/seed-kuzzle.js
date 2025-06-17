"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
/* eslint-disable sort-keys */
var kuzzle_sdk_1 = require("kuzzle-sdk");
var uuid_1 = require("uuid");
var kuzzle = new kuzzle_sdk_1.Kuzzle(new kuzzle_sdk_1.WebSocket("localhost"));
var regions = [
    "Dakar",
    "Thiès",
    "Saint-Louis",
    "Ziguinchor",
    "Kaolack",
    "Louga",
    "Tambacounda",
    "Kolda",
    "Matam",
    "Fatick",
];
var regionCoords = {
    Dakar: [14.6928, -17.4467],
    Thiès: [14.7914, -16.9256],
    "Saint-Louis": [16.0179, -16.4896],
    Ziguinchor: [12.5833, -16.2667],
    Kaolack: [14.146, -16.0726],
    Louga: [15.6144, -16.2286],
    Tambacounda: [13.7699, -13.6673],
    Kolda: [12.8833, -14.95],
    Matam: [15.6559, -13.2559],
    Fatick: [14.3396, -16.4117],
};
function createMappings() {
    return __awaiter(this, void 0, void 0, function () {
        var mappings, _i, _a, _b, collection, def;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    mappings = {
                        stations: {
                            mappings: {
                                properties: {
                                    name: { type: "text" },
                                    location: { type: "geo_point" },
                                    status: { type: "keyword" },
                                    type: { type: "keyword" },
                                    installedAt: { type: "date" },
                                },
                            },
                        },
                        readings: {
                            mappings: {
                                properties: {
                                    stationId: { type: "keyword" },
                                    timestamp: { type: "date" },
                                    temperature: { type: "float" },
                                    humidity: { type: "float" },
                                    airQuality: { type: "float" },
                                    co2: { type: "float" },
                                },
                            },
                        },
                        alerts: {
                            mappings: {
                                properties: {
                                    stationId: { type: "keyword" },
                                    type: { type: "keyword" },
                                    message: { type: "text" },
                                    level: { type: "keyword" },
                                    timestamp: { type: "date" },
                                },
                            },
                        },
                        users: {
                            mappings: {
                                properties: {
                                    name: { type: "text" },
                                    email: { type: "keyword" },
                                    role: { type: "keyword" },
                                    createdAt: { type: "date" },
                                },
                            },
                        },
                        events: {
                            mappings: {
                                properties: {
                                    type: { type: "keyword" },
                                    message: { type: "text" },
                                    timestamp: { type: "date" },
                                },
                            },
                        },
                    };
                    return [4 /*yield*/, kuzzle.index.create("iot")];
                case 1:
                    _c.sent();
                    _i = 0, _a = Object.entries(mappings);
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    _b = _a[_i], collection = _b[0], def = _b[1];
                    return [4 /*yield*/, kuzzle.collection.create("iot", collection, def)];
                case 3:
                    _c.sent();
                    console.log("\u2705 Collection '".concat(collection, "' cr\u00E9\u00E9e."));
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function createData() {
    var now = new Date();
    var stations = regions.map(function (region, i) {
        var _a = regionCoords[region], lat = _a[0], lon = _a[1];
        return {
            _id: "station-".concat(region.toLowerCase(), "-").concat(i),
            body: {
                name: "Station ".concat(region, " ").concat(i),
                location: { lat: lat, lon: lon },
                status: Math.random() > 0.5 ? "active" : "inactive",
                type: Math.random() > 0.5 ? "fixed" : "mobile",
                installedAt: now.toISOString(),
            },
        };
    });
    var readings = stations.flatMap(function (station) {
        return Array.from({ length: 5 }).map(function (_, i) {
            var date = new Date(now.getTime() - i * 15 * 60000);
            return {
                _id: (0, uuid_1.v4)(),
                body: {
                    stationId: station._id,
                    timestamp: date.toISOString(),
                    temperature: Number((Math.random() * 20 + 20).toFixed(2)),
                    humidity: Number((Math.random() * 60 + 30).toFixed(2)),
                    airQuality: Number((Math.random() * 500).toFixed(2)),
                    co2: Number((Math.random() * 700 + 300).toFixed(2)),
                },
            };
        });
    });
    var alerts = stations.flatMap(function (station) {
        return Array.from({ length: 2 }).map(function (_, i) {
            var date = new Date(now.getTime() - i * 3600000);
            return {
                _id: (0, uuid_1.v4)(),
                body: {
                    stationId: station._id,
                    type: "threshold_exceeded",
                    level: Math.random() > 0.5 ? "warning" : "critical",
                    message: "Valeur anormale détectée.",
                    timestamp: date.toISOString(),
                },
            };
        });
    });
    var users = Array.from({ length: 3 }).map(function (_, i) { return ({
        _id: "user-".concat(i + 1),
        body: {
            name: "Agent ".concat(i + 1),
            email: "agent".concat(i + 1, "@ecostations.sn"),
            role: "agent",
            createdAt: now.toISOString(),
        },
    }); });
    var events = Array.from({ length: 5 }).map(function (_, i) {
        var date = new Date(now.getTime() - i * 3600000);
        return {
            _id: (0, uuid_1.v4)(),
            body: {
                type: ["system_start", "maintenance", "data_backup"][i % 3],
                message: "Événement système généré automatiquement.",
                timestamp: date.toISOString(),
            },
        };
    });
    return { stations: stations, readings: readings, alerts: alerts, users: users, events: events };
}
function seed() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, stations, readings, alerts, users, events, bulkInsert, error_1;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, kuzzle.connect()];
                case 1:
                    _b.sent();
                    console.log("🔌 Connecté à Kuzzle");
                    return [4 /*yield*/, createMappings()];
                case 2:
                    _b.sent();
                    _a = createData(), stations = _a.stations, readings = _a.readings, alerts = _a.alerts, users = _a.users, events = _a.events;
                    bulkInsert = function (collection, docs) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, kuzzle.document.mCreate("iot", collection, docs)];
                                case 1:
                                    _a.sent();
                                    console.log("\uD83D\uDCE6 ".concat(docs.length, " documents ins\u00E9r\u00E9s dans '").concat(collection, "'"));
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, bulkInsert("stations", stations)];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, bulkInsert("readings", readings)];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, bulkInsert("alerts", alerts)];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, bulkInsert("users", users)];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, bulkInsert("events", events)];
                case 7:
                    _b.sent();
                    console.log("✅ Données injectées avec succès !");
                    kuzzle.disconnect();
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _b.sent();
                    console.error("❌ Erreur:", error_1);
                    kuzzle.disconnect();
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
seed();
