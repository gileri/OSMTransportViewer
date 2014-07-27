var opapi = "http://api.openstreetmap.fr/oapi/interpreter";
var osmUrl = "https://openstreetmap.org/";

var path_color = {
	bus: 'blue',
	subway: 'red',
	trolleybus: 'green',
	tramway: 'black',
};
var path_weight = 2;

var stopIcon = L.icon({
    iconUrl: './img/stop.png',
    iconSize: [12, 12],
    popupAnchor: [-3, -76],
});

var nodes = {};
var ways = {};
var rels = {};
var operators = [];
var networks = [];

var stops_markers = [];

var map = L.map('map').setView([45.75840835755788, 4.895696640014648], 13);

L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
    maxZoom: 18
}).addTo(map);

var dlBbox = function() {
	var bounds = map.getBounds();
	var bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join();
	// $.ajax(opapi, {
	// 	type: "POST",
	// 	data: "[timeout:25][out:json];rel[type=route][network=TCL];(._;>;);out;",
	// }).done(parseData);
	$.ajax('./data/map.json').done(parseData);
};

var parseData = function(data) {
	data.elements.forEach(function(e) {
		switch(e.type) {
			case "node":
				nodes[e.id] = e;
				break;
			case "way":
				ways[e.id] = e;
				break;
			case "relation":
				rels[e.id] = e;
				if(e.tags.network && networks.indexOf(e.tags.network)==-1) networks.push(e.tags.network);
				if(e.tags.operator && operators.indexOf(e.tags.operator)==-1) operators.push(e.tags.operator);
				break;
		}
	});

	var netSelect = $("#netSelect");
	var opSelect = $("#opSelect");
	$.each(networks, function() {
	    netSelect.append($("<option />").val(this).text(this));
	});
	$.each(operators, function() {
	    opSelect.append($("<option />").val(this).text(this));
	});

	// Join nodes to ways
	for (w in ways) {
		ways[w].nodes.forEach(function(m, i) {
			if(nodes[m]) {
				ways[w].nodes[i] = nodes[m];
			}
		});
	}

	// Join members of relations recursively
	for (r in rels) {
		rels[r].members.forEach(function(m) {
			switch(m.type){
				case "node":
					m.obj = nodes[m.ref];
					break;
				case "way":
					m.obj = ways[m.ref];
					break;
				case "relation":
					m.obj = rels[m.ref];
					break;
			}
		});
	}

	for (r in rels) {
		var path = [];
		rels[r].members.forEach(function(m) {
			switch(m.role) {
				case "stop":
				case "stop_entry_only":
				case "stop_exit_only":
					L.marker([m.obj.lat, m.obj.lon], {
						icon: stopIcon,
					}).addTo(map);
					break;
				case "":
					if(m.type == "way") {
						m.obj.nodes.forEach(function(n) {
							path.push(L.latLng(n.lat, n.lon));
						});
					}
					break;
			}
		});
		if(path.length > 0) {
			var color = path_color[rels[r].tags.route];

			var polyline = L.polyline(path, {
				weight: path_weight,
				color: color ? color : 'grey'
			}).bindPopup(
				"<a href='" + osmUrl + "relation/" + rels[r].id + "'>" + rels[r].tags.name + "</a>"
			).addTo(map);
		}
	}
};
