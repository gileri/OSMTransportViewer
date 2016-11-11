var osmUrl = "//www.openstreetmap.org/";

var path_color = {
    bus: 'green',
    subway: 'red',
    trolleybus: 'yellow',
    tramway: 'black',
};

var iconStopPosition = L.icon({
    iconUrl: './img/stop_position_32.png',
    iconSize: [12, 12]
});

var mapPadding = {
    paddingTopLeft: [500, 50],
};

var defaultOptions = {
    "otv-opapi": "//overpass-api.de/api",
    "otv-read_intro": false,
    "otv-tiles": "osmfr",
};

var tiles = {
    "osmfr": {
        url: "//{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
        maxZoom: 19
    },
    "osm": {
        url: "//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        maxZoom: 18
    }
}

var route_icons = {
    bus:        'lib/osmic/bus-stop-14.png',
    trolleybus: 'lib/osmic/bus-stop-14.png',
    tram:       'lib/osmic/tram-stop-14.png',
    subway:     'lib/osmic/metro-14.png',
    railway:    'lib/osmic/railway-station-14.png'
};

var defaultStatusMessages = {
    "dl": "Downloading data from Overpass API"
};

var defaultMapView = {
    coords: [45.75840835, 4.8956966],
    zoom: 13
}
