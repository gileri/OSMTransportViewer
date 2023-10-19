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

var platformIcon = L.icon({
    iconUrl: './img/platform_14.png',
    iconSize: [14, 14]
});

var mapPadding = {
    paddingTopLeft: [500, 0],
};

var defaultOptions = {
    "otv-opapi": "//overpass-api.de/api",
    "otv-read_intro": false,
    "otv-tiles": "osmfr",
};

var tiles = {
    "osmfr": L.tileLayer("//{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        attribution: 'map data &copy; <a href="//openstreetmap.org/copyright">openstreetmap</a> contributors',
        maxzoom: 19
    }),
    "osm": L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="//openstreetmap.org/copyright">openstreetmap contributors</a>',
        maxzoom: 18
    }),
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
