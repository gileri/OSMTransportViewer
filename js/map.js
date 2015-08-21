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

var map = L.map('map', {attributionControl: false})
               .setView([45.75840835755788, 4.895696640014648], 13);
L.control.attribution({position: "bottomleft"}).addAttribution("© OpenStreetMap contributors").addTo(map);

L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
    maxZoom: 18
}).addTo(map);

var route_layer;

function bind_events () {
    $("#dlForm").on("submit", function (event){
        dlBbox();   
        event.preventDefault();
    });
    $("#open_close").on("click", function (event) {
       $("#data_display").toggle();
    });
}

function dlBbox () {
	var bounds = map.getBounds();
	var bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join();
	var op = $('#opSelect').val();
	var net = $('#netSelect').val();
	var ref = $('#refSelect').val();

	var netstr = net ? ("[network~'" + net + "',i]") : "";
	var opstr = op ? ("[operator~'" + op + "',i]") : "";
	var refstr = ref ? ("[ref~'" + ref + "',i]") : "";

    // Avoid queries which can match too much routes
    if(opstr == "" && refstr == "")
        return;

    query='[out:json];relation["type"="route_master"]' + netstr + opstr + refstr + '->.route_masters;rel(r.route_masters)->.routes;node(r.routes)->.stops;way(r.routes)["highway"]->.paths;node(w.paths)->.paths_nodes;(node(r.routes);way(r.routes);)->.platforms;(relation(bn.stops)["type"="public_transport"]["public_transport"="stop_area"];relation(bw.stops)["type"="public_transport"]["public_transport"="stop_area"];)->.stop_areas;(.route_masters;.routes;.stop_areas;.stops;.paths;.platforms;.paths_nodes;);out body;',

    $("#dlForm>input[type=submit]").prop("disabled", true);
    developement = false;
    if(developement) {
        $.ajax('./data/map.json')
        .done(function (op_data) {
            parseData(op_data);
        })
        .always(function () {
            $("#dlForm>input[type=submit]").prop("disabled", false);
        });
   } else {
        $.ajax(opapi, {
            type: "POST",
            data: query,
        }).done(function (op_data) {
            $("#dlForm>input[type=submit]").prop("disabled", false);
            parseData(op_data);
        });
    }
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
    var geojson = osmtogeojson(op_data);
    var parsed = parseOSM(op_data);
    if(map.hasLayer(route_layer))
        map.removeLayer(route_layer);
    route_layer = L.geoJson(geojson, {
        filter: function(feature, layer) {
            return true;
            if(feature.properties.tags.public_transport == "platform")
                return true;
            if(feature.properties.tags.public_transport == "stop_position")
                return true;
            return false;
        },
        style: function(feature) {
            console.log(feature);
        },
        pointToLayer: function(feature, latlng) {
            if(feature.properties.tags.public_transport == "platform")
                return L.circleMarker(latlng, geojsonMarkerOptions);
            if(feature.properties.tags.public_transport == "stop_position")
                return L.circleMarker(latlng, geojsonMarkerOptions);
            return L.circleMarker(latlng, geojsonMarkerOptions);
        }
    });
    route_layer.addTo(map);

    // Clear data display before new display
    $("#routes_list ul").empty()

    _.each(parsed.routes, function(r) {
        var routeLi = $("<li>").addClass(r.tags.route + "_route");
        $("<span>")
            .text(r.tags.name + " ")
            .data("osmID", r.id)
            .on("click", function(event) {
                $("#routes_list>ul>li>span").removeClass("selected_route");
                $(this).addClass("selected_route");
                displayRoute(parsed, parsed.routes[$(this).data("osmID")]);
            })
            .appendTo(routeLi);
        $("<a>", {href: osmUrl + "relation" + "/" + r.id})
            .text("(rel ↗)")
            .appendTo(routeLi);

        $("#routes_list>ul").append(routeLi);
    });
};

var displayRoute = function(data, route) {
    // Un-hide stop list table header
    $("tr#stop_list_header").removeClass("hidden");
    // Clear data display before new display
    $('#stops_list>table').find("tr:gt(0)").remove();;
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
        stop_td = $("<td>")
            .append($("<a>", {href: osmUrl + member.type + "/" + member.id})
            .text(stop_name));
        $("<span>")
            .text("♿")
            .addClass("wheelchair feature_" + member.tags.wheelchair)
            .appendTo(stop_td);
        stop_tr.append(stop_td)
        if(member.stop_area)
            stop_tr.append($("<td>").append($("<a>", {href: osmUrl + "relation/" + member.stop_area.id}).text(member.stop_area.tags.name || member.stop_area.id)));

        var potential_platforms = findPlatform(data, route, member.stop_area);
        if(potential_platforms.length == 1) {
            var platform = potential_platforms[0];
            var platform_td = $("<td>");
            $("<a>", {href: osmUrl + platform.type + "/" + platform.id})
                .text(platform.id)
                .appendTo(platform_td);
            $("<span>")
              .text("♿")
              .addClass("wheelchair feature_" + member.tags.wheelchair)
              .appendTo(platform_td);
            platform_td.appendTo(stop_tr);
            stop_tr.append($("<td>").append($("<span>").text(platform.tags.shelter)));
            stop_tr.append($("<td>").append($("<span>").text(platform.tags.bench)));
        }
        $('#stops_list>table').append(stop_tr);
    });
}

var findPlatform = function(data, route, stop_area) {
	if(stop_area === undefined)
		return [];
    var route_platforms = _.filter(route.members, function(p){return p.role.match(/platform(_entry_only|_exit_only)?/)});
    var area_platforms = _.filter(stop_area.members, function(p){return p.role.match(/platform(_entry_only|_exit_only)?/)});
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

bind_events();
