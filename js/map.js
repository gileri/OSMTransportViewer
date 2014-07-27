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
	var op = $('#opSelect').val();
	var net = $('#netSelect').val();
	var ref = $('#refSelect').val();

	var netstr = net ? ("[network=" + net + "]") : "";
	var opstr = op ? ("[operator=" + op + "]") : "";
	var refstr = ref ? ("[ref=" + ref + "]") : "";

	var query = "[timeout:45][out:json];rel[type=route](" + bbox + ")" + netstr + opstr + refstr + ";(._;>;);out;";
	$.ajax(opapi, {
		type: "POST",
		data: query,
	}).done(parseData);
	// $.ajax('./data/map.json').done(parseData);
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
	    netSelect.append($("<option />").val(this));
	});
	$.each(operators, function() {
	    opSelect.append($("<option>").val(this));
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
		rels[r].members.forEach(function(m, mn) {
			switch(m.role) {
				case "stop":
				case "stop_entry_only":
				case "stop_exit_only":
					L.marker([m.obj.lat, m.obj.lon], {
						icon: stopIcon,
					}).bindPopup(
						"<a href='" + osmUrl + "node/" + m.ref + "'>" + m.obj.tags.name + "</a>"
					).addTo(map);
					break;
				case "":
					if(m.type != "way") return;

					// Reverse way display if necessary
					if(path.length) {
						var lastNodePath = path[path.length - 1];
						var firstNodeWay = L.latLng(m.obj.nodes[0].lat, m.obj.nodes[0].lon);
						var lastNodeWay = L.latLng(m.obj.nodes[m.obj.nodes.length-1].lat, m.obj.nodes[m.obj.nodes.length-1].lon);
						if(lastNodePath.distanceTo(firstNodeWay) < lastNodePath.distanceTo(lastNodeWay)) {
							for(var i=0; i < m.obj.nodes.length; ++i) {
								path.push(L.latLng(m.obj.nodes[i].lat, m.obj.nodes[i].lon));
							}
						} else {
							for(var i=m.obj.nodes.length -1; i >= 0 ; --i) {
								path.push(L.latLng(m.obj.nodes[i].lat, m.obj.nodes[i].lon));
							}
						}
					} else {
						// First route segment, try to guess orientation according to the next route segment.
						var firstNodeFirstWay = m.obj.nodes[m.obj.nodes.length - 1];
						var lastNodeFirstWay = m.obj.nodes[0];
						//Find next route segment
						var j;
						for(j=mn; j<rels[r].members.length; ++i) {
							if(rels[r].members[j].role == "" && rels[r].members[j].type == "way") {
								break;
							}
						}
						var firstNodeSecondWay = rels[r].members[j].obj.nodes[0];
						
						var distLast = L.latLng(lastNodeFirstWay.lat, lastNodeFirstWay.lon).distanceTo(L.latLng(firstNodeSecondWay.lat, firstNodeSecondWay.lon));
						var distFirst = L.latLng(firstNodeFirstWay.lat, firstNodeFirstWay.lon).distanceTo(L.latLng(firstNodeSecondWay.lat, firstNodeSecondWay.lon));
						
						if(distLast > distFirst) {
							for(var i=0; i < m.obj.nodes.length; ++i) {
								path.push(L.latLng(m.obj.nodes[i].lat, m.obj.nodes[i].lon));
							}
						} else {
							for(var i=m.obj.nodes.length -1; i >= 0 ; --i) {
								path.push(L.latLng(m.obj.nodes[i].lat, m.obj.nodes[i].lon));
							}
						}
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
