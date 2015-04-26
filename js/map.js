var opapi = "http://api.openstreetmap.fr/oapi/interpreter";
var osmUrl = "https://openstreetmap.org/";

var bench_text   = " <bench>";
var shelter_text = " <shelter>";

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

	var netstr = net ? ("[network='" + net + "']") : "";
	var opstr = op ? ("[operator='" + op + "']") : "";
	var refstr = ref ? ("[ref='" + ref + "]'") : "";

    query='[out:json];(rel[type=route_master][network=TCL][ref="C2"]; rel(r)->.a; .a; node(r.a)->.b; .b; way(r.a); >>; rel(bn.b)[type=public_transport];); out;',

	//$.ajax(opapi, {
	//	type: "POST",
	//	data: query,
	//}).done(parseData);
	$.ajax('./data/map.json').done(parseData);
};

var geojsonMarkerOptions = {
    radius: 8,
    fillColor: "#ff7800",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

var parseData = function(op_data) {
    geojson = osmtogeojson(op_data);
    var parsed = parseOSM(op_data)
    console.log(parsed);
    console.log(geojson);
    L.geoJson(geojson, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, geojsonMarkerOptions);
        }
    }).addTo(map);
    _.each(parsed.routes, function(r) {
        var routeLi = $("<li>");
        $("<span>")
            .text(r.tags.name + " ")
            .data("osmID", r.id)
            .on("click", function(event) {
                displayRoute(parsed, parsed.routes[$(this).data("osmID")]);
            })
            .appendTo(routeLi);
        $("<a>", {href: osmUrl + "relation" + "/" + r.id})
            .text("(ext)")
            .appendTo(routeLi);
        $("#routes_list>ul").append(routeLi);
    });
};

var displayRoute = function(data, route) {
    $('#stops_list>table').html("");
    var stop_li;
    _.each(route.members, function(member, memberID) {
        stop_tr = $("<tr>");
        
        if(!member.role.match(/stop(_entry_only|_exit_only)?/))
            return;
        var stop_name = "<Nom d'arrêt non défini>";
        if(member.tags.name) {
            stop_name = member.tags.name;
        } else if (member.stop_area) {
            if(member.stop_area.tags.name) {
                stop_name = member.stop_area.tags.name;
            }
        }
        stop_tr.append($("<td>").append($("<a>", {href: osmUrl + member.type + "/" + member.id}))
                        .text(stop_name));
        if(member.stop_area)
            stop_tr.append($("<td>").append($("<a>", {href: osmUrl + "relation/" + member.stop_area.id}).text(member.stop_area.id)));

        var potential_platforms = findPlatform(data, route, member.stop_area);
        if(potential_platforms.length == 1) {
            var platform = potential_platforms[0];
            stop_tr.append($("<td>").append($("<a>", {href: osmUrl + platform.type + "/" + platform.id}).text(platform.id)));
            stop_tr.append($("<td>").append($("<span>").text(platform.tags.shelter)));
            stop_tr.append($("<td>").append($("<span>").text(platform.tags.bench)));
        }
        $('#stops_list>table').append(stop_tr);
    });
}

var findPlatform = function(data, route, stop_area) {
    var route_platforms = _.where(route.members, {role: 'platform'});
    var area_platforms = _.where(stop_area.members, {role: 'platform'});
    return _.intersection(route_platforms, area_platforms);
}

var displayNode = function(node) {

}

var displayWay = function(way) {

}

var displayFeature = function(map, features) {
    var l;
    _.each(features, function(feature, featureID) {
        switch(feature.type) {
            case 'node':
            break;
            case 'way':
                var way;
                _.each(feature.nodes, function(way, wayID) {
                    // TODO populate PolyLine
                });
                L.Polyline(way);
            break;
            case 'relation':
            break;
        }
    });
}
